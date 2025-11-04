import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import axios from "axios";

/**
 * API endpoint: /api/media?url=<رابط_ميديافاير>
 * 
 * يحدد إن كان الرابط صفحة عرض (مثل https://www.mediafire.com/file/...)
 * ثم يستخرج منها رابط التحميل المباشر،
 * وبعدها يعيد توجيه المستخدم أو يحمل الملف.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { code: 400, msg: "❌ يرجى تمرير الرابط ?url=" },
        { status: 400 }
      );
    }

    // headers لتقليد متصفح حقيقي
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10; MAR-LX1A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.122 Mobile Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "ar,en;q=0.9",
    };

    // 🔹 لو كان الرابط مباشر (downloadXXX.mediafire.com)
    if (url.includes("download") && url.includes("mediafire.com")) {
      // نجرب نعمل HEAD أو GET صغير لتأكيد وجود الملف
      const response = await axios.head(url, { headers }).catch(() => null);

      if (!response || response.status >= 400) {
        return NextResponse.json(
          { code: 404, msg: "❌ الرابط غير صالح أو الملف غير موجود." },
          { status: 404 }
        );
      }

      // إعادة توجيه مباشر إلى الرابط
      return NextResponse.redirect(url);
    }

    // 🔹 أما لو الرابط صفحة (مثل https://www.mediafire.com/file/xxxx)
    const apiUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const res = await fetch(apiUrl, { headers });
    const html = await res.text();

    // استخراج رابط التحميل من الصفحة
    const $ = cheerio.load(html);

    let downloadLink = $(`a[aria-label="Download file"]`).attr("href");

    // fallback لبعض تنسيقات ميديافاير الجديدة
    if (!downloadLink) {
      $("a").each((_, el) => {
        const href = $(el).attr("href");
        if (href && href.includes("download") && href.includes("mediafire.com")) {
          downloadLink = href;
        }
      });
    }

    if (!downloadLink) {
      return NextResponse.json(
        {
          code: 404,
          msg: "❌ لم يتم العثور على رابط التحميل المباشر داخل الصفحة.",
        },
        { status: 404 }
      );
    }

    // إعادة توجيه المستخدم إلى رابط التحميل المباشر
    return NextResponse.redirect(downloadLink);
  } catch (err) {
    return NextResponse.json(
      {
        code: 500,
        msg: "❌ خطأ داخلي أثناء معالجة الرابط.",
        error: err.message,
      },
      { status: 500 }
    );
  }
        } 
