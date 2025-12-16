import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

function slugifyName(name = "") {
  return name
    .replace(/\s+/g, "-")          // استبدال المسافات بـ -
    .replace(/[^a-zA-Z0-9-]/g, ""); // إزالة أي شيء غير حروف/أرقام/داش
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q"); // مثال: /api/search?q=Solo

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

    const response = await fetch(`https://azoramoon.com?s=${encodeURIComponent(query)}&post_type=wp-manga`, {
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
        referer: "https://azoramoon.com/",
        "accept-language":
          "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: response.status,
          msg: `خطأ في استجابة الموقع: ${response.status} ${response.statusText}`,
        },
        { status: response.status }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // تحقق من صفحة Cloudflare Challenge
    if (html.includes("Just a moment...") || html.includes("Enable JavaScript and cookies to continue")) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 403,
          msg: "الموقع يستخدم حماية Cloudflare ولا يمكن الوصول إليه بهذه الطريقة",
          html: html, // يمكنك إزالة هذا إذا كنت لا تريد إرجاع HTML الكامل
        },
        { status: 403 }
      );
    }

    // استخراج نتائج البحث
    const results = [];

    // استناداً إلى هيكل موقع WP-Manga، نتائج البحث عادةً تكون في عناصر معينة
    $('.c-tabs-item__content, .manga-item, .post-item, .search-wrap .row .col, .listupd > .bs, .bsx').each((index, element) => {
      const $el = $(element);
      
      // استخراج العنوان
      const title = $el.find('.post-title a, h3 a, h4 a, .tt a, .title a').text().trim() ||
                    $el.find('a').attr('title') ||
                    $el.find('a').first().text().trim();
      
      // استخراج الرابط
      const link = $el.find('a').first().attr('href');
      
      // استخراج الصورة المصغرة
      const thumbnail = $el.find('img').first().attr('src') ||
                        $el.find('img').first().attr('data-src');
      
      // استخراج الفصول أو التفاصيل الأخرى
      const chapters = $el.find('.chapter-item, .chapter, .epxs').text().trim();
      const rating = $el.find('.score, .rating, .numscore').text().trim();
      const summary = $el.find('.summary, .content, .excerpt').text().trim();

      if (title && link) {
        results.push({
          id: index + 1,
          title: title,
          slug: slugifyName(title),
          url: link,
          thumbnail: thumbnail || null,
          chapters: chapters || null,
          rating: rating || null,
          summary: summary || null,
        });
      }
    });

    // إذا لم نجد نتائج بالطريقة الأولى، نبحث عن أي عناصر قد تحتوي على نتائج
    if (results.length === 0) {
      $('article, .post, .hentry, .item').each((index, element) => {
        const $el = $(element);
        const title = $el.find('.entry-title, h2 a, .post-title').text().trim();
        const link = $el.find('a').first().attr('href');
        
        if (title && link) {
          results.push({
            id: index + 1,
            title: title,
            slug: slugifyName(title),
            url: link,
          });
        }
      });
    }

    // إذا لم نجد أي نتائج
    if (results.length === 0) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على نتائج بحث",
          query: query,
          total_results: 0,
          results: [],
        },
        { status: 200 } // نعيد 200 لأن الطلب نجح لكن بدون نتائج
      );
    }

    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 200,
        msg: "تم العثور على النتائج بنجاح",
        query: query,
        total_results: results.length,
        results: results,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error in search API:", error);
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: `خطأ أثناء تنفيذ البحث: ${error.message}`,
      },
      { status: 500 }
    );
  }
                                                                                                            }
