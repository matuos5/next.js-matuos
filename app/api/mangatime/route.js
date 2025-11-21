// app/api/mangatime/search/route.js

import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q"); // مثال: /api/mangatime/search?q=Boruto

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

    const response = await fetch(
      `https://mangatime.org/search?q=${encoded}`,
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "sec-ch-ua": '"Chromium";v="139", "Not;A=Brand";v="99"',
          "sec-ch-ua-mobile": "?1",
          "sec-ch-ua-platform": '"Android"',
          "upgrade-insecure-requests": "1",
          "sec-fetch-site": "same-origin",
          "sec-fetch-mode": "navigate",
          "sec-fetch-user": "?1",
          "sec-fetch-dest": "document",
          "referer": "https://mangatime.org/",
          "accept-language":
            "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6",
        },
        // تعطيل كاش Next.js (اختياري حسب احتياجك)
        // cache: "no-store",
        // next: { revalidate: 0 },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: response.status,
          msg: "فشل في الإتصال بموقع مانجا تايم",
        },
        { status: 500 }
      );
    }

    const html = await response.text();

    // ========= سكراب النتائج بواسطة cheerio =========
    // ملاحظة: السيلكتورات هنا عامة، عدّلها حسب بنية HTML الفعلية للموقع.
    const $ = cheerio.load(html);
    const results = [];

    // مثال عام: أي رابط يحتوي على كلمة "manga" أو "comic" في الرابط
    $("a").each((_, el) => {
      const href = $(el).attr("href") || "";
      const title = $(el).text().trim();

      // عدل هذا الشرط على حسب مسارات الأعمال في مانجا تايم
      if (
        href &&
        title &&
        (href.includes("/manga") ||
          href.includes("/comic") ||
          href.includes("/comics"))
      ) {
        results.push({
          title,
          url: href.startsWith("http")
            ? href
            : `https://mangatime.org${href}`,
        });
      }
    });

    // في حال ما قدر يجيب أي نتيجة من السكراب، نرجع الـ HTML الخام ليستفيد منه الفرونت أو للتجربة
    if (!results.length) {
      return NextResponse.json({
        owner: "MATUOS-3MK",
        code: 0,
        msg: "success (no parsed results, returning raw html)",
        data: {
          query,
          html,
        },
      });
    }

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
