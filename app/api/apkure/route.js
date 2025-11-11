// app/api/apkpure/route.js (أو وفق مسارك)
// Next.js Route Handler (Edge/Node)
// يعمل GET ?q=<name_or_url>

import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

const BASE = "https://apkpure.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";

function abs(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return `${BASE}${url}`;
  return `${BASE}/${url}`;
}

function pickText($ctx, sels = []) {
  for (const s of sels) {
    const t = $ctx(s).first().text().trim();
    if (t) return t;
  }
  return "";
}

function pickAttr($ctx, sels = [], attr = "href") {
  for (const s of sels) {
    const v = $ctx(s).first().attr(attr);
    if (v) return v;
  }
  return null;
}

function isApkpureUrl(str) {
  try {
    const u = new URL(str);
    return /apkpure\.com$/i.test(u.hostname);
  } catch {
    return false;
  }
}

async function fetchHtml(url, init = {}) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ar,en;q=0.9",
      "Referer": BASE + "/",
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

// استخراج رابط التحميل المباشر + الحجم من صفحة التحميل
async function scrapeDownloadPage(downloadPageUrl) {
  try {
    const html = await fetchHtml(downloadPageUrl);
    const $ = cheerio.load(html);

    // أكثر من احتمال:
    let direct =
      $("a.btn.download-start-btn").attr("href") ||
      $("#download_link").attr("href") ||
      $("a[data-dt-apk]").attr("href") ||
      $("a[rel='noopener'][target='_blank']").attr("href");

    direct = abs(direct);

    // الحجم من عدّة أماكن محتملة
    let size =
      $("a.btn.download-start-btn .download-file-size").text().trim() ||
      $("span.download-file-size").text().trim() ||
      $("div.info-bottom .size").text().trim() ||
      $("span:contains('File size')").next().text().trim() ||
      "";

    return { directDownloadUrl: direct || null, fileSize: size || "Unknown" };
  } catch {
    return { directDownloadUrl: null, fileSize: "Unknown" };
  }
}

// استخراج صفحة التحميل من صفحة التطبيق
async function getDownloadPageFromApp(appUrl) {
  const html = await fetchHtml(appUrl);
  const $ = cheerio.load(html);

  // زر التحميل الأساسي
  let downloadPageUrl =
    $("a.download_apk_news").attr("href") ||
    $("a#download_apk_button").attr("href") ||
    $("a.da").attr("href") ||
    $("a[href*='/download?']").attr("href");

  downloadPageUrl = abs(downloadPageUrl);

  // بيانات إضافية من صفحة التطبيق
  const title =
    pickText($, [".p1", "h1[itemprop='name'] span", "h1", "meta[property='og:title']"]) ||
    $("title").text().trim();

  const developer =
    pickText($, [".p2", "a[itemprop='author']", ".details-author a", ".developer"]) || "";

  const rating =
    pickText($, [".star", ".rating .score", "[itemprop='ratingValue']"]) || "Not rated";

  let icon =
    pickAttr($, ["img[itemprop='image']", "img#icon", ".icon img", "meta[property='og:image']"], "content") ||
    pickAttr($, ["img[itemprop='image']", "img#icon", ".icon img"], "src");

  icon = abs(icon);

  return { downloadPageUrl, title: title || "", developer, rating, icon };
}

// تفصيل نتيجة واحدة (من عنصر نتيجة في صفحة البحث)
async function detailFromSearchItem($, el) {
  const $el = $(el);

  // رابط صفحة التطبيق
  let appUrl =
    $el.find("a.dd").attr("href") ||
    $el.find("a").attr("href");

  appUrl = abs(appUrl);

  // عنوان وأيقونة ومطور وراتينغ من نتيجة البحث (fallbacks)
  const title =
    $el.find(".p1").text().trim() ||
    $el.find("h3").text().trim() ||
    $el.find("a").attr("title") ||
    "";

  const developer = $el.find(".p2").text().trim() || "";
  const rating = $el.find(".star").text().trim() || "Not rated";

  let icon = $el.find("img").attr("src") || $el.find("img").attr("data-src");
  icon = abs(icon);

  // إن وُجد رابط صفحة التحميل من صفحة التطبيق
  let downloadPageUrl = null;
  let directDownloadUrl = null;
  let fileSize = "Unknown";

  if (appUrl) {
    const appMeta = await getDownloadPageFromApp(appUrl);
    downloadPageUrl = appMeta.downloadPageUrl || null;

    // لو وُجدت صفحة التحميل، نحاول جلب الرابط المباشر
    if (downloadPageUrl) {
      const dl = await scrapeDownloadPage(downloadPageUrl);
      directDownloadUrl = dl.directDownloadUrl || "Not available";
      fileSize = dl.fileSize || "Unknown";
    }
  }

  return {
    title: title || appUrl || "Unknown",
    developer: developer || "Unknown",
    rating,
    icon,
    url: appUrl,
    downloadPage: downloadPageUrl || "Not available",
    directDownloadUrl: directDownloadUrl || "Not available",
    fileSize,
  };
}

