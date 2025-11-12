import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE = "https://apkpure.com";
const LOCALE = "ar";
const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36";

const clean = (s) => (s ? s.replace(/\s+/g, " ").trim() : "");
const abs = (u) => {
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("/")) return BASE + u;
  return `${BASE}/${u.replace(/^\/+/, "")}`;
};
const buildHeaders = (ref) => ({
  "User-Agent": UA,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "ar,en;q=0.9",
  Referer: ref || `${BASE}/${LOCALE}/`,
});
const fetchHtml = async (url, ref) => {
  const res = await fetch(url, {
    method: "GET",
    headers: buildHeaders(ref),
    cache: "no-store",
    next: { revalidate: 0 },
  });
  const html = await res.text();
  return html;
};
const parseDownloadFromDownloadPage = async (downloadPageUrl) => {
  const html = await fetchHtml(downloadPageUrl, downloadPageUrl);
  const $ = cheerio.load(html);
  let directDownloadUrl =
    $("a.btn.download-start-btn").attr("href") ||
    $("a#download_link").attr("href") ||
    $("a.download-button").attr("href");
  if (!directDownloadUrl) {
    const meta = $('meta[http-equiv="refresh"]').attr("content");
    if (meta && /url=/i.test(meta)) {
      const m = meta.match(/url=(.*)$/i);
      if (m) directDownloadUrl = decodeURIComponent(m[1]);
    }
  }
  directDownloadUrl = abs(directDownloadUrl) || "Not available";
  let fileSize =
    clean($("a.btn.download-start-btn .download-file-size").text()) ||
    clean($("span.download-file-size").text()) ||
    clean($("div.info-bottom .size").text()) ||
    clean($('li:contains("Size") span').text()) ||
    clean($('li:contains("الحجم") span').text()) ||
    "Unknown";
  let version =
    clean($("a.btn.download-start-btn").attr("data-dt-version")) ||
    clean($("div.version").text()) ||
    clean($('li:contains("Version") span').text()) ||
    clean($('li:contains("الإصدار") span').text()) ||
    "";
  return { directDownloadUrl, fileSize, version, downloadPage: downloadPageUrl };
};
const parseDownloadFromDetailsPage = async (detailsHtml, detailsUrl) => {
  const $ = cheerio.load(detailsHtml);
  let downloadPageUrl =
    $("a.download_apk_news").attr("href") ||
    $('a[href*="/download?from="]').attr("href") ||
    $('a[href*="/download?"]').attr("href");
  downloadPageUrl = abs(downloadPageUrl);
  let version =
    clean($("div.details-sdk span.active").text()) ||
    clean($('li:contains("Version") span').text()) ||
    clean($('li:contains("الإصدار") span').text()) ||
    clean($("div.version").text()) ||
    "";
  if (!downloadPageUrl) {
    let direct = $("a#download_link").attr("href");
    if (direct)
      return { ...(await parseDownloadFromDownloadPage(abs(direct))), version };
    return {
      directDownloadUrl: "Not available",
      fileSize: "Unknown",
      version: version || "Unknown",
      downloadPage: "Not available",
    };
  }
  const downloadData = await parseDownloadFromDownloadPage(downloadPageUrl);
  if (!downloadData.version && version) downloadData.version = version;
  if (!downloadData.version) downloadData.version = "Unknown";
  return downloadData;
};
const scrapeAppDetails = async (appUrl) => {
  const detailsUrl = appUrl.includes("/download")
    ? appUrl.split("/download")[0]
    : appUrl;
  const html = await fetchHtml(detailsUrl, detailsUrl);
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
  const downloadData = appUrl.includes("/download")
    ? await parseDownloadFromDownloadPage(appUrl)
    : await parseDownloadFromDetailsPage(html, detailsUrl);
  return {
    title,
    developer,
    rating,
    icon,
    url: detailsUrl,
    directDownloadUrl: downloadData.directDownloadUrl,
    fileSize: downloadData.fileSize,
    version: downloadData.version,
    downloadPage: downloadData.downloadPage,
  };
};
const scrapeSearch = async (q) => {
  const searchUrl = `${BASE}/${LOCALE}/search?q=${encodeURIComponent(q)}`;
  const html = await fetchHtml(searchUrl, `${BASE}/${LOCALE}/`);
  const $ = cheerio.load(html);
  let resultEls = $(".search-res li").toArray();
  if (!resultEls.length) resultEls = $("ul.search-res li").toArray();
  if (!resultEls.length) resultEls = $('li:has(a.dd)').toArray();
  const tasks = resultEls.map(async (el) => {
    const $$ = cheerio.load($.html(el));
    let appRel = $$("a.dd").attr("href") || $$("a[href]").attr("href");
    const appUrl = abs(appRel);
    if (!appUrl) return null;
    const preTitle =
      clean($$(".p1").text()) ||
      clean($$("a.dd").attr("title")) ||
      clean($$("a[href]").text());
    const preDev =
      clean($$(".p2").text()) || clean($$(".developer").text()) || "Unknown";
    const preRating =
      clean($$(".star").text()) || clean($$(".rating").text()) || "Not rated";
    let preIcon =
      $$(".icon img").attr("src") ||
      $$(".icon img").attr("data-src") ||
      $$("img").attr("src") ||
      "";
    preIcon = preIcon ? (preIcon.startsWith("http") ? preIcon : abs(preIcon)) : "";
    const details = await scrapeAppDetails(appUrl);
    return {
      title: details.title || preTitle,
      developer: details.developer || preDev,
      rating: details.rating || preRating,
      icon: details.icon || preIcon,
      url: details.url,
      directDownloadUrl: details.directDownloadUrl,
      fileSize: details.fileSize,
      version: details.version || "Unknown",
      downloadPage: details.downloadPage,
    };
  });
  const settled = await Promise.allSettled(tasks);
  const results = settled
    .filter((x) => x.status === "fulfilled" && x.value)
    .map((x) => x.value);
  return results;
};

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const rawUrl = searchParams.get("url");
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
    const results = await scrapeSearch(q);
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
