// app/api/witanime/search/route.js

import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

// إنشاء User-Agent عشوائي
function getRandomUserAgent() {
  const userAgents = [
    // Chrome على Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    // Chrome على Mac
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    // Firefox على Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
    // Safari على Mac
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    // Chrome على Android
    "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    // Chrome على iOS
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1",
  ];
  
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function slugifyName(name = "") {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
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
          msg: "يرجى إضافة اسم أنمي في باراميتر q",
        },
        { status: 400 }
      );
    }

    // User-Agent عشوائي
    const userAgent = getRandomUserAgent();
    
    // الـ Headers المحسنة
    const headers = {
      "User-Agent": userAgent,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "ar,en-US;q=0.7,en;q=0.3",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "max-age=0",
      "TE": "trailers",
    };

    // إضافة Referer و Host
    headers["Referer"] = "https://www.google.com/";
    headers["Host"] = "witanime.you";

    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://witanime.you/?search_param=animes&s=${encodedQuery}`;

    console.log("Fetching URL:", searchUrl);
    console.log("Using User-Agent:", userAgent);

    // محاولة مع خيارات إضافية
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(searchUrl, {
        method: "GET",
        headers: headers,
        cache: "no-store",
        signal: controller.signal,
        // إضافة هذه الخيارات للتعامل مع Cloudflare
        redirect: "follow",
        // إضافة cookies افتراضية
        credentials: "omit", // أو "include" إذا كنت تريد إرسال cookies
      });

      clearTimeout(timeoutId);

      console.log("Response Status:", response.status);
      console.log("Response Headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        // إذا كان 403، جرب طريقة مختلفة
        if (response.status === 403 || response.status === 429) {
          throw new Error(`تم حظر الوصول (${response.status}). الموقع يستخدم حماية.`);
        }
        
        return NextResponse.json(
          {
            owner: "MATUOS-3MK",
            code: response.status,
            msg: `فشل في الاتصال بموقع WitAnime (${response.status})`,
            headers: Object.fromEntries(response.headers.entries()),
          },
          { status: 500 }
        );
      }

      const html = await response.text();
      
      // التحقق من أن الصفحة ليست صفحة Cloudflare
      if (html.includes("Cloudflare") || html.includes("cf-browser-verification") || html.includes("Just a moment")) {
        throw new Error("تم حظر الوصول بواسطة Cloudflare. الموقع يستخدم حماية متقدمة.");
      }

      const $ = cheerio.load(html);
      const results = [];

      // البحث عن نتائج الأنمي
      $(".anime-card-container").each((_, container) => {
        const $container = $(container);

        // العنوان والرابط
        const titleLink = $container.find(".anime-card-title h3 a");
        const title = titleLink.text().trim();
        const url = titleLink.attr("href");

        if (!title || !url) return;

        // الصورة
        const img = $container.find(".anime-card-poster img.img-responsive");
        const image = img.attr("src");

        // الحالة
        const status = $container.find(".anime-card-status a").text().trim();

        // النوع
        const type = $container.find(".anime-card-type a").text().trim();

        // الوصف
        const description = $container.find(".anime-card-title").attr("data-content") || "";

        results.push({
          id: url.split("/anime/")[1]?.replace(/\//g, "") || null,
          title: title,
          slug: slugifyName(title),
          url: url,
          image: image,
          status: status,
          type: type,
          description: description,
        });
      });

      // بديل إذا لم توجد نتائج في المكان المتوقع
      if (results.length === 0) {
        $(".anime-list-content .row.display-flex > div").each((_, col) => {
          const $col = $(col);
          const titleLink = $col.find("h3 a");
          const title = titleLink.text().trim();
          const url = titleLink.attr("href");

          if (title && url) {
            const img = $col.find("img.img-responsive");
            const image = img.attr("src");
            
            results.push({
              title: title,
              url: url,
              image: image,
            });
          }
        });
      }

      const searchTitle = $(".second-section h3").text().trim() || `نتائج البحث عن ${query}`;

      if (results.length === 0) {
        // تحقق إذا كانت الصفحة تحتوي على رسالة "لا توجد نتائج"
        const noResults = html.includes("لا توجد نتائج") || 
                          html.includes("No results") || 
                          html.includes("لم يتم العثور");
        
        return NextResponse.json(
          {
            owner: "MATUOS-3MK",
            code: noResults ? 404 : 200,
            msg: noResults ? "لم يتم العثور على أي أنمي مطابق" : "تم جلب الصفحة ولكن لم يتم العثور على نتائج",
            data: {
              query: query,
              searchTitle: searchTitle,
              htmlLength: html.length,
              sampleHtml: html.substring(0, 500), // جزء من HTML للمساعدة في التصحيح
            },
          },
          { status: noResults ? 404 : 200 }
        );
      }

      return NextResponse.json({
        owner: "MATUOS-3MK",
        code: 0,
        msg: "success",
        data: {
          query: query,
          searchTitle: searchTitle,
          count: results.length,
          results: results,
        },
      });

    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }

  } catch (err) {
    console.error("Detailed error in WitAnime search:", {
      message: err.message,
      name: err.name,
      stack: err.stack,
    });

    // رسالة خطأ محددة
    let errorMsg = "حدث خطأ داخلي في السيرفر";
    let errorCode = 500;

    if (err.name === "AbortError") {
      errorMsg = "انتهت مهلة الاتصال بموقع WitAnime";
      errorCode = 504;
    } else if (err.message.includes("Cloudflare") || err.message.includes("حظر")) {
      errorMsg = "تم حظر الوصول بواسطة حماية الموقع (Cloudflare)";
      errorCode = 403;
    } else if (err.message.includes("ENOTFOUND") || err.message.includes("getaddrinfo")) {
      errorMsg = "تعذر الاتصال بخادم WitAnime";
      errorCode = 502;
    }

    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: errorCode,
        msg: errorMsg,
        error: err.message,
        suggestion: "جرب استخدام VPN أو تغيير User-Agent",
      },
      { status: errorCode }
    );
  }
      }        { status: 400 }
      );
    }

    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://witanime.you/?search_param=animes&s=${encodedQuery}`;

    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": "https://witanime.you/",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
        "sec-ch-ua": '"Chromium";v="139", "Not;A=Brand";v="99"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: response.status,
          msg: "فشل في الاتصال بموقع WitAnime",
        },
        { status: 500 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const results = [];

    // البحث عن نتائج الأنمي في الصفحة
    $(".anime-card-container").each((_, container) => {
      const $container = $(container);

      // استخراج العنوان والرابط
      const titleElement = $container.find(".anime-card-title h3 a");
      const title = titleElement.text().trim();
      const animeUrl = titleElement.attr("href");

      if (!title || !animeUrl) return;

      // استخراج الـ ID من الرابط
      const animeId = extractAnimeId(animeUrl);
      const slug = slugifyName(title);

      // استخراج الصورة
      const imgElement = $container.find(".anime-card-poster img.img-responsive");
      const image = imgElement.attr("src") || imgElement.attr("data-src");

      // استخراج الحالة (مكتمل، مستمر، إلخ)
      const statusElement = $container.find(".anime-card-status a");
      const status = statusElement.text().trim();
      const statusUrl = statusElement.attr("href");

      // استخراج النوع (TV, Movie, Special)
      const typeElement = $container.find(".anime-card-type a");
      const type = typeElement.text().trim();
      const typeUrl = typeElement.attr("href");

      // استخراج الوصف من خاصية data-content
      const description = $container.find(".anime-card-title").attr("data-content") || "";

      // استخراج معلومات إضافية إذا كانت موجودة
      const additionalInfo = {
        episodes: null,
        rating: null,
        year: null,
      };

      // البحث عن معلومات إضافية في التصميم (يمكن تعديلها حسب الصفحة الفعلية)
      $container.find(".anime-card-details .anime-card-info span").each((_, infoEl) => {
        const text = $(infoEl).text().trim();
        if (text.includes("حلقة")) {
          additionalInfo.episodes = text.replace(/[^\d]/g, "");
        } else if (text.includes("★") || text.includes("rating")) {
          additionalInfo.rating = text.replace(/[^\d.]/g, "");
        }
      });

      // استخراج التصنيفات إذا كانت موجودة
      const categories = [];
      $container.find(".anime-card-genres a").each((_, catEl) => {
        const cat = $(catEl).text().trim();
        if (cat) categories.push(cat);
      });

      results.push({
        id: animeId,
        title: title,
        slug: slug,
        url: animeUrl,
        image: image,
        status: {
          text: status,
          url: statusUrl,
        },
        type: {
          text: type,
          url: typeUrl,
        },
        description: description,
        additionalInfo: additionalInfo,
        categories: categories.length > 0 ? categories : null,
        metadata: {
          source: "WitAnime",
          scrapedAt: new Date().toISOString(),
        }
      });
    });

    // بديل إذا لم تكن النتائج موجودة في .anime-card-container
    if (results.length === 0) {
      $(".anime-list-content .col-lg-2, .anime-list-content .col-md-4, .anime-list-content .col-sm-6").each((_, col) => {
        const $col = $(col);
        const $card = $col.find(".anime-card-container");

        if ($card.length > 0) {
          const titleElement = $card.find("h3 a");
          const title = titleElement.text().trim();
          const animeUrl = titleElement.attr("href");

          if (!title || !animeUrl) return;

          const animeId = extractAnimeId(animeUrl);
          const slug = slugifyName(title);

          const imgElement = $card.find("img.img-responsive");
          const image = imgElement.attr("src");

          const statusElement = $card.find(".anime-card-status a");
          const status = statusElement.text().trim();

          const typeElement = $card.find(".anime-card-type a");
          const type = typeElement.text().trim();

          const description = $card.find(".anime-card-title").attr("data-content") || "";

          results.push({
            id: animeId,
            title: title,
            slug: slug,
            url: animeUrl,
            image: image,
            status: status,
            type: type,
            description: description,
          });
        }
      });
    }

    // الحصول على نص عنوان البحث
    const searchTitle = $(".second-section .container h3").text().trim() || `نتائج البحث عن ${query}`;

    if (results.length === 0) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على أي أنمي مطابق لنتيجة البحث",
          data: {
            query: query,
            searchTitle: searchTitle,
            searchUrl: searchUrl,
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
        query: query,
        searchTitle: searchTitle,
        searchUrl: searchUrl,
        count: results.length,
        results: results,
      },
    });
  } catch (err) {
    console.error("Error in WitAnime search:", err);
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "حدث خطأ داخلي في السيرفر",
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
      { status: 500 }
    );
  }
          }
