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

    console.log("Total HTML length:", html.length);
    console.log("Searching for manga items...");

    // المحاولة الأولى: البحث عن العناصر الحقيقية في HTML
    // نبحث عن divs تحتوي على class "product__item" أو "UpdatedTitle-module_title_2KlMr"
    const mangaItems = $(".product__item, [class*='product__item'], [class*='UpdatedTitle']");
    console.log("Found potential manga items:", mangaItems.length);

    mangaItems.each((index, element) => {
      try {
        const item = $(element);
        
        // محاولات متعددة لإيجاد العنوان
        let title = "";
        let url = "";
        
        // المحاولة 1: من عنصر العنوان
        let titleElement = item.find(".title_manga, .UpdatedTitle-module_titleName_1QO_s, h2, h3").first();
        if (titleElement.length) {
          title = titleElement.text().trim().replace("..", ""); // إزالة النقاط من النهاية
        }
        
        // المحاولة 2: من الرابط
        let mangaLink = item.find(".manga-link, a[href*='/manga/'], a[href*='manga-details']").first();
        if (mangaLink.length) {
          url = mangaLink.attr("href") || "";
          // إذا لم يكن العنوان موجوداً، نأخذه من الرابط
          if (!title && url) {
            const urlParts = url.split("/");
            const lastPart = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
            if (lastPart) {
              title = lastPart.replace(/-/g, " ").trim();
            }
          }
        }
        
        // المحاولة 3: من العنوان المخفي (h2 مع aria-hidden)
        if (!title || title.length < 3) {
          const hiddenTitle = item.find("h2[aria-hidden='true']").first();
          if (hiddenTitle.length) {
            title = hiddenTitle.text().trim();
          }
        }
        
        // إذا لم نجد عنواناً أو رابطاً، نتخطى هذا العنصر
        if (!title || title.length < 3 || !url) {
          return;
        }
        
        // التأكد أن الرابط كامل
        if (url && !url.startsWith("http")) {
          url = `https://mangatime.org${url}`;
        }
        
        console.log(`Processing item ${index + 1}: ${title}`);
        
        // استخراج الصورة
        let image = "";
        
        // المحاولة 1: من background-image في الstyle
        const bgImage = item.find("[style*='background-image'], .set-bg-poster, .product__item__pic_catogary").first();
        if (bgImage.length) {
          const style = bgImage.attr("style") || "";
          const match = style.match(/url\(['"]?([^'")]+)['"]?\)/);
          if (match) {
            image = match[1];
          } else {
            // المحاولة 2: من data attributes
            image = bgImage.attr("data-setbg-high") || bgImage.attr("data-setbg") || "";
          }
        }
        
        // المحاولة 3: من عنصر img مباشرة
        if (!image) {
          const imgElement = item.find("img").first();
          if (imgElement.length) {
            image = imgElement.attr("src") || imgElement.attr("data-src") || "";
          }
        }
        
        // استخراج التصنيفات
        const categories = [];
        item.find("ul li a, .genres a, .tags a, [href*='/categories/']").each((_, catEl) => {
          const catName = $(catEl).text().trim();
          if (catName && catName.length > 1 && !catName.includes("href") && !categories.includes(catName)) {
            categories.push(catName);
          }
        });
        
        // استخراج عدد الفصول
        let totalChapters = 0;
        const chaptersElement = item.find(".ep, [class*='chapter'], [class*='episode']");
        if (chaptersElement.length) {
          const chaptersText = chaptersElement.text().trim();
          const match = chaptersText.match(/Ch\.\s*(\d+)/) || chaptersText.match(/(\d+)/);
          if (match) {
            totalChapters = parseInt(match[1]);
          }
        }
        
        // استخراج أحدث الفصول
        const latestChapters = [];
        item.find(".manga-link-1, .manga-link-2, .site-btn-chapter, [href*='/chapter']").each((i, chapterEl) => {
          if (i >= 2) return; // نأخذ أول فصلين فقط
          
          const chapterText = $(chapterEl).find("span").first().text().trim() || $(chapterEl).text().trim();
          const chapterUrl = $(chapterEl).attr("href") || "";
          
          if (chapterText && chapterUrl && chapterText.toLowerCase().includes("chapter")) {
            latestChapters.push({
              name: chapterText,
              url: chapterUrl.startsWith("http") ? chapterUrl : `https://mangatime.org${chapterUrl}`
            });
          }
        });
        
        // استخراج عدد المشاهدات
        let views = 0;
        const viewsElement = item.find(".view, .fa-eye").parent();
        if (viewsElement.length) {
          const viewsText = viewsElement.text().trim();
          const match = viewsText.match(/(\d+)/);
          if (match) {
            views = parseInt(match[1]);
          }
        }
        
        // استخراج عدد التعليقات
        let comments = 0;
        const commentsElement = item.find(".comment, .fa-comments").parent();
        if (commentsElement.length) {
          const commentsText = commentsElement.text().trim();
          const match = commentsText.match(/(\d+)/);
          if (match) {
            comments = parseInt(match[1]);
          }
        }
        
        // استخراج الوصف من العناصر المخفية
        let description = "";
        const descriptionElement = item.find("h2[aria-hidden='true']").eq(1); // العنصر الثاني المخفي
        if (descriptionElement.length) {
          description = descriptionElement.text().trim();
        }
        
        results.push({
          id: results.length + 1,
          title: title,
          slug: slugifyName(title),
          url,
          image,
          categories: categories.length > 0 ? categories : ["غير محدد"],
          stats: {
            totalChapters,
            views,
            comments
          },
          latestChapters: latestChapters.length > 0 ? latestChapters : [{name: "غير متوفر", url: ""}],
          description: description || "لا يوجد وصف",
          status: "مستمرة",
          rating: "غير محدد",
          type: "مانجا",
          source: "mangatime.org",
          year: new Date().getFullYear().toString()
        });
        
      } catch (error) {
        console.error(`Error processing item ${index}:`, error);
      }
    });

    // إذا لم نجد نتائج من العناصر، نبحث في JSON-LD
    if (results.length === 0) {
      console.log("No results from HTML elements, trying JSON-LD...");
      
      try {
        const scriptContent = $("script[type='application/ld+json']").first().html();
        if (scriptContent) {
          const jsonData = JSON.parse(scriptContent);
          if (jsonData.itemListElement && Array.isArray(jsonData.itemListElement)) {
            jsonData.itemListElement.forEach((item) => {
              if (item.item && item.item.name) {
                results.push({
                  id: results.length + 1,
                  title: item.item.name,
                  slug: slugifyName(item.item.name),
                  url: item.item.url || "",
                  image: item.item.image || "",
                  description: item.item.description || "لا يوجد وصف",
                  categories: ["غير محدد"],
                  stats: {
                    totalChapters: 0,
                    views: 0,
                    comments: 0
                  },
                  latestChapters: [{name: "غير متوفر", url: ""}],
                  status: "مستمرة",
                  rating: "غير محدد",
                  type: "مانجا",
                  source: "mangatime.org",
                  year: new Date().getFullYear().toString(),
                  fromJsonLd: true,
                  otherNames: item.item.otherNames || ""
                });
              }
            });
          }
        }
      } catch (e) {
        console.error("Error parsing JSON-LD:", e);
      }
    }

    console.log(`Total results found: ${results.length}`);

    // تصفية النتائج بناءً على كلمة البحث
    const queryLower = query.toLowerCase();
    const filteredResults = results.filter(item => {
      const titleLower = item.title.toLowerCase();
      const descLower = (item.description || "").toLowerCase();
      const otherNamesLower = (item.otherNames || "").toLowerCase();
      
      return titleLower.includes(queryLower) || 
             queryLower.includes(titleLower.split(" ")[0]) ||
             descLower.includes(queryLower) ||
             otherNamesLower.includes(queryLower);
    });

    // إزالة التكرارات
    const uniqueResults = [];
    const seenTitles = new Set();
    const seenUrls = new Set();
    
    filteredResults.forEach(item => {
      const simpleTitle = item.title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (!seenTitles.has(simpleTitle) && !seenUrls.has(item.url)) {
        seenTitles.add(simpleTitle);
        seenUrls.add(item.url);
        uniqueResults.push(item);
      }
    });

    if (uniqueResults.length === 0) {
      // إرجاع جميع النتائج إذا لم تكن هناك نتائج مطابقة
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
