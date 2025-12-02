// app/api/lekmanga/search/route.js

import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

function slugifyName(name = "") {
  return name
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .toLowerCase();
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى إضافة اسم مانجا في باراميتر q",
        },
        { status: 400 }
      );
    }

    // بناء URL البحث الخاص بـ lekmanga.net
    const searchUrl = `https://lekmanga.net/?s=${encodeURIComponent(query)}&post_type=wp-manga`;

    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "sec-ch-ua": '"Chromium";v="139", "Not;A=Brand";v="99"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "upgrade-insecure-requests": "1",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "navigate",
        "sec-fetch-user": "?1",
        "sec-fetch-dest": "document",
        "referer": "https://lekmanga.net/",
        "accept-language": "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6",
      },
      // لإلغاء الكاش (اختياري)
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: response.status,
          msg: "فشل في الاتصال بموقع مانجا ليك",
        },
        { status: 500 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const results = [];

    // البحث عن نتائج المانجا - بناءً على بنية الموقع التي لاحظتها
    $(".c-tabs-item__content, .tab-content-wrap .row.c-tabs-item__content").each((_, container) => {
      const $container = $(container);

      // كل مانجا في النتائج
      $container.find(".tab-thumb.c-image-hover, .col-4.col-sm-3.col-md-2").each((_, mangaEl) => {
        const $manga = $(mangaEl);

        // استخراج العنوان والرابط
        const titleLink = $manga.find("a");
        const title = titleLink.attr("title") || titleLink.text().trim();
        const mangaUrl = titleLink.attr("href");

        if (!title || !mangaUrl) return;

        const slug = slugifyName(title);
        const mangaId = mangaUrl.split("/").filter(Boolean).pop();

        // استخراج الصورة
        const img = $manga.find("img");
        const image = img.attr("src") || img.attr("data-src") || img.attr("data-original");

        // استخراج الفصل الأخير
        const chapterLink = $manga.find(".chapter-item a, .chapter a");
        const latestChapter = chapterLink.text().trim();
        const latestChapterUrl = chapterLink.attr("href");

        // استخراج التصنيفات
        const categories = [];
        $manga.find(".mg_genres a, .genres a").each((_, catEl) => {
          const cat = $(catEl).text().trim();
          if (cat) categories.push(cat);
        });

        // استخراج تاريخ النشر/التحديث
        const dateText = $manga.find(".font-meta, .post-on").text().trim();

        // استخراج معدل التقييم (إن وجد)
        const ratingEl = $manga.find(".score, .rating");
        const rating = ratingEl.text().trim();

        results.push({
          id: mangaId,
          title: title,
          slug: slug,
          url: mangaUrl,
          image: image,
          latestChapter: latestChapter || null,
          latestChapterUrl: latestChapterUrl || null,
          categories: categories.length > 0 ? categories : null,
          date: dateText || null,
          rating: rating || null,
        });
      });
    });

    // إذا لم نجد نتائج بالطريقة الأولى، نجرب البحث في بنية بديلة
    if (results.length === 0) {
      $(".row.listupd .col, .listupd .col").each((_, mangaEl) => {
        const $manga = $(mangaEl);

        const titleLink = $manga.find(".series-title a");
        const title = titleLink.text().trim();
        const mangaUrl = titleLink.attr("href");

        if (!title || !mangaUrl) return;

        const slug = slugifyName(title);
        const mangaId = mangaUrl.split("/").filter(Boolean).pop();

        const img = $manga.find("img");
        const image = img.attr("src") || img.attr("data-src");

        const chapterLink = $manga.find(".series-chapter a");
        const latestChapter = chapterLink.text().trim();
        const latestChapterUrl = chapterLink.attr("href");

        results.push({
          id: mangaId,
          title: title,
          slug: slug,
          url: mangaUrl,
          image: image,
          latestChapter: latestChapter || null,
          latestChapterUrl: latestChapterUrl || null,
        });
      });
    }

    if (results.length === 0) {
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
