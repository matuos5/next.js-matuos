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
  // Arabic-Indic and Extended Arabic-Indic digits
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

function extractPotentialUrlsFromScripts(html, base) {
  const urls = new Set();
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const c = match[1];
    // look for absolute URLs
    const absUrlRegex = /(https?:\/\/[^\s"'<>]+)/gi;
    let m2;
    while ((m2 = absUrlRegex.exec(c)) !== null) {
      const candidate = m2[1];
      if (/page=|\/page\/|\bajax\b|load_more|get_chapters|chapters|\/series\//i.test(candidate)) {
        urls.add(candidate);
      }
    }
    // look for relative URLs inside JS strings
    const relRegex = /['"]((?:\/|\.\.\/)[^'"]+)['"]/gi;
    let m3;
    while ((m3 = relRegex.exec(c)) !== null) {
      const rel = m3[1];
      if (/page=|\/page\/|\bajax\b|load_more|get_chapters|chapters|\/series\//i.test(rel)) {
        urls.add(absoluteUrl(base, rel));
      }
    }
  }
  return Array.from(urls);
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

    const visited = new Set();
    const toVisit = [baseSeriesUrl];
    const chaptersMap = new Map(); // key -> { href OR number } to dedupe

    const MAX_PAGES = 200;
    let pagesFetched = 0;

    // helper to parse page HTML and add chapters; returns numberAdded
    function parseAndAddChapters(html, pageUrl) {
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

        const numeric = !isNaN(parseNumberLike(dataNumber || numberText));
        // key: prefer href, then numeric number, then raw text
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
      return added;
    }

    while (toVisit.length > 0) {
      if (pagesFetched++ >= MAX_PAGES) break;
      const pageUrl = toVisit.shift();
      if (!pageUrl) break;
      if (visited.has(pageUrl)) continue;
      visited.add(pageUrl);

      // if not asking for all, only fetch the first page
      if (!getAllChapters && pageUrl !== baseSeriesUrl) break;

      let html;
      try {
        const { text } = await tryFetchWithProxies(pageUrl);
        html = text;
      } catch {
        continue; // try other pages
      }

      // parse chapters
      parseAndAddChapters(html, pageUrl);

      // extract pagination links and potential ajax endpoints:
      const $ = cheerio.load(html);
      const paginationLinks = [];
      $(".pagination a, nav.pagination a, .pages a, .page-numbers a").each((_, a) => {
        const href = $(a).attr("href");
        if (href) paginationLinks.push(absoluteUrl(pageUrl, href));
      });
      const relNext = $('link[rel="next"]').attr("href") || $('a[rel="next"]').attr("href");
      if (relNext) paginationLinks.push(absoluteUrl(pageUrl, relNext));

      const loadMore = $('[data-load-more], .load-more, .btn-load-more').first();
      if (loadMore && loadMore.length) {
        const dataUrl = loadMore.attr("data-url") || loadMore.data("url") || loadMore.attr("href");
        if (dataUrl) paginationLinks.push(absoluteUrl(pageUrl, dataUrl));
      }

      // add links discovered in pagination and scripts
      for (const p of paginationLinks) {
        if (p && !visited.has(p) && !toVisit.includes(p)) toVisit.push(p);
      }
      const scriptUrls = extractPotentialUrlsFromScripts(html, pageUrl);
      for (const s of scriptUrls) {
        if (s && !visited.has(s) && !toVisit.includes(s)) toVisit.push(s);
      }
    }

    // If user requested all chapters, attempt sequential page patterns until no new chapters for several pages
    if (getAllChapters) {
      let consecutiveEmpty = 0;
      const pagePatterns = [
        (n) => `${baseSeriesUrl}/page/${n}`,
        (n) => `${baseSeriesUrl}?page=${n}`,
        (n) => `${baseSeriesUrl}/p/${n}`,
      ];
      const MAX_SEQUENTIAL = 200;
      for (let p = 2; p <= MAX_SEQUENTIAL && consecutiveEmpty < 5; p++) {
        let newAddedTotalThisRound = 0;
        for (const mk of pagePatterns) {
          const tryUrl = mk(p);
          if (visited.has(tryUrl)) continue;
          if (newAddedTotalThisRound >= 50) break; // safety
          // fetch
          let html;
          try {
            const { text } = await tryFetchWithProxies(tryUrl, 8000);
            html = text;
          } catch {
            continue;
          }
          visited.add(tryUrl);
          const added = (function parseOnce() {
            try {
              return (function () {
                const $ = cheerio.load(html);
                let addedInner = 0;
                $("div.chapter-card, .chapter-card").each((_, el) => {
                  const $el = $(el);
                  const dataNumber = $el.attr("data-number");
                  const dataDate = $el.attr("data-date");
                  const dataViews = $el.attr("data-views");

                  const linkEl = $el.find("a.chapter-link").first();
                  const href = linkEl.attr("href") || $el.find("a").attr("href") || null;
                  const absHref = href ? absoluteUrl(tryUrl, href) : null;

                  const numberText = $el.find(".chapter-number").first().text().trim() || dataNumber || null;
                  const titleText = $el.find(".chapter-title").first().text().trim() || null;
                  const dateText = $el.find(".chapter-date span").first().text().trim() || (dataDate ? String(dataDate) : null);

                  let viewsText = dataViews || $el.find(".chapter-views span").first().text().trim() || null;
                  if (viewsText) viewsText = normalizeDigits(String(viewsText)).replace(/[^\d]/g, "");

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
                      sourcePage: tryUrl,
                    });
                    addedInner++;
                  }
                });
                return addedInner;
              })();
            } catch {
              return 0;
            }
          })();
          newAddedTotalThisRound += added;
        } // end patterns loop

        if (newAddedTotalThisRound === 0) consecutiveEmpty++;
        else consecutiveEmpty = 0;
      } // end sequential pages
    }

    // sort results ascending by numberSortable, then timestamp
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
