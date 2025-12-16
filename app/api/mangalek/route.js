// app/api/mangatuk/search/route.js

import { NextResponse } from "next/server";
import * as cheerio from "cheerio"; // تأكد من تثبيت cheerio: npm install cheerio

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    // الحصول على باراميتر البحث (مثال: /api/mangatuk/search?q=Solo)
    const query = searchParams.get("q"); 

    if (!query) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى اضافة اسم مانجا في باراميتر q",
        },
        { status: 400 }
      );
    }

    const encoded = encodeURIComponent(query);
    // بناء رابط البحث بنفس الباراميترات التي كانت في كود axios الأصلي
    const searchUrl = `https://mangatuk.com/?s=${encoded}&post_type=wp-manga`;

    // الهيدر (Headers) التي تم توفيرها في الكود الأصلي
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
        'sec-ch-ua-mobile': '?1',
        'upgrade-insecure-requests': '1',
        'sec-ch-ua-platform': '"Android"',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-dest': 'document', // تم تغييرها من 'empty' لتناسب عملية التصفح
        'referer': 'https://mangatuk.com/', // تم تغييرها إلى النطاق الأساسي
        'accept-language': 'ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6'
    };

    // استخدام fetch بدلاً من axios
    const response = await fetch(searchUrl, {
      method: "GET",
      headers: headers,
      // cache: "no-store", // اختياري: لمنع التخزين المؤقت من جهة Next.js
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: response.status,
          msg: "فشل في الإتصال بموقع مانجاتك",
        },
        { status: 500 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const results = [];

    // سلكتور (Selector) لنتائج البحث الفردية
    // هذا السلكتور يعتمد على البنية الشائعة لمواقع Madara Theme
    $(".c-tabs-item__content .tab-content-wrap .col-6").each((_, el) => {
      const item = $(el);

      // اسم المانجا ورابطها
      const titleLink = item.find(".post-title h3 a").first();
      const title = titleLink.text().trim() || null;
      const url = titleLink.attr("href") || null;

      // صورة البوستر (تستخدم غالبًا data-src للتأجيل (Lazy Load))
      const poster = item.find(".c-image-hover img").first();
      const image = poster.attr("data-src") || poster.attr("src") || null;

      // آخر شابتر
      const latestChapterLink = item.find(".chapter-item .chapter a").first();
      const latestChapterTitle = latestChapterLink.text().trim() || null;
      const latestChapterUrl = latestChapterLink.attr("href") || null;

      if (title && url) {
        results.push({
          title: title,
          url: url,
          image: image,
          latestChapter: latestChapterTitle,
          latestChapterUrl: latestChapterUrl,
        });
      }
    });

    if (!results.length) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على أي مانجا مطابقة لنتيجة البحث",
          data: {
            query,
          },
        },
        { status: 404 }
      );
    }

    // إرجاع النتائج بنجاح
    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: {
        query,
        count: results.length,
        results,
      },
    });
  } catch (err) {
    // معالجة الأخطاء
    console.error(err);
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
 
