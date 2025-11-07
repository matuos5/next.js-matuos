// app/api/download/route.js
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

/**
 * GET /api/download?directUrl=<optional direct mp4 url>&pageUrl=<optional page url>
 *
 * - إذا أرسلت directUrl (رابط mp4 كامل مع query params) => سيرفر سيقوم بعمل fetch لذلك الرابط
 *   مع نفس الـ headers والـ params ثم يقوم بتمرير (stream) الاستجابة للعميل (تحميل مباشر).
 *
 * - إذا أرسلت pageUrl (رابط تيك توك العام) => سيحاول السكربر (مبدئياً) طلب صفحة وسيبحث
 *   في HTML عن رابط mp4 (قد تحتاج خدمة خارجية إذا كان الرابط مخفي خلف JS).
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const directUrl = searchParams.get("directUrl"); // رابط فيديو مباشر (.mp4) مع params
    const pageUrl = searchParams.get("pageUrl"); // رابط صفحة (مثلاً tiktok.com/...)
    const ownerTag = "MATUOS-3MK";

    if (!directUrl && !pageUrl) {
      return NextResponse.json(
        { owner: ownerTag, code: 400, msg: "يرجى اضافة directUrl أو pageUrl" },
        { status: 400 }
      );
    }

    // --------- وضع A: proxy لفيديو مباشر (مثل fbcdn .mp4) ----------
    if (directUrl) {
      // إذا أردت ضمّ الـ params المشابهة للـ axios الذي أرسلتَه،
      // يمكن السماح بتمرير كل الـ query params من العميل أو استخدام قائمة ثابتة.
      // هنا سنقوم ببناء طلب fetch مباشر مع نفس الـ headers الأساسية.
      const fetchHeaders = {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
        "Accept-Encoding": "identity;q=1, *;q=0",
        "sec-ch-ua": '"Chromium";v="139", "Not;A=Brand";v="99"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-site": "cross-site",
        "sec-fetch-mode": "no-cors",
        "sec-fetch-dest": "video",
        "referer": "https://fdownloader.net/",
        "accept-language": "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6",
        // Range header يدعم الاستئناف من العميل، إذا جاء من المتصفح سيُمرّر كما هو:
        ...(req.headers.get("range") ? { range: req.headers.get("range") } : {}),
      };

      // قم بعمل fetch للرابط المباشر (GET)
      const upstream = await fetch(directUrl, {
        method: "GET",
        headers: fetchHeaders,
      });

      if (!upstream.ok || !upstream.body) {
        // إذا لم نستطع جلب الفيديو، أعد رسالة خطأ مع كود الحالة
        return NextResponse.json(
          {
            owner: ownerTag,
            code: 404,
            msg: "لم يتم العثور على الملف أو رفض الخادم البعيد الاتصال",
            status: upstream.status,
          },
          { status: 502 }
        );
      }

      // نمرر headers مهمة للعميل (Content-Type, Content-Length إن وُجد)
      const respHeaders = {};
      const contentType = upstream.headers.get("content-type");
      const contentLength = upstream.headers.get("content-length");
      const acceptRanges = upstream.headers.get("accept-ranges");
      if (contentType) respHeaders["Content-Type"] = contentType;
      if (contentLength) respHeaders["Content-Length"] = contentLength;
      if (acceptRanges) respHeaders["Accept-Ranges"] = acceptRanges;
      // حافظ على كاش أو سيكيور هيدرز عند الحاجة

      // نعيد Stream مباشرةً إلى العميل (يمكن للمتصفح التعامل معها كتحميل أو تشغيل)
      return new Response(upstream.body, {
        status: upstream.status,
        headers: respHeaders,
      });
    }

    // --------- وضع B: محاولة استخلاص رابط الفيديو من صفحة تيك توك ----------
    if (pageUrl) {
      // ملاحظة مهمة:
      // - تيك توك عادة يولّد روابط الفيديو عبر JavaScript أو محركات ثالثة؛ قد لا تجد رابط mp4 صريح في الـ HTML.
      // - إذا لم يظهر رابط mp4 في HTML، الحل العملي هو استخدام خدمة API خارجية مُخصّصة (مثل خدمات تنزيل تيك توك)
      //   أو تنفيذ متصفح رئيسي (puppeteer/Playwright) لتنفيذ JS واستخلاص الروابط.
      // هنا مثال مبدئي: نحمّل الصفحة ثم نبحث في الـ HTML عن أي وصلة تحتوي ".mp4"

      const pageRes = await fetch(pageUrl, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
          Referer: pageUrl,
        },
      });

      if (!pageRes.ok) {
        return NextResponse.json(
          {
            owner: ownerTag,
            code: 404,
            msg: "تعذّر جلب صفحة الفيديو",
            status: pageRes.status,
          },
          { status: 502 }
        );
      }

      const html = await pageRes.text();
      const $ = cheerio.load(html);
      let videoUrl;

      // بحث بسيط في الروابط عن .mp4
      $("a, source, video").each((_, el) => {
        const href = $(el).attr("href") || $(el).attr("src");
        if (href && href.includes(".mp4")) videoUrl = href;
      });

      // بعض صفحات TikTok تضيف JSON داخل <script id="__NEXT_DATA__"> أو متغير window
      if (!videoUrl) {
        // محاولة استخراج JSON داخل السكربتات
        const scripts = $("script")
          .map((i, el) => $(el).html())
          .get()
          .join("\n");

        // بحث عن روابط مباشرة مشابهة
        const mp4Match = scripts.match(/https?:\/\/[^'"\s]+\.mp4[^'"\s]*/);
        if (mp4Match) videoUrl = mp4Match[0];
      }

      if (!videoUrl) {
        return NextResponse.json(
          {
            owner: ownerTag,
            code: 404,
            msg:
              "لم يتم العثور على رابط mp4 داخل HTML. قد تحتاج لاستخدام خدمة تنزيل/محرّك جافاسكربت (puppeteer) أو API خارجية.",
            note:
              "اقتراح: استخدم خدمة وسيطة مخصصة لتنزيل TikTok أو اشتغل بمتصفح بدون رأس (puppeteer) لتنفيذ JS واستخراج الرابط.",
          },
          { status: 404 }
        );
      }

      // إن وُجد رابط mp4 نعيده كـ JSON (أو يمكن عمل proxy كما في الوضع A)
      return NextResponse.json({
        owner: ownerTag,
        code: 0,
        msg: "success",
        data: {
          source: pageUrl,
          link: videoUrl,
        },
      });
    }

    // fallback (لا يجب الوصول هنا)
    return NextResponse.json({ owner: ownerTag, code: 400, msg: "bad request" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { owner: "MATUOS-3MK", code: 500, msg: "خطأ داخلي", error: err.message },
      { status: 500 }
    );
  }
  } 
