import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE = "https://apkpure.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";

const clean = (s) => (s ? s.replace(/\s+/g, " ").trim() : "");
const abs = (u) => {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("/")) return BASE + u;
  return `${BASE}/${u.replace(/^\/+/, "")}`;
};
const headers = (ref) => ({
  "User-Agent": UA,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "ar,en;q=0.9",
  Referer: ref || BASE + "/",
  Connection: "keep-alive",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
});
const isBlocked = (html) => {
  const h = html.toLowerCase();
  return (
    h.includes("just a moment") ||
    h.includes("captcha") ||
    h.includes("access denied") ||
    h.includes("verify you are human") ||
    h.includes("cf-browser-verification")
  );
};
const fetchHtml = async (url, ref) => {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: headers(ref),
    cache: "no-store",
    next: { revalidate: 0 },
  });
  const html = await res.text();
  return { ok: res.ok, status: res.status, url: res.url, html };
};
const parseDownloadFromDownloadPage = async (url) => {
  const { html } = await fetchHtml(url, url);
  const $ = cheerio.load(html);
  let direct =
    $("a.btn.download-start-btn").attr("href") ||
    $("a#download_link").attr("href") ||
    $("a.download-button").attr("href");
  if (!direct) {
    const meta = $('meta[http-equiv="refresh"]').attr("content");
    if (meta && /url=/i.test(meta)) {
      const m = meta.match(/url=(.*)$/i);
      if (m) direct = decodeURIComponent(m[1]);
    }
  }
  const directDownloadUrl = abs(direct) || "Not available";
  let fileSize =
    clean($("a.btn.download-start-btn .download-file-size").text()) ||
    clean($("span.download-file-size").text()) ||
    clean($("div.info-bottom .size").text()) ||
    clean($('li:contains("Size") span').text()) ||
    clean($('li:contains("الحجم") span').text()) ||
    "Unknown";
  let version =
    clean($("a.btn.download-start-btn").attr("data-dt-version")) ||
    clean($("div.details-sdk span.active").text()) ||
    clean($("div.version").text()) ||
    clean($('li:contains("Version") span').text()) ||
    clean($('li:contains("الإصدار") span').text()) ||
    "Unknown";
  return { directDownloadUrl, fileSize, version, downloadPage: url };
};
const parseDownloadFromDetailsPage = async (html) => {
  const $ = cheerio.load(html);
  let downloadPageUrl =
    $("a.download_apk_news").attr("href") ||
    $('a[href*="/download?from="]').attr("href") ||
    $('a[href*="/download?"]').attr("href") ||
    $("a#download_link").attr("href");
  downloadPageUrl = abs(downloadPageUrl);
  let version =
    clean($("div.details-sdk span.active").text()) ||
    clean($("div.version").text()) ||
    clean($('li:contains("Version") span').text()) ||
    clean($('li:contains("الإصدار") span').text()) ||
    "Unknown";
  if (!downloadPageUrl)
    return {
      directDownloadUrl: "Not available",
      fileSize: "Unknown",
      version,
      downloadPage: "Not available",
    };
  const d = await parseDownloadFromDownloadPage(downloadPageUrl);
  if (!d.version || d.version === "Unknown") d.version = version || "Unknown";
  return d;
};
const scrapeAppDetails = async (inputUrl) => {
  const url = inputUrl.includes("/download")
    ? inputUrl.split("/download")[0]
    : inputUrl;
  const { html, url: finalUrl } = await fetchHtml(url, url);
  const $ = cheerio.load(html);
  const title =
    clean($(".title h1").text()) ||
    clean($('h1[itemprop="name"]').text()) ||
    clean($('meta[property="og:title"]').attr("content")) ||
    clean($(".p1").text()) ||
    "Unknown";
  const developer =
    clean($(".developer").text()) ||
    clean($('li:contains("Developer") span').text()) ||
    clean($('li:contains("المطور") span').text()) ||
    clean($('a[itemprop="author"]').text()) ||
    clean($(".p2").text()) ||
    "Unknown";
  const rating =
    clean($(".star").text()) ||
    clean($("[itemprop='ratingValue']").attr("content")) ||
    clean($(".score").text()) ||
    "Not rated";
  let icon =
    $('meta[property="og:image"]').attr("content") ||
    $('img[alt][src]').attr("src") ||
    $("img").attr("src") ||
    "";
  icon = icon ? (icon.startsWith("http") ? icon : abs(icon)) : "";
  const downloadData = inputUrl.includes("/download")
    ? await parseDownloadFromDownloadPage(inputUrl)
    : await parseDownloadFromDetailsPage(html);
  return {
    title,
    developer,
    rating,
    icon,
    url: finalUrl || url,
    directDownloadUrl: downloadData.directDownloadUrl,
    fileSize: downloadData.fileSize,
    version: downloadData.version,
    downloadPage: downloadData.downloadPage,
  };
};
const extractSearchItems = ($) => {
  const seen = new Set();
  const out = [];
  $("ul.search-res li, .search-res li, .search-apps li, li:has(a.dd), div.search-item")
    .toArray()
    .forEach((el) => {
      const $$ = cheerio.load($.html(el));
      const a =
        $$("a.dd").attr("href") ||
        $$("a.package").attr("href") ||
        $$("a[href*='/download?from=details']").attr("href") ||
        $$("a[href]").attr("href");
      const appUrl = abs(a);
      if (!appUrl || seen.has(appUrl)) return;
      seen.add(appUrl);
      const title =
        clean($$(".p1").text()) ||
        clean($$("a.dd").attr("title")) ||
        clean($$("a[href]").text());
      const developer =
        clean($$(".p2").text()) ||
        clean($$(".developer").text()) ||
        clean($$('li:contains("Developer") span').text()) ||
        "Unknown";
      const rating =
        clean($$(".star").text()) ||
        clean($$(".rating").text()) ||
        clean($$("[itemprop='ratingValue']").attr("content")) ||
        "Not rated";
      let icon =
        $$(".icon img").attr("src") ||
        $$(".icon img").attr("data-src") ||
        $$("img").attr("src") ||
        "";
      icon = icon ? (icon.startsWith("http") ? icon : abs(icon)) : "";
      out.push({ title, developer, rating, icon, url: appUrl });
    });
  if (!out.length) {
    $('script[type="application/ld+json"]')
      .toArray()
      .forEach((s) => {
        try {
          const data = JSON.parse($(s).text());
          const items = Array.isArray(data.itemListElement)
            ? data.itemListElement
            : Array.isArray(data)
            ? data
            : [];
          items.forEach((it) => {
            const u =
              abs(it?.url || it?.item?.url || it?.mainEntity?.url) ||
              abs(it?.item?.["@id"]);
            if (!u || seen.has(u)) return;
            seen.add(u);
            out.push({
              title: clean(it?.name || it?.item?.name) || "Unknown",
              developer: "Unknown",
              rating: "Not rated",
              icon: "",
              url: u,
            });
          });
        } catch {}
      });
  }
  return out;
};
const viaApkDownloader = async (q) => {
  const { html, url } = await fetchHtml(
    `${BASE}/apk-downloader/?q=${encodeURIComponent(q)}`,
    BASE + "/"
  );
  if (isBlocked(html)) return [];
  if (url && !/apk-downloader/.test(url)) {
    const app = await scrapeAppDetails(url);
    return [app];
  }
  const $ = cheerio.load(html);
  const items = extractSearchItems($);
  const apps = [];
  for (const it of items.slice(0, 10)) {
    apps.push(await scrapeAppDetails(it.url));
  }
  return apps;
};
const scrapeSearch = async (q, lang, limit) => {
  const urls = [
    `${BASE}/${lang}/search?q=${encodeURIComponent(q)}`,
    `${BASE}/search?q=${encodeURIComponent(q)}`,
  ];
  const results = [];
  for (const u of urls) {
    const { html } = await fetchHtml(u, BASE + "/");
    if (isBlocked(html)) continue;
    const $ = cheerio.load(html);
    const items = extractSearchItems($);
    for (const it of items) {
      if (results.length >= limit) break;
      results.push(it);
    }
    if (results.length >= limit) break;
  }
  if (!results.length) {
    if (/[a-z0-9_]+\.[a-z0-9_.-]+/i.test(q)) {
      const via = await viaApkDownloader(q);
      if (via.length) return via.slice(0, limit);
    }
    const via = await viaApkDownloader(q);
    if (via.length) return via.slice(0, limit);
    return [];
  }
  const tasks = results.slice(0, limit).map((r) => scrapeAppDetails(r.url));
  const settled = await Promise.allSettled(tasks);
  return settled
    .filter((x) => x.status === "fulfilled" && x.value)
    .map((x) => x.value);
};

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const rawUrl = searchParams.get("url");
    const lang = (searchParams.get("lang") || "ar").replace(/[^a-z-]/gi, "") || "ar";
    const limit = Math.min(
      15,
      Math.max(1, parseInt(searchParams.get("limit") || "8", 10))
    );
    const urlParam = rawUrl ? abs(rawUrl) : null;
    if (!q && !urlParam) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى إضافة اسم التطبيق في q أو رابط APKPure صالح في url",
        },
        { status: 400 }
      );
    }
    if (urlParam) {
      const app = await scrapeAppDetails(urlParam);
      if (!app || !app.url) {
        return NextResponse.json(
          {
            owner: "MATUOS-3MK",
            code: 404,
            msg: "لم يتم العثور على التطبيق أو الرابط غير صالح",
          },
          { status: 404 }
        );
      }
      return NextResponse.json({
        owner: "MATUOS-3MK",
        code: 0,
        msg: "success",
        data: app,
      });
    }
    const results = await scrapeSearch(q, lang, limit);
    if (!results.length) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على نتائج لهذا البحث",
        },
        { status: 404 }
      );
    }
    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: { query: q, count: results.length, results },
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "حدث خطأ داخلي في السيرفر",
        error: err.message,
      },
      { status: 500 }
    );
  }
    }
