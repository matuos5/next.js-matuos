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

    // البحث في صفحة البحث عن نتائج المانجا
    // طريقة 1: البحث في صفحة نتائج البحث
    if ($("#loop-content.page-content-listing").length > 0) {
      $("#loop-content.page-content-listing .page-listing-item").each((index, el) => {
        const item = $(el);
        
        // استخراج البيانات من كل نتيجة
        const titleElement = item.find(".post-title h3, .post-title h5");
        const title = titleElement.text().trim();
        
        if (!title) return;
        
        // الرابط
        const linkElement = item.find("a").first();
        const url = linkElement.attr("href") || "";
        
        // الصورة
        const imgElement = item.find(".item-thumb img, img.wp-post-image");
        let image = imgElement.attr("src") || imgElement.attr("data-src") || "";
        
        // إذا كانت الصورة نسبية، تحويلها إلى مطلقة
        if (image && image.startsWith("/")) {
          image = `https://azoramoon.com${image}`;
        }
        
        // الوصف
        const descriptionElement = item.find(".manga-summary, .post-content");
        const description = descriptionElement.text().trim().substring(0, 150) + "...";
        
        // التصنيفات
        const categories = [];
        item.find(".mg_genres .summary-content a, .genres a").each((_, catEl) => {
          const catName = $(catEl).text().trim();
          if (catName) categories.push(catName);
        });
        
        // أحدث فصل
        const latestChapterElement = item.find(".chapter-item .chapter a, .list-chapter .chapter a");
        const latestChapter = {
          name: latestChapterElement.text().trim(),
          url: latestChapterElement.attr("href") || ""
        };
        
        // حالة المانجا (منتهية، مستمرة)
        const statusElement = item.find(".mg_status .summary-content");
        const status = statusElement.text().trim();
        
        // السنة
        const yearElement = item.find(".mg_release .summary-content");
        const year = yearElement.text().trim();
        
        // التقييم
        const ratingElement = item.find(".rating, .score");
        const rating = ratingElement.text().trim();
        
        results.push({
          id: index + 1,
          title,
          slug: slugifyName(title),
          url,
          image,
          description,
          categories,
          latestChapter,
          status,
          year,
          rating: rating || "غير محدد",
          type: "مانجا",
          source: "azoramoon.com"
        });
      });
    }
    
    // طريقة 2: إذا كانت النتائج في تنسيق آخر
    if (results.length === 0 && $(".c-tabs-item").length > 0) {
      $(".c-tabs-item").each((index, el) => {
        const item = $(el);
        
        const titleElement = item.find(".post-title h1, .post-title h3");
        const title = titleElement.text().trim();
        
        if (!title) return;
        
        const linkElement = item.find("a").first();
        const url = linkElement.attr("href") || "";
        
        const imgElement = item.find(".summary_image img");
        let image = imgElement.attr("src") || "";
        
        if (image && image.startsWith("/")) {
          image = `https://azoramoon.com${image}`;
        }
        
        results.push({
          id: index + 1,
          title,
          slug: slugifyName(title),
          url,
          image,
          description: item.find(".manga-summary").text().trim().substring(0, 150) + "...",
          categories: [],
          latestChapter: { name: "", url: "" },
          status: "",
          year: "",
          rating: "غير محدد",
          type: "مانجا",
          source: "azoramoon.com"
        });
      });
    }
    
    // طريقة 3: البحث في أي عنصر به class "manga" أو "wp-manga"
    if (results.length === 0) {
      $("[class*='manga'], [class*='Manga']").each((index, el) => {
        const item = $(el);
        
        // تحقق إذا كان العنصر يحتوي على رابط مانجا
        const linkElement = item.find("a");
        const url = linkElement.attr("href") || "";
        
        if (!url.includes("manga") && !url.includes("series")) return;
        
        const title = item.find("h1, h2, h3, h4, h5").first().text().trim() || 
                     linkElement.text().trim();
        
        if (!title || title.length < 2) return;
        
        const imgElement = item.find("img");
        let image = imgElement.attr("src") || imgElement.attr("data-src") || "";
        
        if (image && image.startsWith("/")) {
          image = `https://azoramoon.com${image}`;
        }
        
        // منع التكرار
        const exists = results.some(r => r.title === title || r.url === url);
        if (exists) return;
        
        results.push({
          id: index + 1,
          title,
          slug: slugifyName(title),
          url,
          image,
          description: "",
          categories: [],
          latestChapter: { name: "", url: "" },
          status: "",
          year: "",
          rating: "غير محدد",
          type: "مانجا",
          source: "azoramoon.com"
        });
      });
    }

    if (!results.length) {
      return NextResponse.json(
        {
          owner: "AZORAMOON-API",
          code: 404,
          msg: "لم يتم العثور على أي مانجا مطابقة لنتيجة البحث",
          data: {
            query,
            htmlPreview: html.substring(0, 500) + "..."
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
        count: results.length,
        results,
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
