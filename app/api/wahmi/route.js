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

// ========== Helpers ==========
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

function filenameFromUrl(urlStr) {
  try {
    const p = new URL(urlStr).pathname;
    const base = p.split("/").pop() || "";
    return base ? decodeURIComponent(base) : undefined;
  } catch {
    return undefined;
  }
}

function isDownloadableContent(ct) {
  if (!ct) return false;
  const lower = ct.toLowerCase();
  return (
    lower.startsWith("video/") ||
    lower.startsWith("audio/") ||
    lower.startsWith("image/") ||
    lower.startsWith("application/octet-stream") ||
    lower === "application/zip" ||
    lower === "application/x-rar-compressed" ||
    lower.includes("application/pdf")
  );
}

async function headOrLightGet(url, referer) {
  // بديل آمن عن HEAD (بعض الخوادم تمنعه)
  return fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: {
      ...BASE_HEADERS,
      Referer: referer ?? new URL(url).origin,
      Range: "bytes=0-0",
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

// يحاول إيجاد رابط الملف الحقيقي حتى لو الصفحة وسيطة
async function resolveWahmiDirectLink(initialUrl) {
  let currentUrl = initialUrl;
  let lastReferer = "https://wahmi.org/";
  const maxHops = 7;

  for (let i = 0; i < maxHops; i++) {
    // 1) فحص سريع
    const probe = await headOrLightGet(currentUrl, lastReferer);

    // 1.a) تحويلات 3xx
    if (probe.status >= 300 && probe.status < 400) {
      const loc = probe.headers.get("location");
      if (!loc) break;
      currentUrl = absolutize(currentUrl, loc);
      lastReferer = currentUrl;
      continue;
    }

    const ct = probe.headers.get("content-type");
    const dispo = probe.headers.get("content-disposition");
    const cl = probe.headers.get("content-length");

    // 1.b) لو واضح أنه ملف
    if (isDownloadableContent(ct) || dispo) {
      return {
        directUrl: currentUrl,
        contentType: ct || undefined,
        contentLength: cl ? Number(cl) : undefined,
        filename: getFilenameFromDisposition(dispo) || filenameFromUrl(currentUrl),
      };
    }

    // 2) HTML: حلّل الصفحة بحثًا عن الرابط الفعلي
    const htmlRes = await fetchHtml(currentUrl, lastReferer);
    const htmlCT = htmlRes.headers.get("content-type") || "";
    const html = await htmlRes.text();

    // لو مش HTML رغم أن probe ما كان ملف واضح—اعتبره محاولة مباشرة
    if (!htmlCT.toLowerCase().includes("text/html")) {
      return {
        directUrl: currentUrl,
        contentType: htmlCT || undefined,
        contentLength: htmlRes.headers.get("content-length")
          ? Number(htmlRes.headers.get("content-length"))
          : undefined,
        filename:
          getFilenameFromDisposition(htmlRes.headers.get("content-disposition")) ||
          filenameFromUrl(currentUrl),
      };
    }

    const $ = cheerio.load(html);
    let candidate = null;

    // 2.a) روابط تحميل شائعة داخل الصفحة
    // أولويات: mp4 مباشرة، ثم /download/، ثم عناصر <source>، ثم a[download]
    $('a[href*=".mp4"]').each((_, el) => {
      if (!candidate) {
        const href = $(el).attr("href");
        if (href) candidate = absolutize(currentUrl, href);
      }
    });
    if (!candidate) {
      $('source[src*=".mp4"]').each((_, el) => {
        if (!candidate) {
          const src = $(el).attr("src");
          if (src) candidate = absolutize(currentUrl, src);
        }
      });
    }
    if (!candidate) {
      $('a[href*="/download/"]').each((_, el) => {
        if (!candidate) {
          const href = $(el).attr("href");
          if (href) candidate = absolutize(currentUrl, href);
        }
      });
    }
    if (!candidate) {
      $("a[download]").each((_, el) => {
        if (!candidate) {
          const href = $(el).attr("href");
          if (href) candidate = absolutize(currentUrl, href);
        }
      });
    }

    // 2.b) تحويلات عبر جافاسكربت أو meta refresh
    if (!candidate) {
      const jsMatch =
        /(?:window\.open|location\.href|location\.assign)\s*=\s*['"]([^'"]+)['"]/i.exec(
          html
        );
      if (jsMatch && jsMatch[1]) {
        candidate = absolutize(currentUrl, jsMatch[1]);
      }
    }
    if (!candidate) {
      const meta = $('meta[http-equiv="refresh"]').attr("content");
      if (meta) {
        const match = /url=(.+)/i.exec(meta);
        if (match && match[1]) candidate = absolutize(currentUrl, match[1]);
      }
    }

    // 3) لو وجدنا رابط محتمل—تحقّق منه
    if (candidate) {
      const test = await headOrLightGet(candidate, currentUrl);

      // اتبع تحويلات محتملة للرابط المرشح
      let finalUrl = candidate;
      if (test.status >= 300 && test.status < 400) {
        const loc2 = test.headers.get("location");
        if (loc2) finalUrl = absolutize(candidate, loc2);
      }

      const test2 =
        test.status >= 300 && test.status < 400
          ? await headOrLightGet(finalUrl, candidate)
          : test;

      const ct2 = test2.headers.get("content-type");
      const dispo2 = test2.headers.get("content-disposition");
      const cl2 = test2.headers.get("content-length");

      if (isDownloadableContent(ct2) || dispo2) {
        return {
          directUrl: finalUrl,
          contentType: ct2 || undefined,
          contentLength: cl2 ? Number(cl2) : undefined,
          filename:
            getFilenameFromDisposition(dispo2) ||
            filenameFromUrl(finalUrl) ||
            filenameFromUrl(candidate),
        };
      }

      // لو ما زال HTML، كرر الدورة على المرشح
      currentUrl = finalUrl;
      lastReferer = currentUrl;
      continue;
    }

    // 4) fallback: لم نجد أي رابط داخل الصفحة
    return {
      directUrl: currentUrl,
      contentType: ct || "text/html",
      contentLength: cl ? Number(cl) : undefined,
      filename: getFilenameFromDisposition(dispo) || filenameFromUrl(currentUrl),
    };
  }

  throw new Error("تعذر تحديد رابط التحميل المباشر بعد تحليل الصفحات");
}

// ========== Next.js GET Route ==========
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const fileUrl = searchParams.get("url");

    if (!fileUrl) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى إضافة رابط صالح من wahmi.org عبر الوسيط url",
        },
        { status: 400 }
      );
    }

    if (!isWahmiUrl(fileUrl)) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "الرابط يجب أن يكون ضمن نطاق wahmi.org",
        },
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

    // تأمين اسم ملف حتى لو السيرفر ما أرسله
    let filename = resolved.filename || filenameFromUrl(resolved.directUrl) || "unknown";

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: {
        link: resolved.directUrl,
        filename,
        contentType: resolved.contentType || "unknown",
        size: resolved.contentLength ?? null,
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
