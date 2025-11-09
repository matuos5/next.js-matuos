// app/api/witanime/route.js
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36";

const BASE_HEADERS = {
  "User-Agent": UA,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "sec-ch-ua": '"Not;A=Brand";v="99", "Brave";v="139", "Chromium";v="139"',
  "sec-ch-ua-mobile": "?1",
  "sec-ch-ua-platform": '"Android"',
  "upgrade-insecure-requests": "1",
  "sec-gpc": "1",
  "accept-language": "ar-SY,ar;q=0.6",
  "sec-fetch-site": "same-origin",
  "sec-fetch-mode": "navigate",
  "sec-fetch-user": "?1",
  "sec-fetch-dest": "document",
  priority: "u=0, i",
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
  // بعض الخوادم لا تقبل HEAD -> نستخدم GET مع Range خفيف
  const res = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: {
      ...BASE_HEADERS,
      Referer: referer ?? new URL(url).origin,
      Range: "bytes=0-0",
    },
  });
  return res;
}

async function fetchHtml(url, referer) {
  const res = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: {
      ...BASE_HEADERS,
      Referer: referer ?? new URL(url).origin,
    },
  });
  return res;
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
    const probe = await headOrLightGet(currentUrl, lastReferer);

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

    // HTML parsing path
    const htmlRes = await fetchHtml(currentUrl, lastReferer);

    if (htmlRes.status >= 300 && htmlRes.status < 400) {
      const loc = htmlRes.headers.get("location");
      if (!loc) break;
      const nextUrl = absolutize(currentUrl, loc);
      lastReferer = currentUrl;
      currentUrl = nextUrl;
      continue;
    }

    const htmlCT = htmlRes.headers.get("content-type") || "";
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

    const html = await htmlRes.text();
    const $ = cheerio.load(html);

    const candidates = new Set();

    $('a[href*="/download/"]').each((_, el) => {
      const href = $(el).attr("href");
      if (href) candidates.add(absolutize(currentUrl, href));
    });

    $('a[href$=".mp4"], a[href$=".zip"], a[href$=".rar"], a[href$=".pdf"]').each(
      (_, el) => {
        const href = $(el).attr("href");
        if (href) candidates.add(absolutize(currentUrl, href));
      }
    );

    $('a[download], a[rel="nofollow"][href]').each((_, el) => {
      const href = $(el).attr("href");
      if (href) candidates.add(absolutize(currentUrl, href));
    });

    $("source[src]").each((_, el) => {
      const src = $(el).attr("src");
      if (src) candidates.add(absolutize(currentUrl, src));
    });

    for (const candidate of candidates) {
      const test = await headOrLightGet(candidate, currentUrl);
      if (test.status >= 300 && test.status < 400) {
        const loc = test.headers.get("location");
        const finalUrl = loc ? absolutize(candidate, loc) : candidate;
        const test2 = await headOrLightGet(finalUrl, candidate);
        const ct2 = test2.headers.get("content-type");
        const dispo2 = test2.headers.get("content-disposition");
        const cl2 = test2.headers.get("content-length");
        if (isDownloadableContent(ct2) || dispo2) {
          return {
            directUrl: finalUrl,
            contentType: ct2 || undefined,
            contentLength: cl2 ? Number(cl2) : undefined,
            filename: getFilenameFromDisposition(dispo2),
          };
        }
      } else {
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
      }
    }

    // fallback
    return {
      directUrl: currentUrl,
      contentType: ct || undefined,
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
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على رابط التحميل",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: {
        link: resolved.directUrl,
        filename: resolved.filename ?? "unknown",
        contentType: resolved.contentType ?? "unknown",
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
  }  } catch {
    return maybeRelative;
  }
}

function getFilenameFromDisposition(dispo?: string | null) {
  if (!dispo) return undefined;
  // content-disposition: attachment; filename="example.mp4"
  const m =
    /filename\*?=(?:UTF-8''|")?([^";\r\n]+)(?:")?/i.exec(dispo) ||
    /filename="?([^"]+)"?/i.exec(dispo);
  if (m && m[1]) {
    try {
      // decode RFC5987 if needed
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return undefined;
}

async function headOrLightGet(url: string, referer?: string) {
  // بعض الاستضافات لا تقبل HEAD؛ نستخدم GET خفيف عبر Range
  const res = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: {
      ...BASE_HEADERS,
      Referer: referer ?? new URL(url).origin,
      Range: "bytes=0-0",
    },
  });
  return res;
}

async function fetchHtml(url: string, referer?: string) {
  const res = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: {
      ...BASE_HEADERS,
      Referer: referer ?? new URL(url).origin,
    },
  });
  return res;
}

