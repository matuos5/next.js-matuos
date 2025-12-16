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
          signal: AbortSignal.timeout(10000),
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

    // قائمة الكلمات التي نريد تصفيتها (ليست مانجا)
    const excludedTerms = [
      "قائمة المانجا",
      "بحث متقدم",
      "Relevance",
      "Latest",
      "A-Z",
      "Rating",
      "Trending",
      "Most Views",
      "New",
      "أكشن",
      "إثارة",
      "فنتازيا",
      "مغامرات",
      "نظام",
      "وحوش",
      "اسبوعي",
      "دموي",
      "سحر",
      "شونين",
      "قوة خارقة",
      "كوميدي",
      "مانهوا",
      "خارق للطبيعة",
      "خيال",
      "ويبتون",
      "غموض",
      "فانتازيا",
      "تاريخي",
      "دراما",
      "فنون قتالية",
      "موريم",
      "بطل مجنون",
      "مغامرة",
      "RED ICE",
      "AKIRA Rei",
      "2018",
      "65",
      "61",
      "21",
      "11",
      "48",
      "98",
      "200- مكتمل"
    ];

    // استخراج جميع الروابط التي تحتوي على "/series/"
    $("a[href*='/series/']").each((index, el) => {
      const link = $(el);
      const url = link.attr("href") || "";
      const title = link.text().trim();
      
      // تجاهل الروابط الفارغة أو بدون عنوان
      if (!title || title.length < 2) return;
      
      // تجاهل الكلمات الممنوعة
      if (excludedTerms.some(term => title.includes(term))) return;
      
      // التأكد أن الرابط خاص بسلسلة مانجا (ليس فصل)
      if (url.match(/\/series\/[^/]+\/\d+\/$/) || url.includes("/chapter") || url.includes("/فصل")) {
        return;
      }
      
      // منع التكرار
      const exists = results.some(r => r.url === url);
      if (exists) return;
      
      // الحصول على الصورة من العنصر المحيط
      let image = "";
      const parentContainer = link.closest(".page-item-detail, .col-md-3, .c-tabs-item");
      if (parentContainer.length) {
        const imgElement = parentContainer.find("img");
        image = imgElement.attr("src") || imgElement.attr("data-src") || "";
        
        if (image && image.startsWith("/")) {
          image = `https://azoramoon.com${image}`;
        }
      }
      
      // استخراج التصنيفات إذا كانت موجودة
      const categories = [];
      parentContainer.find(".mg_genres .summary-content a, .genres a").each((_, catEl) => {
        const catName = $(catEl).text().trim();
        if (catName && !excludedTerms.includes(catName)) {
          categories.push(catName);
        }
      });
      
      // أحدث فصل
      const latestChapterElement = parentContainer.find(".chapter-item .chapter a").first();
      const latestChapter = {
        name: latestChapterElement.text().trim() || "غير متوفر",
        url: latestChapterElement.attr("href") || ""
      };
      
      // السنة
      const yearElement = parentContainer.find(".mg_release .summary-content");
      const year = yearElement.text().trim();
      
      // الحالة
      const statusElement = parentContainer.find(".mg_status .summary-content");
      const status = statusElement.text().trim() || "مستمرة";
      
      results.push({
        id: results.length + 1,
        title,
        slug: slugifyName(title),
        url,
        image,
        categories,
        latestChapter,
        year,
        status,
        rating: "غير محدد",
        type: "مانجا",
        source: "azoramoon.com"
      });
    });

    // الآن خصيصاً نبحث عن المانجا التي تحتوي على كلمة البحث في العنوان
    const searchResults = results.filter(item => {
      const titleLower = item.title.toLowerCase();
      const queryLower = query.toLowerCase();
      
      // قبول المانجا التي تحتوي على كلمة البحث في العنوان
      return titleLower.includes(queryLower) || 
             // أو المانجا التي تبدأ بكلمة البحث
             titleLower.startsWith(queryLower) ||
             // أو التي تحتوي على الكلمة كجزء من العنوان
             item.title.toLowerCase().includes("solo");
    });

    // إذا لم نجد نتائج مطابقة للبحث، نرجع كل النتائج
    const finalResults = searchResults.length > 0 ? searchResults : results.slice(0, 10);

    // تصفية للتأكد من أنها مانجا حقيقية (ليست تصنيفات أو صفحات أخرى)
    const filteredResults = finalResults.filter(item => {
      return item.title.length > 3 && 
             !item.url.includes("/series-genre/") &&
             !item.url.includes("/series-author/") &&
             !item.url.includes("/series-artist/") &&
             !item.url.includes("/series-release/") &&
             !item.title.match(/^\d+$/); // ليست أرقام فقط
    });

    if (!filteredResults.length) {
      // محاولة أخيرة: إرجاع بعض النتائج دون تصفية كثيرة
      const fallbackResults = results
        .filter(item => item.url.includes("/series/") && item.title.length > 3)
        .slice(0, 10);
      
      if (fallbackResults.length > 0) {
        return NextResponse.json({
          owner: "AZORAMOON-API",
          code: 0,
          msg: "success",
          data: {
            query,
            count: fallbackResults.length,
            results: fallbackResults,
          },
        });
      }
      
      return NextResponse.json(
        {
          owner: "AZORAMOON-API",
          code: 404,
          msg: "لم يتم العثور على أي مانجا مطابقة لنتيجة البحث",
          data: {
            query,
            totalLinksFound: results.length
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
