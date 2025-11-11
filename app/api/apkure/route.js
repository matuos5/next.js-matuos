// app/api/apkure/route.js
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const runtime = "nodejs";        // مهم على Vercel لتفادي Edge 403
export const dynamic = "force-dynamic"; // منع أي كاش
export const revalidate = 0;

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

const ORIG = "https://apkpure.com";
const ALT  = "https://m.apkpure.com";

function abs(base, url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return `${base}${url}`;
  return `${base}/${url}`;
}

async function fetchHtml(url, { ua = DESKTOP_UA, referer = ORIG + "/" } = {}) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": ua,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ar,en;q=0.9",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Referer": referer,
    },
    redirect: "follow",
    cache: "no-store",
    // @ts-ignore next options
    next: { revalidate: 0 },
  });

  if (res.status === 403) throw new Error("HTTP_403");
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return await res.text();
}

function pick($, sels = [], attr) {
  for (const s of sels) {
    if (attr) {
      const v = $(s).first().attr(attr);
      if (v) return v.trim();
    } else {
      const t = $(s).first().text();
      if (t && t.trim()) return t.trim();
    }
  }
  return attr ? null : "";
}

async function scrapeDownloadPage(base, downloadPageUrl) {
  try {
    const html = await fetchHtml(downloadPageUrl, { referer: base + "/" });
    const $ = cheerio.load(html);
    let direct =
      $("a.btn.download-start-btn").attr("href") ||
      $("#download_link").attr("href") ||
      $("a[data-dt-apk]").attr("href") ||
      $("a[rel='noopener'][target='_blank']").attr("href");
    direct = abs(base, direct);

    let size =
      $("a.btn.download-start-btn .download-file-size").text().trim() ||
      $("span.download-file-size").text().trim() ||
      $("div.info-bottom .size").text().trim() ||
      $("span:contains('File size')").next().text().trim() ||
      "Unknown";

    return { directDownloadUrl: direct || "Not available", fileSize: size || "Unknown" };
  } catch {
    return { directDownloadUrl: "Not available", fileSize: "Unknown" };
  }
}

async function getDownloadPageFromApp(base, appUrl) {
  const html = await fetchHtml(appUrl, { referer: base + "/" });
  const $ = cheerio.load(html);

  let downloadPageUrl =
    $("a.download_apk_news").attr("href") ||
    $("a#download_apk_button").attr("href") ||
    $("a.da").attr("href") ||
    $("a[href*='/download?']").attr("href");
  downloadPageUrl = abs(base, downloadPageUrl);

  const title =
    pick($, [".p1", "h1[itemprop='name'] span", "h1", "meta[property='og:title']"]) || $("title").text().trim();

  const developer =
    pick($, [".p2", "a[itemprop='author']", ".details-author a", ".developer"]);

  const rating =
    pick($, [".star", ".rating .score", "[itemprop='ratingValue']"]) || "Not rated";

  let icon =
    pick($, ["meta[property='og:image']"], "content") ||
    pick($, ["img[itemprop='image']", "img#icon", ".icon img"], "src");
  icon = abs(base, icon);

  return { downloadPageUrl, title, developer: developer || "Unknown", rating, icon };
}

async function detailFromSearchItem(base, $, el) {
  const $el = $(el);
  let appUrl =
    $el.find("a.dd").attr("href") ||
    $el.find("a").attr("href");
  appUrl = abs(base, appUrl);

  const title =
    $el.find(".p1").text().trim() ||
    $el.find("h3").text().trim() ||
    $el.find("a").attr("title") ||
    "";

  const developer = $el.find(".p2").text().trim() || "Unknown";
  const rating = $el.find(".star").text().trim() || "Not rated";
  let icon = $el.find("img").attr("src") || $el.find("img").attr("data-src");
  icon = abs(base, icon);

  let downloadPageUrl = "Not available";
  let directDownloadUrl = "Not available";
  let fileSize = "Unknown";

  if (appUrl) {
    const meta = await getDownloadPageFromApp(base, appUrl);
    downloadPageUrl = meta.downloadPageUrl || "Not available";
    if (meta.downloadPageUrl) {
      const dl = await scrapeDownloadPage(base, meta.downloadPageUrl);
      directDownloadUrl = dl.directDownloadUrl;
      fileSize = dl.fileSize;
    }
  }

  return {
    title: title || appUrl || "Unknown",
    developer,
    rating,
    icon,
    url: appUrl,
    downloadPage: downloadPageUrl,
    directDownloadUrl,
    fileSize,
  };
}

