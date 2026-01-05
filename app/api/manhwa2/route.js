// app/api/manhwa2/route.js
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

/**
 * بروكسيات احتياطية
 */
const proxyServices = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://proxy.cors.sh/${url}`,
];

async function tryFetchWithProxies(targetUrl, timeoutMs = 15000) {
  let lastErr = null;
  for (const makeProxyUrl of proxyServices) {
    const proxyUrl = makeProxyUrl(targetUrl);
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(id);
      if (!res.ok) {
        lastErr = new Error(`proxy ${proxyUrl} returned ${res.status}`);
        continue;
      }
      const text = await res.text();
      return { text, usedProxy: proxyUrl };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("All proxies failed");
}

function absoluteUrl(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function normalizeDigits(str) {
  if (!str) return str;
  const map = {
    '\u0660':'0','\u0661':'1','\u0662':'2','\u0663':'3','\u0664':'4',
    '\u0665':'5','\u0666':'6','\u0667':'7','\u0668':'8','\u0669':'9',
    '\u06F0':'0','\u06F1':'1','\u06F2':'2','\u06F3':'3','\u06F4':'4',
    '\u06F5':'5','\u06F6':'6','\u06F7':'7','\u06F8':'8','\u06F9':'9'
  };
  return String(str).replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => map[d] || d);
}

function parseNumberLike(val) {
  if (!val) return NaN;
  const s = normalizeDigits(String(val));
  const n = parseFloat(s.replace(/[^\d.-]/g, ""));
  if (!isNaN(n)) return n;
  const m = s.match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[0]) : NaN;
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const searchParams = url.searchParams;
    const mangaId = searchParams.get("id");
    const getAllChapters = searchParams.get("all") === "true";

    if (!mangaId) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى اضافة معرف المانجا في باراميتر id",
          examples: ["/api/manhwa2?id=SL", "/api/manhwa2?id=solo-farming-in-the-tower&all=true"],
        },
        { status: 400 }
      );
    }

    const baseSeriesUrl = `https://olympustaff.com/series/${encodeURIComponent(mangaId)}`;

    // صفوف/خرائط للتجميع والتخلص من التكرار
    const chaptersMap = new Map(); // key -> chapter object
    const visitedPages = new Set();

    // جلب صفحة معينة وتحليلها (يُعيد عدد الفصول المُضافة من هذه الصفحة)
    async function fetchAndParsePage(pageUrl) {
      let html;
      try {
        const { text } = await tryFetchWithProxies(pageUrl);
        html = text;
      } catch (err) {
        console.warn("fetch failed for", pageUrl, err);
        return { added: 0, html: null };
      }
      visitedPages.add(pageUrl);
      const $ = cheerio.load(html);

      let added = 0;
      $("div.chapter-card, .chapter-card").each((_, el) => {
        const $el = $(el);
        const dataNumber = $el.attr("data-number");
        const dataDate = $el.attr("data-date");
        const dataViews = $el.attr("data-views");

        const linkEl = $el.find("a.chapter-link").first();
        const href = linkEl.attr("href") || $el.find("a").attr("href") || null;
        const absHref = href ? absoluteUrl(pageUrl, href) : null;

        const numberText = $el.find(".chapter-number").first().text().trim() || dataNumber || null;
        const titleText = $el.find(".chapter-title").first().text().trim() || null;
        const dateText = $el.find(".chapter-date span").first().text().trim() || (dataDate ? String(dataDate) : null);

        let viewsText = dataViews || $el.find(".chapter-views span").first().text().trim() || null;
        if (viewsText) viewsText = normalizeDigits(String(viewsText)).replace(/[^\d]/g, "");

        // مفتاح لإزالة التكرار: href أولوية، ثم رقم رقمي، ثم النص الخام
        const numeric = !isNaN(parseNumberLike(dataNumber || numberText));
        const key = absHref || (numeric ? String(parseNumberLike(dataNumber || numberText)) : numberText) || Math.random();

        if (!chaptersMap.has(key)) {
          chaptersMap.set(key, {
            numberRaw: numberText,
            numberSortable: parseNumberLike(dataNumber || numberText),
            href: absHref,
            title: titleText,
            date: dateText,
            views: viewsText ? parseInt(viewsText, 10) : null,
            timestamp: dataDate ? parseInt(String(dataDate), 10) : null,
            sourcePage: pageUrl,
          });
          added++;
        }
      });

      return { added, html };
    }

    // 1) جلب الصفحة الأولى
    const first = await fetchAndParsePage(baseSeriesUrl);
    if (!first.html) {
      return NextResponse.json({ owner: "MATUOS-3MK", code: 502, msg: "فشل في جلب صفحة السلسلة الأولى" }, { status: 502 });
    }
    const $first = cheerio.load(first.html);

    // 2) اكتشاف عدد صفحات pagination إن وُجدت (أفضل طريقة)
    const pageNumbers = new Set();
    $first("ul.pagination a.page-link, .pagination a.page-link, .pagination a").each((_, a) => {
      const href = $first(a).attr("href") || "";
      const m = href.match(/[?&]page=(\d+)/i);
      if (m) pageNumbers.add(parseInt(m[1], 10));
      // بعض المواقع تستخدم /series/SMN?page=2 أو /series/SMN/2 — حاول اكتشاف رقم من المسار
      const pathMatch = href.match(/\/page\/(\d+)|\/p\/(\d+)|\/series\/[^/]+\/(\d+)(?:$|[?\/])/i);
      if (pathMatch) {
        for (let i = 1; i < pathMatch.length; i++) {
          if (pathMatch[i]) pageNumbers.add(parseInt(pathMatch[i], 10));
        }
      }
    });

    let lastPage = 1;
    if (pageNumbers.size > 0) {
      lastPage = Math.max(...Array.from(pageNumbers));
    } else {
      // لم نعثر على أرقام صفحات مباشرة -> حاول استنتاجها من آخر فصل (.epcurlast) وعدد فصول في الصفحة
      const lastEpText = $first(".epcurlast").first().text().trim() || $first(".lastend .epcurlast").first().text().trim();
      const lastChapterNumber = parseNumberLike(lastEpText);
      const itemsPerPage = $first("div.chapter-card, .chapter-card").length || 1;
      if (!isNaN(lastChapterNumber) && itemsPerPage > 0) {
        lastPage = Math.ceil(lastChapterNumber / itemsPerPage);
      } else {
        // كحل أخير، ابحث في روابط pagination كاملة لاستخراج أي رقم صفحة
        $first("ul.pagination li, nav.pagination li").each((_, li) => {
          const txt = $first(li).text().trim();
          const n = parseNumberLike(txt);
          if (!isNaN(n)) pageNumbers.add(n);
        });
        if (pageNumbers.size > 0) lastPage = Math.max(...Array.from(pageNumbers));
      }
    }

    // safety limit
    if (lastPage > 500) lastPage = 500;

    // 3) لو المستخدم طلب جميع الفصول، جلب الصفحات 2..lastPage
    if (getAllChapters) {
      for (let p = 2; p <= lastPage; p++) {
        const tryUrl = `${baseSeriesUrl}?page=${p}`;
        if (visitedPages.has(tryUrl)) continue;
        await fetchAndParsePage(tryUrl);
      }
    } else {
      // لم يُطلب الكل: نكتفي بالصفحة الأولى كما فعلنا
    }

    // 4) تحويل الخريطة إلى مصفوفة وترتيب تصاعدي
    const chaptersArray = Array.from(chaptersMap.values());
    chaptersArray.sort((a, b) => {
      const aNum = isNaN(a.numberSortable) ? Infinity : a.numberSortable;
      const bNum = isNaN(b.numberSortable) ? Infinity : b.numberSortable;
      if (aNum !== bNum) return aNum - bNum;
      const aTs = a.timestamp || 0;
      const bTs = b.timestamp || 0;
      return aTs - bTs;
    });

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 200,
      mangaId,
      count: chaptersArray.length,
      lastPageDetected: lastPage,
      chapters: chaptersArray,
    });
  } catch (err) {
    console.error("route error:", err);
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "حدث خطأ أثناء جلب الفصول",
        error: String(err?.message || err),
      },
      { status: 500 }
    );
  }
                                 } 
