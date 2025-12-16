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
          owner: "AZORAMOON-API",
          code: 400,
          msg: "يرجى اضافة اسم مانجا في باراميتر q",
        },
        { status: 400 }
      );
    }

    const encoded = encodeURIComponent(query);
    
    // استخدام proxy لتجاوز CORS
    const targetUrl = `https://azoramoon.com/?s=${encoded}&post_type=wp-manga`;
    
    // جرب عدة proxies إذا فشل الأول
    const proxies = [
      `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`
    ];

    let html = "";
    let lastError = null;

    // محاولة مع عدة proxies
    for (const proxy of proxies) {
      try {
        const response = await fetch(proxy, {
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
            "referer": "https://azoramoon.com/",
            "accept-language":
              "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(10000), // 10 ثانية timeout
        });

        if (response.ok) {
          html = await response.text();
          break;
        }
      } catch (err) {
        lastError = err;
        continue;
      }
    }

    if (!html) {
      return NextResponse.json(
        {
          owner: "AZORAMOON-API",
          code: 500,
          msg: "فشل في الإتصال بموقع ازورا مانجا عبر جميع الـ proxies",
          error: lastError?.message || "Unknown error",
        },
        { status: 500 }
      );
    }

    const $ = cheerio.load(html);
    const results = [];

    // الطريقة الصحيحة: البحث عن النتائج في grid المانجا
    // نبحث عن العنصر الرئيسي الذي يحتوي على جميع نتائج البحث
    const searchResultsContainer = $("#loop-content.page-content-listing");
    
    if (searchResultsContainer.length > 0) {
      // استخراج كل مانجا من الـ grid
      searchResultsContainer.find(".page-listing-item .row-eq-height .col-md-3").each((index, el) => {
        const mangaItem = $(el).find(".page-item-detail.manga");
        
        if (mangaItem.length === 0) return;
        
        // العنوان
        const titleElement = mangaItem.find(".post-title h3");
        const title = titleElement.text().trim();
        
        if (!title) return;
        
        // الرابط
        const linkElement = mangaItem.find(".post-title a").first();
        const url = linkElement.attr("href") || "";
        
        // تحقق إذا كان رابط مانجا حقيقي
        if (!url.includes("/series/")) return;
        
        // الصورة
        const imgElement = mangaItem.find(".item-thumb img");
        let image = imgElement.attr("src") || imgElement.attr("data-src") || "";
        
        // إذا كانت الصورة نسبية، تحويلها إلى مطلقة
        if (image && image.startsWith("/")) {
          image = `https://azoramoon.com${image}`;
        }
        
        // عدد الفصول
        const chapterCount = mangaItem.find(".list-chapter .chapter-item").length;
        
        // أحدث فصل
        const latestChapterElement = mangaItem.find(".list-chapter .chapter-item .chapter a").first();
        const latestChapter = {
          name: latestChapterElement.text().trim(),
          url: latestChapterElement.attr("href") || ""
        };
        
        // التصنيفات
        const genresText = mangaItem.find(".mg_genres .summary-content").text().trim();
        const categories = genresText ? genresText.split(",").map(g => g.trim()) : [];
        
        results.push({
          id: index + 1,
          title,
          slug: slugifyName(title),
          url,
          image,
          chapters: chapterCount,
          latestChapter,
          categories,
          type: "مانجا",
          source: "azoramoon.com"
        });
      });
    }

    // إذا لم نحصل على نتائج، حاول طريقة أبسط
    if (results.length === 0) {
      // ابحث عن أي رابط مانجا في grid البحث
      $(".page-listing-item a[href*='/series/']").each((index, el) => {
        const link = $(el);
        const url = link.attr("href") || "";
        const title = link.find("h3").text().trim() || link.text().trim();
        
        // تصفية النتائج غير المرغوبة
        if (!title || 
            title === "قائمة المانجا" || 
            title === "بحث متقدم" ||
            title.includes("Relevance") ||
            title.includes("Latest") ||
            title.includes("A-Z") ||
            title.includes("Rating") ||
            title.includes("Trending") ||
            title.includes("Most Views") ||
            title.includes("New")) {
          return;
        }
        
        // منع التكرار
        const exists = results.some(r => r.url === url);
        if (exists) return;
        
        // الحصول على الصورة
        const container = link.closest(".page-item-detail, .col-md-3");
        const imgElement = container.find("img");
        let image = imgElement.attr("src") || imgElement.attr("data-src") || "";
        
        if (image && image.startsWith("/")) {
          image = `https://azoramoon.com${image}`;
        }
        
        results.push({
          id: results.length + 1,
          title,
          slug: slugifyName(title),
          url,
          image,
          chapters: 0,
          latestChapter: { name: "", url: "" },
          categories: [],
          type: "مانجا",
          source: "azoramoon.com"
        });
      });
    }

    // تصفية النتائج - إزالة التكرارات والنتائج غير المرغوبة
    const filteredResults = results
      .filter((item, index, self) => 
        index === self.findIndex((t) => t.url === item.url) &&
        item.url.includes("/series/") &&
        !item.title.includes("search") &&
        !item.title.includes("Search") &&
        item.title.length > 2
      )
      .slice(0, 20); // تحديد 20 نتيجة كحد أقصى

    if (!filteredResults.length) {
      return NextResponse.json(
        {
          owner: "AZORAMOON-API",
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
      owner: "AZORAMOON-API",
      code: 0,
      msg: "success",
      data: {
        query,
        count: filteredResults.length,
        results: filteredResults,
      },
    });
  } catch (err) {
    console.error("AZORAMOON API Error:", err);
    return NextResponse.json(
      {
        owner: "AZORAMOON-API",
        code: 500,
        msg: "حدث خطأ داخلي في السيرفر",
        error: err.message,
      },
      { status: 500 }
    );
  }
          } 
