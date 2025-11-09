// app/api/wahmi/route.js
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36";

const BASE_HEADERS = {
  "User-Agent": UA,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "accept-language": "ar-SY,ar;q=0.6",
  Referer: "https://wahmi.org/",
};

function isWahmiUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.hostname === "wahmi.org";
  } catch {
    return false;
  }
}

function absolutize(base, maybeRelative) {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}

function getFilenameFromDisposition(dispo) {
  if (!dispo) return undefined;
  const m =
    /filename\*?=(?:UTF-8''|")?([^";\r\n]+)(?:")?/i.exec(dispo) ||
    /filename="?([^"]+)"?/i.exec(dispo);
  if (m && m[1]) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return undefined;
}

async function headOrLightGet(url, referer) {
  return fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: {
      ...BASE_HEADERS,
      Referer: referer ?? new URL(url).origin,
      Range: "bytes=0-0", // طلب خفيف بديل عن HEAD
    },
  });
}

async function fetchHtml(url, referer) {
  return fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: {
      ...BASE_HEADERS,
      Referer: referer ?? new URL(url).origin,
    },
  });
}

function isDownloadableContent(ct) {
  if (!ct) return false;
  const lower = ct.toLowerCase();
  return (
    lower.startsWith("video/") ||
    lower.startsWith("audio/") ||
    lower.startsWith("application/octet-stream") ||
    lower === "application/zip" ||
    lower === "application/x-rar-compressed" ||
    lower.includes("application/pdf")
  );
}

async function resolveWahmiDirectLink(initialUrl) {
  let currentUrl = initialUrl;
  let lastReferer = "https://wahmi.org/";
  const maxHops = 5;

  for (let i = 0; i < maxHops; i++) {
    // فحص سريع للرابط الحالي
    const probe = await headOrLightGet(currentUrl, lastReferer);

    // تحويلات 3xx
    if (probe.status >= 300 && probe.status < 400) {
      const loc = probe.headers.get("location");
      if (!loc) break;
      const nextUrl = absolutize(currentUrl, loc);
      lastReferer = currentUrl;
      currentUrl = nextUrl;
      continue;
    }

    const ct = probe.headers.get("content-type");
    const dispo = probe.headers.get("content-disposition");
    const cl = probe.headers.get("content-length");

    if (isDownloadableContent(ct) || dispo) {
      return {
        directUrl: currentUrl,
        contentType: ct || undefined,
        contentLength: cl ? Number(cl) : undefined,
        filename: getFilenameFromDisposition(dispo),
      };
    }

    // جلب HTML والبحث عن روابط تحميل بداخل الصفحة
    const htmlRes = await fetchHtml(currentUrl, lastReferer);
    const htmlCT = htmlRes.headers.get("content-type") || "";
    const html = await htmlRes.text();

    // لو ليس HTML، نعتبره محاولة مباشرة
    if (!htmlCT.toLowerCase().includes("text/html")) {
      return {
        directUrl: currentUrl,
        contentType: htmlCT || undefined,
        contentLength: htmlRes.headers.get("content-length")
          ? Number(htmlRes.headers.get("content-length"))
          : undefined,
        filename: getFilenameFromDisposition(
          htmlRes.headers.get("content-disposition")
        ),
      };
    }

    const $ = cheerio.load(html);
    let candidate = null;

    // مرشّحات شائعة داخل صفحات wahmi
    $('a[href*="/download/"], a[href$=".mp4"], a[download], source[src$=".mp4"]').each(
      (_, el) => {
        const href = $(el).attr("href") || $(el).attr("src");
        if (href && !candidate) {
          candidate = absolutize(currentUrl, href);
        }
      }
    );

    // بعض الصفحات تستخدم جافاسكربت للتوجيه: location.href='...'
    if (!candidate) {
      const jsMatch =
        /location\.href\s*=\s*['"]([^'"]+)['"]/i.exec(html) ||
        /window\.open\s*\(\s*['"]([^'"]+)['"]/i.exec(html);
      if (jsMatch && jsMatch[1]) {
        candidate = absolutize(currentUrl, jsMatch[1]);
      }
    }

    if (candidate) {
      const test = await headOrLightGet(candidate, currentUrl);
      const ct2 = test.headers.get("content-type");
      const dispo2 = test.headers.get("content-disposition");
      const cl2 = test.headers.get("content-length");

      if (isDownloadableContent(ct2) || dispo2) {
        return {
          directUrl: candidate,
          contentType: ct2 || undefined,
          contentLength: cl2 ? Number(cl2) : undefined,
          filename: getFilenameFromDisposition(dispo2),
        };
      }

      // إذا ما زال HTML، نكرر الدورة على الرابط الجديد
      currentUrl = candidate;
      lastReferer = currentUrl;
      continue;
    }

    // لو لم نجد أي مرشح
    return {
      directUrl: currentUrl,
      contentType: ct || "text/html",
      contentLength: cl ? Number(cl) : undefined,
      filename: getFilenameFromDisposition(dispo),
    };
  }

  throw new Error("تعذر تحديد رابط التحميل المباشر بعد عدة محاولات");
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const fileUrl = searchParams.get("url");

    if (!fileUrl) {
      return NextResponse.json(
        { owner: "MATUOS-3MK", code: 400, msg: "يرجى إضافة رابط صالح من wahmi.org عبر الوسيط url" },
        { status: 400 }
      );
    }

    if (!isWahmiUrl(fileUrl)) {
      return NextResponse.json(
        { owner: "MATUOS-3MK", code: 400, msg: "الرابط يجب أن يكون ضمن نطاق wahmi.org" },
        { status: 400 }
      );
    }

    const resolved = await resolveWahmiDirectLink(fileUrl);

    if (!resolved?.directUrl) {
      return NextResponse.json(
        { owner: "MATUOS-3MK", code: 404, msg: "لم يتم العثور على رابط التحميل" },
        { status: 404 }
      );
    }

    // fallback لاسم الملف من الرابط لو السيرفر ما أرسله
    let filename = resolved.filename;
    if (!filename) {
      try {
        const pathname = new URL(resolved.directUrl).pathname;
        const last = decodeURIComponent(pathname.split("/").pop() || "");
        if (last) filename = last;
      } catch {}
    }

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: {
        link: resolved.directUrl,
        filename: filename || "unknown",
        contentType: resolved.contentType || "unknown",
        size: resolved.contentLength ?? null,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { owner: "MATUOS-3MK", code: 500, msg: "حدث خطأ داخلي في السيرفر", error: err?.message || String(err) },
      { status: 500 }
    );
  }
  } 
