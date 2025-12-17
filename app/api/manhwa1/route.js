// app/api/olympustaff/search/route.js

import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

// قائمة بالخدمات البروكسي البديلة
const proxyServices = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`,
];

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى اضافة اسم المانجا في باراميتر q",
        },
        { status: 400 }
      );
    }

    // الرابط الأساسي والمعلمة
    const targetUrl = `https://olympustaff.com/ajax/search?keyword=${encodeURIComponent(query)}`;
    
    const customHeaders = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
      'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
      'sec-ch-ua-mobile': '?1',
      'sec-ch-ua-arch': '""',
      'sec-ch-ua-full-version': '"139.0.7339.0"',
      'content-type': 'application/json;charset=UTF-8',
      'sec-ch-ua-platform-version': '"10.0.0"',
      'sec-ch-ua-full-version-list': '"Chromium";v="139.0.7339.0", "Not;A=Brand";v="99.0.0.0"',
      'sec-ch-ua-bitness': '""',
      'sec-ch-ua-model': '"MAR-LX1A"',
      'sec-ch-ua-platform': '"Android"',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
      'referer': 'https://olympustaff.com/',
      'accept-language': 'ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6'
    };

    let lastError = null;
    let responseData = null;

    // تجربة جميع الخدمات البروكسي واحدة تلو الأخرى
    for (const getProxyUrl of proxyServices) {
      try {
        const proxyUrl = getProxyUrl(targetUrl);
        console.log(`🔍 جرب البروكسي: ${proxyUrl.substring(0, 60)}...`);

        const response = await fetch(proxyUrl, {
          method: 'GET',
          headers: customHeaders,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contentType = response.headers.get("content-type");
        
        if (contentType && contentType.includes("application/json")) {
          responseData = await response.json();
        } else {
          // إذا كانت الاستجابة HTML (مثل صفحة Cloudflare)
          const html = await response.text();
          const $ = cheerio.load(html);
          
          // التحقق إذا كانت صفحة Cloudflare Challenge
          if (html.includes('Just a moment') || html.includes('Enable JavaScript and cookies')) {
            console.log("⚠️ تم اكتشاف Cloudflare challenge");
            
            // محاولة استخراج البيانات من الـ script إذا وجدت
            const scriptContent = $('script').text();
            if (scriptContent.includes('_cf_chl_opt')) {
              console.log("📄 تم العثور على بيانات Cloudflare في الـ script");
            }
            
            // إذا كانت هذه هي صفحة Cloudflare، استمر في المحاولة مع بروكسي آخر
            continue;
          } else {
            // إذا كانت HTML عادية، حاول تحليلها
            responseData = parseHtmlResponse($); // تم إزالة query من هنا
          }
        }

        // إذا وصلنا هنا، يعني النجاح
        break;

      } catch (error) {
        lastError = error;
        console.log(`❌ فشل البروكسي: ${error.message}`);
        // استمر بالمحاولة مع البروكسي التالي
      }
    }

    // إذا فشلت جميع المحاولات
    if (!responseData) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 503,
          msg: "فشل جميع محاولات الاتصال. قد يكون الموقع يستخدم حماية Cloudflare",
          error: lastError?.message || "غير معروف",
        },
        { status: 503 }
      );
    }

    // معالجة البيانات المسترجعة
    let messages;
    if (Array.isArray(responseData)) {
      messages = responseData;
    } else if (responseData && Array.isArray(responseData.hits)) {
      messages = responseData.hits.map(item => item);
    } else if (responseData && Array.isArray(responseData.results)) {
      messages = responseData.results;
    } else if (responseData && typeof responseData === 'object') {
      messages = [responseData];
    } else {
      messages = [{ content: JSON.stringify(responseData, null, 2) }];
    }

    // إذا كانت البيانات تحتوي على نتائج بحث حقيقية
    if (messages.length > 0 && messages[0].title) {
      const results = messages.map(item => ({
        id: item.id || null,
        title: item.title || item.name || "",
        slug: slugifyName(item.title || item.name || ""),
        url: item.url || `https://olympustaff.com/manga/${slugifyName(item.title || item.name || "")}`,
        image: item.image || item.cover || null,
        description: item.description || item.synopsis || "",
        chapters: item.chapters || item.total_chapters || 0,
        status: item.status || null,
        genres: item.genres || item.categories || [],
        rating: item.rating || null,
        year: item.year || null,
      }));

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
    }

    // إذا لم تكن هناك نتائج
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 404,
        msg: "لم يتم العثور على أي مانجا مطابقة لنتيجة البحث",
        data: {
          query,
          rawData: messages,
        },
      },
      { status: 404 }
    );

  } catch (err) {
    console.error("❌ خطأ في API:", err);
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

// دالة مساعدة لتحويل الاسم إلى slug
function slugifyName(name = "") {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// دالة لتحليل استجابة HTML (إذا كان الموقع يعيد HTML بدلاً من JSON)
// تم إزالة المعلمة query لأنها لا تستخدم
function parseHtmlResponse($) {
  const results = [];
  
  // هذا مثال - تحتاج إلى تعديله بناءً على هيكل HTML الفعلي للموقع
  $(".manga-item, .search-result, .item, .grid-item, .col-item").each((_, el) => {
    const item = $(el);
    
    const title = item.find(".title, .name, h3, h4").first().text().trim();
    if (!title) return;
    
    const link = item.find("a").first();
    const url = link.attr("href") || "";
    
    const image = item.find("img").first();
    const imageUrl = image.attr("src") || image.attr("data-src") || "";
    
    const description = item.find(".description, .synopsis, .summary").text().trim();
    
    const chaptersText = item.find(".chapters, .episodes, .chapter-count").text();
    const chapters = Number((chaptersText || "").replace(/[^\d]/g, "")) || 0;
    
    // استخراج التصنيفات
    const genres = [];
    item.find(".genres a, .categories a, .tags a").each((_, genreEl) => {
      const genre = $(genreEl).text().trim();
      if (genre) genres.push(genre);
    });
    
    results.push({
      title,
      url: url.startsWith("http") ? url : `https://olympustaff.com${url}`,
      image: imageUrl.startsWith("http") ? imageUrl : `https://olympustaff.com${imageUrl}`,
      description,
      chapters,
      genres,
    });
  });
  
  return results;
}      'sec-ch-ua-arch': '""',
      'sec-ch-ua-full-version': '"139.0.7339.0"',
      'content-type': 'application/json;charset=UTF-8',
      'sec-ch-ua-platform-version': '"10.0.0"',
      'sec-ch-ua-full-version-list': '"Chromium";v="139.0.7339.0", "Not;A=Brand";v="99.0.0.0"',
      'sec-ch-ua-bitness': '""',
      'sec-ch-ua-model': '"MAR-LX1A"',
      'sec-ch-ua-platform': '"Android"',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
      'referer': 'https://olympustaff.com/',
      'accept-language': 'ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6'
    };

    let lastError = null;
    let responseData = null;

    // تجربة جميع الخدمات البروكسي واحدة تلو الأخرى
    for (const getProxyUrl of proxyServices) {
      try {
        const proxyUrl = getProxyUrl(targetUrl);
        console.log(`🔍 جرب البروكسي: ${proxyUrl.substring(0, 60)}...`);

        const response = await fetch(proxyUrl, {
          method: 'GET',
          headers: customHeaders,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contentType = response.headers.get("content-type");
        
        if (contentType && contentType.includes("application/json")) {
          responseData = await response.json();
        } else {
          // إذا كانت الاستجابة HTML (مثل صفحة Cloudflare)
          const html = await response.text();
          const $ = cheerio.load(html);
          
          // التحقق إذا كانت صفحة Cloudflare Challenge
          if (html.includes('Just a moment') || html.includes('Enable JavaScript and cookies')) {
            console.log("⚠️ تم اكتشاف Cloudflare challenge");
            
            // محاولة استخراج البيانات من الـ script إذا وجدت
            const scriptContent = $('script').text();
            if (scriptContent.includes('_cf_chl_opt')) {
              // يمكننا محاولة استخراج بعض البيانات من الـ script
              // لكن غالباً سنحتاج إلى محاكاة جافاسكريبت
              console.log("📄 تم العثور على بيانات Cloudflare في الـ script");
            }
            
            // إذا كانت هذه هي صفحة Cloudflare، استمر في المحاولة مع بروكسي آخر
            continue;
          } else {
            // إذا كانت HTML عادية، حاول تحليلها
            responseData = await parseHtmlResponse($, query);
          }
        }

        // إذا وصلنا هنا، يعني النجاح
        break;

      } catch (error) {
        lastError = error;
        console.log(`❌ فشل البروكسي: ${error.message}`);
        // استمر بالمحاولة مع البروكسي التالي
      }
    }

    // إذا فشلت جميع المحاولات
    if (!responseData) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 503,
          msg: "فشل جميع محاولات الاتصال. قد يكون الموقع يستخدم حماية Cloudflare",
          error: lastError?.message || "غير معروف",
        },
        { status: 503 }
      );
    }

    // معالجة البيانات المسترجعة
    let messages;
    if (Array.isArray(responseData)) {
      messages = responseData;
    } else if (responseData && Array.isArray(responseData.hits)) {
      messages = responseData.hits.map(item => item);
    } else if (responseData && Array.isArray(responseData.results)) {
      messages = responseData.results;
    } else if (responseData && typeof responseData === 'object') {
      messages = [responseData];
    } else {
      messages = [{ content: JSON.stringify(responseData, null, 2) }];
    }

    // إذا كانت البيانات تحتوي على نتائج بحث حقيقية
    if (messages.length > 0 && messages[0].title) {
      const results = messages.map(item => ({
        id: item.id || null,
        title: item.title || item.name || "",
        slug: slugifyName(item.title || item.name || ""),
        url: item.url || `https://olympustaff.com/manga/${slugifyName(item.title || item.name || "")}`,
        image: item.image || item.cover || null,
        description: item.description || item.synopsis || "",
        chapters: item.chapters || item.total_chapters || 0,
        status: item.status || null,
        genres: item.genres || item.categories || [],
        rating: item.rating || null,
        year: item.year || null,
      }));

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
    }

    // إذا لم تكن هناك نتائج
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 404,
        msg: "لم يتم العثور على أي مانجا مطابقة لنتيجة البحث",
        data: {
          query,
          rawData: messages,
        },
      },
      { status: 404 }
    );

  } catch (err) {
    console.error("❌ خطأ في API:", err);
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

// دالة مساعدة لتحويل الاسم إلى slug
function slugifyName(name = "") {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// دالة لتحليل استجابة HTML (إذا كان الموقع يعيد HTML بدلاً من JSON)
async function parseHtmlResponse($, query) {
  const results = [];
  
  // هذا مثال - تحتاج إلى تعديله بناءً على هيكل HTML الفعلي للموقع
  // حاول البحث عن العناصر المشابهة لما في مثال mangatime
  $(".manga-item, .search-result, .item").each((_, el) => {
    const item = $(el);
    
    const title = item.find(".title, .name, h3").first().text().trim();
    if (!title) return;
    
    const link = item.find("a").first();
    const url = link.attr("href") || "";
    
    const image = item.find("img").first();
    const imageUrl = image.attr("src") || image.attr("data-src") || "";
    
    const description = item.find(".description, .synopsis").text().trim();
    
    const chaptersText = item.find(".chapters, .episodes").text();
    const chapters = Number((chaptersText || "").replace(/[^\d]/g, "")) || 0;
    
    // استخراج التصنيفات
    const genres = [];
    item.find(".genres a, .categories a").each((_, genreEl) => {
      const genre = $(genreEl).text().trim();
      if (genre) genres.push(genre);
    });
    
    results.push({
      title,
      url: url.startsWith("http") ? url : `https://olympustaff.com${url}`,
      image: imageUrl.startsWith("http") ? imageUrl : `https://olympustaff.com${imageUrl}`,
      description,
      chapters,
      genres,
    });
  });
  
  return results;
                          } 
