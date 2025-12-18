// app/api/olympustaff/manga/route.js

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
    const mangaId = searchParams.get("id"); // مثال: /api/olympustaff/manga?id=SL

    if (!mangaId) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى اضافة معرف المانجا في باراميتر id",
          examples: [
            "/api/olympustaff/manga?id=SL",
            "/api/olympustaff/manga?id=SMN",
            "/api/olympustaff/manga?id=solo-farming-in-the-tower"
          ]
        },
        { status: 400 }
      );
    }

    // بناء الرابط
    const targetUrl = `https://olympustaff.com/series/${mangaId}`;
    
    const customHeaders = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
      'sec-ch-ua-mobile': '?1',
      'sec-ch-ua-full-version': '"139.0.7339.0"',
      'sec-ch-ua-arch': '""',
      'sec-ch-ua-platform': '"Android"',
      'sec-ch-ua-platform-version': '"10.0.0"',
      'sec-ch-ua-model': '"MAR-LX1A"',
      'sec-ch-ua-bitness': '""',
      'sec-ch-ua-full-version-list': '"Chromium";v="139.0.7339.0", "Not;A=Brand";v="99.0.0.0"',
      'upgrade-insecure-requests': '1',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-user': '?1',
      'sec-fetch-dest': 'document',
      'referer': `https://olympustaff.com/?search=${encodeURIComponent(mangaId)}`,
      'accept-language': 'ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6'
    };

    let lastError = null;
    let mangaData = null;

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

        const html = await response.text();
        
        // التحقق إذا كانت صفحة Cloudflare Challenge
        if (html.includes('Just a moment') || html.includes('Enable JavaScript and cookies')) {
          console.log("⚠️ تم اكتشاف Cloudflare challenge");
          continue;
        }
        
        // تحليل HTML باستخدام cheerio
        const $ = cheerio.load(html);
        mangaData = extractMangaDetails($, mangaId, html);
        
        // إذا نجحنا في استخراج البيانات، نخرج من الحلقة
        if (mangaData && mangaData.title) {
          break;
        }

      } catch (error) {
        lastError = error;
        console.log(`❌ فشل البروكسي: ${error.message}`);
        // استمر بالمحاولة مع البروكسي التالي
      }
    }

    // إذا فشلت جميع المحاولات
    if (!mangaData || !mangaData.title) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على المانجا أو فشل الاتصال",
          suggestions: [
            "تأكد من صحة معرف المانجا",
            "قد يكون الموقع يستخدم حماية Cloudflare",
            "جرب معرفات أخرى مثل: SL, SMN, solo-farming-in-the-tower"
          ],
          error: lastError?.message || "غير معروف",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: mangaData,
      metadata: {
        source: "olympustaff.com",
        timestamp: new Date().toISOString(),
        url: targetUrl,
        fetchedFrom: "HTML page"
      }
    });

  } catch (err) {
    console.error("❌ خطأ في API:", err);
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "حدث خطأ داخلي في السيرفر",
        error: err.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// دالة لاستخراج تفاصيل المانجا من HTML
function extractMangaDetails($, mangaId, html) {
  
  // استخراج العنوان
  const title = $('title').text()
    .replace(' - مانجا مترجمة', '')
    .replace(' | Team-X', '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // استخراج الوصف من meta tags
  const description = $('meta[name="description"]').attr('content') || 
                     $('meta[property="og:description"]').attr('content') || '';
  
  // استخراج الصورة
  const image = $('meta[property="og:image"]').attr('content') ||
               $('meta[name="twitter:image"]').attr('content') ||
               $('img').first().attr('src');
  
  // استخراج النوع (مانجا/مانهوا) من الوصف والعنوان
  let type = 'manhwa'; // افتراضي
  if (description.toLowerCase().includes('مانجا') || title.toLowerCase().includes('manga')) {
    type = 'manga';
  } else if (description.toLowerCase().includes('مانهوا') || title.toLowerCase().includes('manhua')) {
    type = 'manhua';
  }
  
  // استخراج التصنيفات من الكلمات المفتاحية
  const keywords = $('meta[name="keywords"]').attr('content') || '';
  const categories = extractCategories(keywords, title);
  
  // استخراج عدد الفصول من HTML (البحث عن عناصر الفصول)
  const chaptersData = extractChaptersData($);
  
  // استخراج معلومات إضافية من meta tags
  const metaInfo = {
    rating: extractRating(html),
    status: extractStatus(html),
    author: extractAuthor(html),
    year: extractYear(html),
    alternativeTitles: extractAlternativeTitles($, title)
  };
  
  return {
    id: mangaId,
    title,
    slug: slugifyName(title),
    description: cleanDescription(description),
    image: ensureAbsoluteUrl(image),
    thumbnail: image ? `${ensureAbsoluteUrl(image)}?w=300&h=450&fit=cover` : null,
    type,
    categories,
    chapters: chaptersData,
    stats: {
      totalChapters: chaptersData.length,
      lastUpdated: new Date().toISOString(),
      popularity: calculatePopularity(chaptersData.length)
    },
    meta: metaInfo,
    url: `https://olympustaff.com/series/${mangaId}`,
    source: 'olympustaff',
    copyright: extractCopyrightInfo($)
  };
}

// دالة لاستخراج بيانات الفصول
function extractChaptersData($) {
  const chapters = [];
  
  // البحث عن عناصر الفصول في الـ HTML
  // هذا يعتمد على هيكل الصفحة، يمكن تعديله حسب الحاجة
  $('.chapter-item, .chapter-card, .chapter-link, a[href*="/chapter"], [class*="chapter"]').each((_, el) => {
    const element = $(el);
    const text = element.text().trim();
    const href = element.attr('href') || '';
    
    // محاولة استخراج رقم الفصل من النص
    const chapterMatch = text.match(/الفصل\s*(\d+)|Chapter\s*(\d+)|(\d+)/i);
    const chapterNumber = chapterMatch ? 
      parseInt(chapterMatch[1] || chapterMatch[2] || chapterMatch[3]) : null;
    
    if (chapterNumber && href) {
      const chapterTitle = text.replace(/الفصل\s*\d+\s*[:-]?\s*/i, '')
                              .replace(/Chapter\s*\d+\s*[:-]?\s*/i, '')
                              .trim();
      
      chapters.push({
        number: chapterNumber,
        title: chapterTitle || `الفصل ${chapterNumber}`,
        url: ensureAbsoluteUrl(href),
        rawText: text
      });
    }
  });
  
  // إذا لم نجد فصول بالطريقة العادية، نبحث في النص
  if (chapters.length === 0) {
    const pageText = $('body').text();
    const chapterRegex = /(الفصل|Chapter)\s*(\d+)(?:\s*[:-]?\s*(.*?))?(?=\n|الفصل|Chapter|$)/gi;
    let match;
    
    while ((match = chapterRegex.exec(pageText)) !== null) {
      const chapterNumber = parseInt(match[2]);
      const chapterTitle = (match[3] || '').trim();
      
      chapters.push({
        number: chapterNumber,
        title: chapterTitle || `الفصل ${chapterNumber}`,
        url: `https://olympustaff.com/series/SL/chapter-${chapterNumber}`,
        source: 'text-regex'
      });
    }
  }
  
  // ترتيب الفصول تصاعدياً
  return chapters.sort((a, b) => a.number - b.number);
}

// دوال مساعدة
function extractCategories(keywords, title) {
  const categories = new Set();
  
  // إضافة تصنيفات من الكلمات المفتاحية
  if (keywords) {
    const keywordList = keywords.split(',').map(k => k.trim());
    keywordList.forEach(keyword => {
      if (keyword && keyword.length > 2 && !keyword.includes('مانجا')) {
        categories.add(keyword);
      }
    });
  }
  
  // إضافة تصنيفات من العنوان
  const titleWords = title.toLowerCase().split(/\s+/);
  const genreKeywords = [
    'action', 'أكشن', 'adventure', 'مغامرة', 'fantasy', 'فانتازيا',
    'romance', 'رومانسي', 'comedy', 'كوميدي', 'drama', 'دراما',
    'supernatural', 'خارق', 'leveling', 'مستويات', 'tower', 'برج'
  ];
  
  titleWords.forEach(word => {
    genreKeywords.forEach(genre => {
      if (word.includes(genre)) {
        categories.add(genre);
      }
    });
  });
  
  return Array.from(categories);
}

function extractRating(html) {
  const ratingMatch = html.match(/rating["']?\s*[:=]\s*["']?([\d.]+)/i);
  return ratingMatch ? parseFloat(ratingMatch[1]) : null;
}

function extractStatus(html) {
  if (html.includes('مستمر') || html.includes('ongoing')) return 'مستمر';
  if (html.includes('مكتمل') || html.includes('completed')) return 'مكتمل';
  if (html.includes('متوقف') || html.includes('hiatus')) return 'متوقف';
  return 'غير معروف';
}

function extractAuthor(html) {
  const authorMatch = html.match(/author["']?\s*[:=]\s*["']?([^"']+)/i);
  return authorMatch ? authorMatch[1].trim() : null;
}

function extractYear(html) {
  const yearMatch = html.match(/(\d{4})\s*(?:سنة|year)/i);
  return yearMatch ? parseInt(yearMatch[1]) : null;
}

function extractAlternativeTitles($, mainTitle) {
  const alternatives = [];
  const metaTitle = $('title').text();
  
  if (metaTitle && metaTitle !== mainTitle) {
    alternatives.push(metaTitle.replace(' | Team-X', '').trim());
  }
  
  // البحث عن عناوين بديلة في meta tags
  const altTitles = $('meta[property="og:title"], meta[name="twitter:title"]');
  altTitles.each((_, el) => {
    const title = $(el).attr('content');
    if (title && title !== mainTitle && !alternatives.includes(title)) {
      alternatives.push(title);
    }
  });
  
  return alternatives;
}

function extractCopyrightInfo($) {
  const copyrightText = $('footer, .copyright, [class*="copy"], [class*="rights"]').text();
  if (copyrightText.includes('Team-X') || copyrightText.includes('olympustaff')) {
    return {
      site: 'Team-X',
      url: 'https://olympustaff.com',
      disclaimer: 'جميع الحقوق محفوظة للموقع الأصلي'
    };
  }
  return null;
}

function cleanDescription(desc) {
  return desc
    .replace(/<[^>]*>/g, '')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugifyName(name = "") {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function ensureAbsoluteUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `https://olympustaff.com${url.startsWith('/') ? url : '/' + url}`;
}

function calculatePopularity(chapterCount) {
  if (chapterCount > 200) return 'very_high';
  if (chapterCount > 100) return 'high';
  if (chapterCount > 50) return 'medium';
  if (chapterCount > 10) return 'low';
  return 'very_low';
      } 
