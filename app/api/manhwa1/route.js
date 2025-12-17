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
    let results = [];

    // تجربة جميع الخدمات البروكسي واحدة تلو الأخرى
    for (const getProxyUrl of proxyServices) {
      try {
        const proxyUrl = getProxyUrl(targetUrl);
        console.log(`🔍 جرب البروكسي: ${proxyUrl.substring(0, 60)}...`);

        const response = await fetch(proxyUrl, {
          method: 'GET',
          headers: customHeaders,
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseText = await response.text();
        
        // محاولة تحليل الرد كـ JSON أولاً
        try {
          const jsonData = JSON.parse(responseText);
          
          // الحالة الخاصة: إذا كان JSON يحتوي على حقل content فيه HTML
          if (jsonData && Array.isArray(jsonData) && jsonData[0] && jsonData[0].content) {
            // هذا هو الحالة التي حصلت عليها في المثال
            const htmlContent = jsonData[0].content;
            // إزالة الـ backslashes والاقتباسات المزدوجة
            const cleanHtml = htmlContent.replace(/\\"/g, '"').replace(/^"|"$/g, '');
            results = parseSearchResults(cleanHtml);
            break;
          }
          
          // إذا كان JSON عادي يحتوي على نتائج
          if (jsonData && Array.isArray(jsonData)) {
            results = parseJsonResults(jsonData);
            break;
          }
          
          // محاولة أخرى لتحليل كـ HTML مباشرة
          const $ = cheerio.load(responseText);
          if ($('ol.list-group').length > 0) {
            results = parseSearchResults(responseText);
            break;
          }
          
        } catch (jsonError) {
          // إذا فشل تحليل JSON، حاول تحليل كـ HTML
          const $ = cheerio.load(responseText);
          
          // التحقق إذا كانت صفحة Cloudflare Challenge
          if (responseText.includes('Just a moment') || responseText.includes('Enable JavaScript and cookies')) {
            console.log("⚠️ تم اكتشاف Cloudflare challenge");
            continue;
          }
          
          // تحقق من وجود نتائج البحث
          if ($('ol.list-group').length > 0) {
            results = parseSearchResults(responseText);
            break;
          }
        }

      } catch (error) {
        lastError = error;
        console.log(`❌ فشل البروكسي: ${error.message}`);
        // استمر بالمحاولة مع البروكسي التالي
      }
    }

    // إذا فشلت جميع المحاولات
    if (results.length === 0) {
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

// دالة لتحليل نتائج البحث من HTML
function parseSearchResults(html) {
  const $ = cheerio.load(html);
  const results = [];
  
  // البحث عن جميع عناصر نتائج البحث
  $('ol.list-group li.list-group-item').each((_, el) => {
    const item = $(el);
    
    // استخراج العنوان والرابط
    const titleLink = item.find('a.fw-bold');
    const title = titleLink.text().trim();
    const url = titleLink.attr('href') || '';
    
    // استخراج الصورة
    const img = item.find('img');
    const image = img.attr('src') || '';
    
    // استخراج عدد الفصول
    const chaptersSpan = item.find('.badge.bg-primary');
    const chapters = parseInt(chaptersSpan.text().trim()) || 0;
    
    // استخراج ID من الرابط
    let id = null;
    if (url.includes('/series/')) {
      const match = url.match(/\/series\/([^\/]+)/);
      id = match ? match[1] : null;
    }
    
    if (title) {
      results.push({
        id,
        title,
        slug: slugifyName(title),
        url: url.startsWith('http') ? url : `https://olympustaff.com${url}`,
        image: image.startsWith('http') ? image : `https://olympustaff.com${image}`,
        chapters,
        type: 'manhwa',
        source: 'olympustaff'
      });
    }
  });
  
  return results;
}

// دالة لتحليل نتائج JSON (إذا كانت موجودة)
function parseJsonResults(jsonData) {
  const results = [];
  
  if (Array.isArray(jsonData)) {
    jsonData.forEach(item => {
      if (item.title || item.name) {
        results.push({
          id: item.id || null,
          title: item.title || item.name,
          slug: slugifyName(item.title || item.name),
          url: item.url || `https://olympustaff.com/series/${slugifyName(item.title || item.name)}`,
          image: item.image || item.cover || null,
          chapters: item.chapters || item.total_chapters || 0,
          description: item.description || item.synopsis || '',
          genres: item.genres || item.categories || [],
          rating: item.rating || null,
          year: item.year || null,
          type: item.type || 'manhwa',
          source: 'olympustaff'
        });
      }
    });
  }
  
  return results;
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
