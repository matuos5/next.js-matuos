// app/api/manhwa2/route.js
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

/**
 * خدمات البروكسي المحسنة مع تناوب ذكي
 */
const proxyServices = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  // لاحظ: هذا قد لا يعمل لكل المواقع لكن تركته كخيار احتياطي
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
      // try next proxy
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

function parseNumberLike(val) {
  if (!val) return NaN;
  // try numeric parse first
  const n = parseFloat(String(val).replace(/[^\d.-]/g, ""));
  if (!isNaN(n)) return n;
  // fallback: try extract number inside text
  const m = String(val).match(/(\d+(\.\d+)?)/);
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

    // بناء رابط السلسلة الأساسي (تأكد من أن النطاق صحيح حسب موقعك)
    const baseSeriesUrl = `https://olympustaff.com/series/${encodeURIComponent(mangaId)}`;

    // visited pages to avoid loops
    const visited = new Set();
    const toVisit = [baseSeriesUrl];
    const chaptersMap = new Map(); // key => chapterNumberString or href (to dedupe)

    // safety limits
    const MAX_PAGES = 60;
    let pagesFetched = 0;

    while (toVisit.length > 0) {
      if (pagesFetched++ >= MAX_PAGES) break;
      const pageUrl = toVisit.shift();
      if (!pageUrl) break;
      if (visited.has(pageUrl)) continue;
      visited.add(pageUrl);

      // If not asking for all, only fetch the first page
      if (!getAllChapters && pageUrl !== baseSeriesUrl) break;

      let html;
      try {
        const { text } = await tryFetchWithProxies(pageUrl);
        html = text;
      } catch (err) {
        // اذا فشل جلب صفحة واحدة، نتابع الصفحات الأخرى إن وُجدت
        console.warn("fetch page error:", err);
        continue;
      }

      const $ = cheerio.load(html);

      // 1) اجمع كل chapter-card
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

        // views: either data-views or .chapter-views span
        let viewsText = dataViews || $el.find(".chapter-views span").first().text().trim() || null;
        if (viewsText) {
          viewsText = String(viewsText).replace(/[^\d]/g, "");
        }

        // key to dedupe: prefer numeric number, otherwise href, otherwise numberText
        const numeric = !isNaN(parseNumberLike(dataNumber || numberText));
        const key = numeric ? String(parseNumberLike(dataNumber || numberText)) : absHref || numberText || Math.random();

        // avoid duplicates (if same chapter number appears multiple times across pages)
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
        }
      });

      // 2) حاول اكتشاف روابط صفحات أخرى (pagination)
      // - روابط <a> داخل عنصر pagination
      const paginationLinks = [];
      $(".pagination a, nav.pagination a, .pages a, .page-numbers a").each((_, a) => {
        const href = $(a).attr("href");
        if (href) paginationLinks.push(absoluteUrl(pageUrl, href));
      });

      // - روابط next/rel
      const relNext = $('link[rel="next"]').attr("href") || $('a[rel="next"]').attr("href");
      if (relNext) paginationLinks.push(absoluteUrl(pageUrl, relNext));

      // - أزرار load more أو حقل data-url
      const loadMore = $('[data-load-more], .load-more, .btn-load-more').first();
      if (loadMore && loadMore.length) {
        const dataUrl = loadMore.attr("data-url") || loadMore.data("url") || loadMore.attr("href");
        if (dataUrl) paginationLinks.push(absoluteUrl(pageUrl, dataUrl));
      }

      // add unique pagination links
      for (const p of paginationLinks) {
        if (!p) continue;
        if (!visited.has(p) && !toVisit.includes(p)) {
          toVisit.push(p);
        }
      }

      // heuristics: some sites use query ?page=2 pattern - attempt sequential pages if "all" asked
      if (getAllChapters) {
        // try to detect "?page=" pattern from current url or pagination links
        const sample = paginationLinks.concat([pageUrl]).find((u) => /[?&]page=\d+/i.test(u));
        if (sample) {
          try {
            const u = new URL(sample);
            const pageParam = u.searchParams.get("page");
            if (pageParam) {
              const current = parseInt(pageParam, 10) || 1;
              // enqueue next few pages until max or until visited
              for (let p = current + 1; p <= current + 20; p++) {
                const clone = new URL(u.toString());
                clone.searchParams.set("page", String(p));
                const candidate = clone.toString();
                if (!visited.has(candidate) && !toVisit.includes(candidate)) toVisit.push(candidate);
              }
            }
          } catch (e) {
            // ignore
          }
        } else {
          // try naive page=2..N on baseSeriesUrl
          for (let p = 2; p <= 20; p++) {
            const tryUrl = `${baseSeriesUrl}?page=${p}`;
            if (!visited.has(tryUrl) && !toVisit.includes(tryUrl)) toVisit.push(tryUrl);
          }
        }
      }
    } // end while pages to visit

    // تحويل الخريطة إلى مصفوفة ثم ترتيب من الأصغر للأكبر حسب numberSortable (NaN في آخر)
    const chaptersArray = Array.from(chaptersMap.values());

    chaptersArray.sort((a, b) => {
      const aNum = isNaN(a.numberSortable) ? Infinity : a.numberSortable;
      const bNum = isNaN(b.numberSortable) ? Infinity : b.numberSortable;
      if (aNum !== bNum) return aNum - bNum;
      // tie-breaker: timestamp older first
      const aTs = a.timestamp || 0;
      const bTs = b.timestamp || 0;
      return aTs - bTs;
    });

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 200,
      mangaId,
      count: chaptersArray.length,
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
