// app/api/mangatime/route.js
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

    // استخراج النتائج من الهيكل الموجود في HTML
    $(".UpdatedTitle-module_titleWrapper_2EQIT").each((index, element) => {
      const item = $(element);
      
      // استخراج العنوان والرابط
      const titleElement = item.find(".UpdatedTitle-module_titleName_1QO_s");
      const title = titleElement.text().trim();
      const mangaLink = item.find(".manga-link").first();
      let url = mangaLink.attr("href") || "";
      
      if (!title || !url) return;
      
      // التأكد أن الرابط كامل
      if (url && !url.startsWith("http")) {
        url = `https://mangatime.org${url}`;
      }
      
      // استخراج الصورة من style background-image
      let image = "";
      const bgImage = item.find(".product__item__pic_catogary[style]").first();
      if (bgImage.length) {
        const style = bgImage.attr("style") || "";
        const match = style.match(/url\(['"]?([^'")]+)['"]?\)/);
        if (match) {
          image = match[1];
        }
      }
      
      // إذا لم توجد صورة من الـ background، جرب الـ data-setbg-high
      if (!image) {
        image = item.find(".product__item__pic_catogary").attr("data-setbg-high") || "";
      }
      
      // استخراج التصنيفات
      const categories = [];
      item.find(".product__item__text ul li a").each((_, catEl) => {
        const catName = $(catEl).text().trim();
        if (catName && !catName.includes("href")) {
          categories.push(catName);
        }
      });
      
      // استخراج عدد الفصول
      let totalChapters = "غير معروف";
      const chaptersElement = item.find(".ep");
      if (chaptersElement.length) {
        const chaptersText = chaptersElement.text().trim();
        const match = chaptersText.match(/(\d+)/);
        if (match) {
          totalChapters = parseInt(match[1]);
        }
      }
      
      // استخراج أحدث فصلين
      const chapters = [];
      item.find(".manga-link-1, .manga-link-2").each((i, chapterEl) => {
        const chapterText = $(chapterEl).find("span").first().text().trim();
        const chapterUrl = $(chapterEl).attr("href") || "";
        if (chapterText && chapterUrl) {
          chapters.push({
            name: chapterText,
            url: chapterUrl.startsWith("http") ? chapterUrl : `https://mangatime.org${chapterUrl}`
          });
        }
      });
      
      // استخراج عدد المشاهدات
      let views = 0;
      const viewsElement = item.find(".view");
      if (viewsElement.length) {
        const viewsText = viewsElement.text().trim();
        const match = viewsText.match(/(\d+)/);
        if (match) {
          views = parseInt(match[1]);
        }
      }
      
      // استخراج عدد التعليقات
      let comments = 0;
      const commentsElement = item.find(".comment");
      if (commentsElement.length) {
        const commentsText = commentsElement.text().trim();
        const match = commentsText.match(/(\d+)/);
        if (match) {
          comments = parseInt(match[1]);
        }
      }
      
      // استخراج الاسم الكامل من العنوان المخفي (h2)
      let fullTitle = title;
      const hiddenTitle = item.find("h2[aria-hidden='true']").first();
      if (hiddenTitle.length) {
        const hiddenText = hiddenTitle.text().trim();
        if (hiddenText.length > title.length) {
          fullTitle = hiddenText;
        }
      }
      
      // استخراج الوصف من JSON-LD في الـ head
      let description = "";
      try {
        const scriptContent = $("script[type='application/ld+json']").first().html();
        if (scriptContent) {
          const jsonData = JSON.parse(scriptContent);
          if (jsonData.itemListElement && Array.isArray(jsonData.itemListElement)) {
            const mangaData = jsonData.itemListElement.find(item => 
              item.position === index + 1
            );
            if (mangaData && mangaData.item && mangaData.item.description) {
              description = mangaData.item.description;
            }
          }
        }
      } catch (e) {
        console.error("Error parsing JSON-LD:", e);
      }
      
      results.push({
        id: results.length + 1,
        title: fullTitle,
        slug: slugifyName(fullTitle),
        url,
        image,
        categories,
        stats: {
          totalChapters,
          views,
          comments
        },
        latestChapters: chapters,
        description,
        status: "مستمرة",
        rating: "غير محدد",
        type: "مانجا",
        source: "mangatime.org",
        year: new Date().getFullYear().toString()
      });
    });

    // البحث أيضاً في JSON-LD داخل الـ head (يحتوي على معلومات إضافية)
    try {
      const scriptContent = $("script[type='application/ld+json']").first().html();
      if (scriptContent) {
        const jsonData = JSON.parse(scriptContent);
        if (jsonData.itemListElement && Array.isArray(jsonData.itemListElement)) {
          jsonData.itemListElement.forEach((item) => {
            if (item.item) {
              // تحديث المعلومات إذا كانت موجودة مسبقاً
              const existingResult = results.find(r => 
                r.title.includes(item.item.name) || 
                item.item.name.includes(r.title.split(" ")[0])
              );
              
              if (existingResult) {
                // تحديث الوصف والصورة إذا لم تكن موجودة
                if (!existingResult.description && item.item.description) {
                  existingResult.description = item.item.description;
                }
                if (!existingResult.image && item.item.image) {
                  existingResult.image = item.item.image;
                }
                if (item.item.otherNames) {
                  existingResult.otherNames = item.item.otherNames;
                }
              } else if (item.item.name && item.item.url) {
                // إضافة نتيجة جديدة إذا لم تكن موجودة
                results.push({
                  id: results.length + 1,
                  title: item.item.name,
                  slug: slugifyName(item.item.name),
                  url: item.item.url,
                  image: item.item.image || "",
                  description: item.item.description || "",
                  categories: [],
                  stats: {
                    totalChapters: 0,
                    views: 0,
                    comments: 0
                  },
                  latestChapters: [],
                  status: "مستمرة",
                  rating: "غير محدد",
                  type: "مانجا",
                  source: "mangatime.org",
                  year: new Date().getFullYear().toString(),
                  fromJsonLd: true
                });
              }
            }
          });
        }
      }
    } catch (e) {
      console.error("Error processing JSON-LD:", e);
    }

    // تصفية النتائج بناءً على كلمة البحث
    const queryLower = query.toLowerCase();
    const filteredResults = results.filter(item => {
      const titleLower = item.title.toLowerCase();
      const descLower = (item.description || "").toLowerCase();
      
      return titleLower.includes(queryLower) || 
             queryLower.includes(titleLower.split(" ")[0]) ||
             descLower.includes(queryLower) ||
             (item.otherNames && item.otherNames.toLowerCase().includes(queryLower));
    });

    // إزالة التكرارات
    const uniqueResults = [];
    const seenTitles = new Set();
    
    filteredResults.forEach(item => {
      const simpleTitle = item.title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (!seenTitles.has(simpleTitle)) {
        seenTitles.add(simpleTitle);
        uniqueResults.push(item);
      }
    });

    if (uniqueResults.length === 0) {
      // إرجاع بعض النتائج إذا لم تكن هناك نتائج مطابقة
      const allResults = results.slice(0, 10);
      
      if (allResults.length > 0) {
        return NextResponse.json({
          owner: "MATUOS-3MK",
          code: 0,
          msg: "success",
          data: {
            query,
            count: allResults.length,
            results: allResults,
            note: "تم عرض نتائج عامة من الموقع"
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
            totalElementsFound: results.length,
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
        count: uniqueResults.length,
        results: uniqueResults,
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