async function scrapeApkpureSearch(base, q) {
  // صفحة البحث (نسخة عربية)
  const searchUrl = `${base}/ar/search?q=${encodeURIComponent(q)}`;
  const html = await fetchHtml(searchUrl, { referer: base + "/" });
  const $ = cheerio.load(html);

  let items = $(".search-res li").get();
  if (!items.length) {
    items = $("ul.search-res > li, ul#search-res > li, .search-result li, .list > li").get();
  }

  const results = [];
  // ملاحظة: يمكنك زيادة التوازي لاحقًا باستخدام Promise.allSettled + limit
  for (const el of items) {
    try {
      const one = await detailFromSearchItem(base, $, el);
      results.push(one);
    } catch {}
  }
  return results;
}

function isApkpureUrl(str) {
  try { return /apkpure\.com$/i.test(new URL(str).hostname); }
  catch { return false; }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q) {
      return NextResponse.json(
        { owner: "MATUOS-3MK", code: 400, msg: "يرجى تمرير q (اسم التطبيق أو رابط من apkpure)" },
        { status: 400 }
      );
    }

    let base = ORIG;
    let results = [];

    // حاول على الدومين الأصلي
    try {
      if (isApkpureUrl(q)) {
        // بالرابط
        const u = new URL(q);
        if (/\.(apk|xapk|apkm|zip|obb)(\?|$)/i.test(u.pathname)) {
          // رابط مباشر لملف
          results = [{
            title: u.pathname.split("/").pop() || "Unknown",
            developer: "Unknown",
            rating: "Not rated",
            icon: null,
            url: q,
            downloadPage: "Not available",
            directDownloadUrl: q,
            fileSize: "Unknown",
          }];
        } else if (/\/download/i.test(u.pathname) || u.searchParams.get("from") === "details") {
          const dl = await scrapeDownloadPage(base, q);
          results = [{
            title: "Unknown",
            developer: "Unknown",
            rating: "Not rated",
            icon: null,
            url: null,
            downloadPage: q,
            directDownloadUrl: dl.directDownloadUrl,
            fileSize: dl.fileSize,
          }];
        } else {
          const meta = await getDownloadPageFromApp(base, q);
          let directDownloadUrl = "Not available";
          let fileSize = "Unknown";
          if (meta.downloadPageUrl) {
            const dl = await scrapeDownloadPage(base, meta.downloadPageUrl);
            directDownloadUrl = dl.directDownloadUrl;
            fileSize = dl.fileSize;
          }
          results = [{
            title: meta.title || "Unknown",
            developer: meta.developer || "Unknown",
            rating: meta.rating || "Not rated",
            icon: meta.icon || null,
            url: q,
            downloadPage: meta.downloadPageUrl || "Not available",
            directDownloadUrl,
            fileSize,
          }];
        }
      } else {
        // بالاسم
        results = await scrapeApkpureSearch(base, q);
      }
    } catch (e) {
      // لو فشل بـ 403 أو غيره، جرّب الموبايل دومين
      base = ALT;
      if (isApkpureUrl(q)) {
        const meta = await getDownloadPageFromApp(base, q.replace(ORIG, ALT));
        let directDownloadUrl = "Not available";
        let fileSize = "Unknown";
        if (meta.downloadPageUrl) {
          const dl = await scrapeDownloadPage(base, meta.downloadPageUrl);
          directDownloadUrl = dl.directDownloadUrl;
          fileSize = dl.fileSize;
        }
        results = [{
          title: meta.title || "Unknown",
          developer: meta.developer || "Unknown",
          rating: meta.rating || "Not rated",
          icon: meta.icon || null,
          url: q,
          downloadPage: meta.downloadPageUrl || "Not available",
          directDownloadUrl,
          fileSize,
        }];
      } else {
        results = await scrapeApkpureSearch(base, q);
      }
    }

    if (!results.length) {
      return NextResponse.json(
        { owner: "MATUOS-3MK", code: 404, msg: "لم يتم العثور على نتائج", data: { query: q, total: 0, results: [] } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: { query: q, total: results.length, results }
    });
  } catch (err) {
    return NextResponse.json(
      { owner: "MATUOS-3MK", code: 500, msg: "حدث خطأ داخلي في السيرفر", error: err?.message || String(err) },
      { status: 500 }
    );
  }
    } 