// البحث في صفحة نتائج APKPure
async function scrapeApkpureSearch(query) {
  const searchUrl = `${BASE}/ar/search?q=${encodeURIComponent(query)}`;
  const html = await fetchHtml(searchUrl);
  const $ = cheerio.load(html);

  // النتائج غالبًا داخل .search-res li (كما في كودك)، مع بدائل احتياطية
  let items = $(".search-res li").get();
  if (!items.length) {
    // محاولات إضافية في حال تغيّر الـ DOM
    items = $("ul.search-res > li, ul#search-res > li, .search-result li, .list > li").get();
  }

  const results = [];
  for (const el of items) {
    try {
      const one = await detailFromSearchItem($, el);
      results.push(one);
    } catch {
      // تجاهل العنصر المعطوب
    }
  }

  return results;
}

// معالجة رابط APKPure مباشر (صفحة تطبيق / صفحة تحميل / رابط مباشر)
async function scrapeByUrl(inputUrl) {
  const url = abs(inputUrl);
  if (!url) throw new Error("Bad URL");

  const u = new URL(url);

  // إن كان الرابط صفحة تحميل مباشرة أو ملف مباشر
  if (/\.(apk|xapk|apkm|zip|obb)(\?|$)/i.test(u.pathname)) {
    return [{
      title: u.pathname.split("/").pop() || "Unknown",
      developer: "Unknown",
      rating: "Not rated",
      icon: null,
      url,
      downloadPage: "Not available",
      directDownloadUrl: url,
      fileSize: "Unknown",
    }];
  }

  // إن كانت صفحة تحميل (غالبًا تحتوي /download/ أو /download?)
  if (/\/download/i.test(u.pathname) || u.searchParams.get("from") === "details") {
    const { directDownloadUrl, fileSize } = await scrapeDownloadPage(url);
    return [{
      title: "Unknown",
      developer: "Unknown",
      rating: "Not rated",
      icon: null,
      url: null,
      downloadPage: url,
      directDownloadUrl: directDownloadUrl || "Not available",
      fileSize: fileSize || "Unknown",
    }];
  }

  // صفحة تطبيق: نحصل على صفحة التحميل ثم الرابط المباشر
  const meta = await getDownloadPageFromApp(url);
  let directDownloadUrl = "Not available";
  let fileSize = "Unknown";

  if (meta.downloadPageUrl) {
    const dl = await scrapeDownloadPage(meta.downloadPageUrl);
    directDownloadUrl = dl.directDownloadUrl || "Not available";
    fileSize = dl.fileSize || "Unknown";
  }

  return [{
    title: meta.title || "Unknown",
    developer: meta.developer || "Unknown",
    rating: meta.rating || "Not rated",
    icon: meta.icon || null,
    url,
    downloadPage: meta.downloadPageUrl || "Not available",
    directDownloadUrl,
    fileSize,
  }];
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى تمرير q (اسم التطبيق أو رابط من apkpure)",
        },
        { status: 400 }
      );
    }

    let results = [];

    if (isApkpureUrl(q)) {
      // معالجة بالرابط مباشرة
      results = await scrapeByUrl(q);
    } else {
      // بحث بالاسم
      results = await scrapeApkpureSearch(q);
    }

    if (!results.length) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على نتائج",
          data: { query: q, total: 0, results: [] },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: {
        query: q,
        total: results.length,
        results,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "حدث خطأ داخلي في السيرفر",
        error: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