function isDownloadableContent(ct?: string | null) {
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

async function resolveWahmiDirectLink(initialUrl: string) {
  let currentUrl = initialUrl;
  let lastReferer = "https://wahmi.org/";
  const maxHops = 5;

  for (let i = 0; i < maxHops; i++) {
    // محاولة سريعة لمعرفة إن كان الرابط مباشر
    const probe = await headOrLightGet(currentUrl, lastReferer);

    // 3xx redirect manual
    if (probe.status >= 300 && probe.status < 400) {
      const loc = probe.headers.get("location");
      if (!loc) break; // لا يوجد location
      const nextUrl = absolutize(currentUrl, loc);
      lastReferer = currentUrl;
      currentUrl = nextUrl;
      continue;
    }

    const ct = probe.headers.get("content-type");
    const dispo = probe.headers.get("content-disposition");
    const cl = probe.headers.get("content-length");

    if (isDownloadableContent(ct) || dispo) {
      // يبدو رابط مباشر
      return {
        directUrl: currentUrl,
        contentType: ct ?? undefined,
        contentLength: cl ? Number(cl) : undefined,
        filename: getFilenameFromDisposition(dispo),
      };
    }

    // إن لم يكن مباشر، قد تكون صفحة HTML تحتوي زر/رابط التحميل
    // نجلب HTML كامل ونستخرج الرابط
    const htmlRes = await fetchHtml(currentUrl, lastReferer);

    if (htmlRes.status >= 300 && htmlRes.status < 400) {
      const loc = htmlRes.headers.get("location");
      if (!loc) break;
      const nextUrl = absolutize(currentUrl, loc);
      lastReferer = currentUrl;
      currentUrl = nextUrl;
      continue;
    }

    const htmlCT = htmlRes.headers.get("content-type") || "";
    if (!htmlCT.toLowerCase().includes("text/html")) {
      // ليس HTML ولا قابل تحميل بشكل واضح—نعتبره مباشر على أي حال
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

    const html = await htmlRes.text();
    const $ = cheerio.load(html);

    // احتمالات روابط التحميل في wahmi.org
    // 1) روابط تحت /download/...
    // 2) أزرار/روابط تحتوي mp4/zip/pdf ... إلخ
    // 3) عناصر <source> أو <a download>
    const candidates = new Set<string>();

    $('a[href*="/download/"]').each((_, el) => {
      const href = $(el).attr("href");
      if (href) candidates.add(absolutize(currentUrl, href));
    });

    $('a[href$=".mp4"], a[href$=".zip"], a[href$=".rar"], a[href$=".pdf"]').each(
      (_, el) => {
        const href = $(el).attr("href");
        if (href) candidates.add(absolutize(currentUrl, href));
      }
    );

    $('a[download], a[rel="nofollow"][href]').each((_, el) => {
      const href = $(el).attr("href");
      if (href) candidates.add(absolutize(currentUrl, href));
    });

    $("source[src]").each((_, el) => {
      const src = $(el).attr("src");
      if (src) candidates.add(absolutize(currentUrl, src));
    });

    // إن وجدنا مرشّحًا، نتحقق منه بنفس أسلوب الـ probe
    for (const candidate of candidates) {
      const test = await headOrLightGet(candidate, currentUrl);
      if (test.status >= 300 && test.status < 400) {
        const loc = test.headers.get("location");
        const finalUrl = loc ? absolutize(candidate, loc) : candidate;
        const test2 = await headOrLightGet(finalUrl, candidate);
        const ct2 = test2.headers.get("content-type");
        const dispo2 = test2.headers.get("content-disposition");
        const cl2 = test2.headers.get("content-length");
        if (isDownloadableContent(ct2) || dispo2) {
          return {
            directUrl: finalUrl,
            contentType: ct2 ?? undefined,
            contentLength: cl2 ? Number(cl2) : undefined,
            filename: getFilenameFromDisposition(dispo2),
          };
        }
      } else {
        const ct2 = test.headers.get("content-type");
        const dispo2 = test.headers.get("content-disposition");
        const cl2 = test.headers.get("content-length");
        if (isDownloadableContent(ct2) || dispo2) {
          return {
            directUrl: candidate,
            contentType: ct2 ?? undefined,
            contentLength: cl2 ? Number(cl2) : undefined,
            filename: getFilenameFromDisposition(dispo2),
          };
        }
      }
    }

    // إن لم نجد شيئًا واضحًا نعيد الرابط الحالي كمحاولة أخيرة
    return {
      directUrl: currentUrl,
      contentType: ct ?? undefined,
      contentLength: cl ? Number(cl) : undefined,
      filename: getFilenameFromDisposition(dispo),
    };
  }

  // لو تجاوزنا عدد التحويلات
  throw new Error("تعذر تحديد رابط التحميل المباشر بعد عدة محاولات");
}

export async function GET(req: Request) {
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
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على رابط التحميل",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: {
        link: resolved.directUrl,
        filename: resolved.filename ?? "unknown",
        contentType: resolved.contentType ?? "unknown",
        // الحجم بالبايت إن توفر
        size: resolved.contentLength ?? null,
      },
    });
  } catch (err: any) {
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
