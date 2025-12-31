// app/api/mangatime-search/route.js
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

function slugifyName(name = "") {
  return name
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .toLowerCase();
}

function extractImageFromStyle(style) {
  if (!style) return "";
  const match = style.match(/url\(['"]?([^'"\)]+)['"]?\)/);
  return match ? match[1] : "";
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
          msg: "يرجى إضافة اسم المانجا في باراميتر q",
        },
        { status: 400 }
      );
    }

    const encoded = encodeURIComponent(query);
    const targetUrl = `https://mangatime.org/search?q=${encoded}`;

    let html = "";
    
    try {
      const response = await fetch(targetUrl, {
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
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      html = await response.text();
    } catch (error) {
      console.error("MANGATIME API Error fetching:", error);
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 500,
          msg: "فشل في الاتصال بموقع MangaTime",
          error: error.message,
        },
        { status: 500 }
      );
    }

    const $ = cheerio.load(html);
    const results = [];

    // استخراج النتائج من صفحة البحث في mangatime.org
    // محاولة عدة أنماط للعثور على العناصر
    
    // 1. البحث عن divs ذات class محددة
    const mangaElements = $(".manga-item, .search-wrap, .manga, .card, .list-group-item, .search-item");
    
    if (mangaElements.length === 0) {
      // 2. البحث عن عناصر تحتوي على رابط مانجا
      mangaElements = $("a[href*='/manga/']").parent().filter((i, el) => {
        return $(el).find("img").length > 0 || $(el).text().trim().length > 10;
      });
    }
    
    if (mangaElements.length === 0) {
      // 3. البحث عن أي عنصر يبدو أنه نتيجة بحث
      mangaElements = $("body > *").filter((i, el) => {
        const text = $(el).text().trim();
        return text.length > 50 && text.includes(query);
      });
    }

    mangaElements.each((index, el) => {
      const item = $(el);
      
      // البحث عن رابط العنوان
      const titleLink = item.find("a[href*='/manga/'], a[href*='/series/'], a.title, h3 a, h4 a, h5 a").first();
      const title = titleLink.text().trim();
      let url = titleLink.attr("href");
      
      if (!title || !url || title.length < 2) return;
      
      // التأكد أن الرابط كامل
      if (url && !url.startsWith("http")) {
        url = `https://mangatime.org${url}`;
      }
      
      // استخراج الصورة
      let image = "";
      const imgElement = item.find("img").first();
      if (imgElement.length) {
        image = imgElement.attr("src") || imgElement.attr("data-src") || imgElement.attr("data-original") || "";
      } else {
        // البحث عن صورة في الخلفية
        const bgImage = item.find("[style*='background-image']").first();
        if (bgImage.length) {
          image = extractImageFromStyle(bgImage.attr("style"));
        }
      }
      
      // إضافة النطاق إذا كانت الصورة بمسار نسبي
      if (image && image.startsWith("/")) {
        image = `https://mangatime.org${image}`;
      }
      
      // استخراج التصنيفات
      const categories = [];
      item.find(".genres a, .tags a, .category a, .genre span").each((_, catEl) => {
        const catName = $(catEl).text().trim();
        if (catName && catName.length > 1) {
          categories.push(catName);
        }
      });
      
      // استخراج أحدث فصل
      let latestChapter = {
        name: "غير متوفر",
        url: ""
      };
      const chapterLink = item.find(".chapter a, .chapter-item a, .chapters a").first();
      if (chapterLink.length) {
        const chapterUrl = chapterLink.attr("href") || "";
        latestChapter = {
          name: chapterLink.text().trim(),
          url: chapterUrl.startsWith("http") ? chapterUrl : `https://mangatime.org${chapterUrl}`
        };
      }
      
      // استخراج التقييم
      let rating = "غير محدد";
      const ratingElement = item.find(".rating, .score, .rate, [class*='rating']");
      if (ratingElement.length) {
        rating = ratingElement.text().trim();
      }
      
      // استخراج الحالة
      let status = "غير معروف";
      const statusElement = item.find(".status, .manga-status, .series-status, [class*='status']");
      if (statusElement.length) {
        status = statusElement.text().trim();
      }
      
      // استخراج الوصف
      let description = "";
      const descElement = item.find(".summary, .description, .manga-description");
      if (descElement.length) {
        description = descElement.text().trim().substring(0, 200);
      }
      
      // استخراج السنة
      let year = "";
      const yearMatch = item.text().match(/(\d{4})/);
      if (yearMatch) {
        const possibleYear = parseInt(yearMatch[1]);
        if (possibleYear > 1900 && possibleYear <= new Date().getFullYear()) {
          year = possibleYear.toString();
        }
      }
      
      // استخراج النوع
      let type = "مانجا";
      const typeElement = item.find(".type, .manga-type");
      if (typeElement.length) {
        type = typeElement.text().trim();
      }
      
      results.push({
        id: results.length + 1,
        title,
        slug: slugifyName(title),
        url,
        image,
        categories,
        latestChapter,
        rating,
        status,
        description,
        year,
        type,
        source: "mangatime.org"
      });
    });

    // تصفية النتائج بناءً على كلمة البحث
    const filteredResults = results.filter(item => {
      const titleLower = item.title.toLowerCase();
      const queryLower = query.toLowerCase();
      
      return titleLower.includes(queryLower) || 
             queryLower.includes(titleLower) ||
             item.categories.some(cat => cat.toLowerCase().includes(queryLower));
    }).slice(0, 50); // تحديد عدد النتائج

    if (filteredResults.length === 0) {
      // إرجاع بعض النتائج إذا لم تكن هناك نتائج مطابقة
      const fallbackResults = results.slice(0, 20);
      
      if (fallbackResults.length > 0) {
        return NextResponse.json({
          owner: "MATUOS-3MK",
          code: 0,
          msg: "success",
          data: {
            query,
            count: fallbackResults.length,
            results: fallbackResults,
            note: "تم عرض نتائج عامة (غير مطابقة تماماً للبحث)"
          },
        });
      }
      
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على أي مانجا مطابقة لنتيجة البحث",
          data: {
            query,
            htmlLength: html.length,
            note: "قد يكون هيكل الموقع قد تغير"
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
        count: filteredResults.length,
        results: filteredResults,
      },
    });
  } catch (err) {
    console.error("MANGATIME API Error:", err);
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
