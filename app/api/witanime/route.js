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
          owner: "WITANIME-API",
          code: 400,
          msg: "يرجى اضافة اسم انمي في باراميتر q",
        },
        { status: 400 }
      );
    }

    const encoded = encodeURIComponent(query);
    
    // استخدام proxy لتجاوز CORS و Cloudflare
    const targetUrl = `https://witanime.you?search_param=animes&s=${encoded}`;
    
    // قائمة بالبروكسي التي تعمل مع Cloudflare
    const proxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
      `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(targetUrl)}`
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
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept":
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
            "Referer": "https://witanime.you/",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin",
            "Cache-Control": "max-age=0"
          },
          cache: "no-store",
          signal: AbortSignal.timeout(20000),
        });

        if (!response.ok) {
          console.log(`❌ بروكسي فشل مع status: ${response.status}`);
          continue;
        }

        const responseText = await response.text();
        
        // تحقق إذا كان Cloudflare يحجب
        if (responseText.includes('challenge-error-text') || 
            responseText.includes('Cloudflare') || 
            responseText.includes('cf-browser-verification')) {
          console.log(`⚠️ Cloudflare يحجب هذا البروكسي`);
          continue;
        }

        // تحقق إذا حصلنا على HTML صالح
        if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
          html = responseText;
          console.log(`✅ بروكسي ناجح: ${proxy.substring(0, 60)}...`);
          break;
        }

      } catch (err) {
        lastError = err;
        console.log(`❌ خطأ في البروكسي: ${err.message}`);
        continue;
      }
    }

    if (!html) {
      return NextResponse.json(
        {
          owner: "WITANIME-API",
          code: 500,
          msg: "فشل في الإتصال بموقع WitAnime عبر جميع الـ proxies",
          error: lastError?.message || "Cloudflare يحجب الطلبات",
          suggestion: "جرب استخدام خدمة scraping متخصصة مثل scrapingbee.com"
        },
        { status: 500 }
      );
    }

    const $ = cheerio.load(html);
    const results = [];

    // استخراج نتائج البحث من WitAnime
    $('.row.display-flex > div[class*="col-"]').each((index, element) => {
      const item = $(element);
      
      // العنوان
      const titleElement = item.find('.anime-card-title h3 a').first();
      const title = titleElement.text().trim();
      
      if (!title) return;
      
      // الرابط
      const link = titleElement.attr("href") || "";
      
      // الصورة
      const imageElement = item.find('.anime-card-poster img, img').first();
      let image = imageElement.attr("src") || "";
      
      // النوع (TV, Movie, Special)
      const typeElement = item.find('.anime-card-type');
      const type = typeElement.text().trim();
      
      // الحالة (مكتمل، مستمر)
      const statusElement = item.find('.anime-card-status');
      const status = statusElement.text().trim();
      
      // الوصف
      const descriptionAttr = item.find('.anime-card-title').attr('data-content');
      const description = descriptionAttr ? 
        descriptionAttr.replace(/\s+/g, ' ').trim().substring(0, 150) + '...' : '';
      
      // سنة الإصدار (يمكن استخراجها من الرابط أو البحث عنها)
      const yearMatch = link.match(/\/(\d{4})\//);
      const year = yearMatch ? yearMatch[1] : '';
      
      results.push({
        id: index + 1,
        title,
        slug: slugifyName(title),
        url: link.startsWith('http') ? link : `https://witanime.you${link}`,
        image,
        type: type || "غير محدد",
        status: status || "غير محدد",
        description,
        year,
        rating: "غير محدد", // الموقع لا يعرض التقييم في صفحة البحث
        metadata: {
          source: "witanime.you",
          searchQuery: query,
          hasDescription: !!description,
          hasImage: !!image
        }
      });
    });

    // محاولة ثانية إذا لم نجد نتائج بالطريقة الأولى
    if (results.length === 0) {
      $('.anime-card-container').each((index, element) => {
        const item = $(element);
        
        const titleElement = item.find('h3 a').first();
        const title = titleElement.text().trim();
        
        if (!title) return;
        
        const link = titleElement.attr("href") || "";
        const image = item.find('img').attr("src") || "";
        
        results.push({
          id: index + 1,
          title,
          slug: slugifyName(title),
          url: link.startsWith('http') ? link : `https://witanime.you${link}`,
          image,
          type: "غير محدد",
          status: "غير محدد",
          description: "",
          year: "",
          rating: "غير محدد",
          metadata: {
            source: "witanime.you",
            searchQuery: query
          }
        });
      });
    }

    if (!results.length) {
      return NextResponse.json(
        {
          owner: "WITANIME-API",
          code: 404,
          msg: "لم يتم العثور على أي انمي مطابق لنتيجة البحث",
          data: {
            query,
            htmlLength: html.length,
            containsAnimeCards: $('.anime-card-container').length > 0,
            containsRowDisplayFlex: $('.row.display-flex').length > 0
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "WITANIME-API",
      code: 0,
      msg: "success",
      data: {
        query,
        count: results.length,
        results,
      },
    });
  } catch (err) {
    console.error("WITANIME API Error:", err);
    return NextResponse.json(
      {
        owner: "WITANIME-API",
        code: 500,
        msg: "حدث خطأ داخلي في السيرفر",
        error: err.message,
      },
      { status: 500 }
    );
  }
          } 
