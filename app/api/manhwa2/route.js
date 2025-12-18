// app/api/olympustaff/manga/route.js

import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

// قائمة خدمات البروكسي
const proxyServices = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`,
];

// Headers ثابتة للطلبات
const baseHeaders = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
  'sec-ch-ua-mobile': '?1',
  'accept-language': 'ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6',
  'cache-control': 'no-cache'
};

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const mangaId = searchParams.get("id");
    const getAllChapters = searchParams.get("all") === "true";

    if (!mangaId) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى اضافة معرف المانجا في باراميتر id",
          examples: [
            "/api/olympustaff/manga?id=SL",
            "/api/olympustaff/manga?id=solo-farming-in-the-tower&all=true"
          ]
        },
        { status: 400 }
      );
    }

    // جلب بيانات المانجا الأساسية
    const mangaInfo = await fetchWithProxies(`https://olympustaff.com/series/${mangaId}`);
    if (!mangaInfo.html) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على المانجا أو فشل الاتصال",
          data: { mangaId }
        },
        { status: 404 }
      );
    }

    const $ = cheerio.load(mangaInfo.html);
    const mangaData = extractMangaInfo($, mangaId);

    // جلب الفصول
    let chapters = [];
    let chaptersSource = 'main-page';

    if (getAllChapters) {
      // محاولة العثور على صفحة الفصول الكاملة
      const allChaptersData = await fetchAllChapters(mangaId);
      chapters = allChaptersData.chapters;
      chaptersSource = allChaptersData.source;
    } else {
      // الفصول المحدودة من الصفحة الرئيسية
      chapters = extractChaptersFromPage($, mangaId);
    }

    // إضافة بيانات الفصول
    mangaData.chapters = chapters;
    mangaData.chaptersInfo = {
      total: chapters.length,
      source: chaptersSource,
      limitedView: !getAllChapters && chapters.length <= 10
    };

    if (!getAllChapters && chapters.length <= 10) {
      mangaData.note = `يتم عرض ${chapters.length} فصل فقط. أضف &all=true للرابط لجلب جميع الفصول`;
    }

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: mangaData,
      metadata: {
        source: "olympustaff.com",
        timestamp: new Date().toISOString(),
        url: `https://olympustaff.com/series/${mangaId}`,
        proxyUsed: true,
        chaptersCount: chapters.length
      }
    });

  } catch {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "حدث خطأ داخلي في السيرفر",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// ===== الدوال الأساسية =====

// دالة لجلب البيانات عبر البروكسي
async function fetchWithProxies(url) {
  for (const getProxyUrl of proxyServices) {
    try {
      const proxyUrl = getProxyUrl(url);
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: baseHeaders,
        cache: 'no-store',
        timeout: 10000
      });

      if (!response.ok) continue;

      const html = await response.text();
      
      // تخطي صفحات Cloudflare
      if (html.includes('Just a moment') || html.includes('Enable JavaScript')) {
        continue;
      }

      return { html, proxy: proxyUrl };
    } catch {
      continue;
    }
  }
  return { html: null, proxy: null };
}

// دالة لاستخراج معلومات المانجا
function extractMangaInfo($, mangaId) {
  // العنوان
  const title = $('title').text()
    .replace(' - مانجا مترجمة', '')
    .replace(' | Team-X', '')
    .replace(/\s+/g, ' ')
    .trim();

  // الوصف
  const description = $('meta[name="description"]').attr('content') || 
                     $('meta[property="og:description"]').attr('content') || '';
  
  const cleanDesc = description
    .replace(/<[^>]*>/g, '')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // الصورة
  const image = $('meta[property="og:image"]').attr('content') ||
               $('meta[name="twitter:image"]').attr('content') ||
               $('img').first().attr('src');

  // النوع
  let type = 'manhwa';
  if (cleanDesc.toLowerCase().includes('مانجا')) type = 'manga';
  if (cleanDesc.toLowerCase().includes('مانهوا')) type = 'manhua';

  // التصنيفات
  const categories = extractMangaCategories($, title, cleanDesc);

  return {
    id: mangaId,
    title,
    slug: createSlug(title),
    description: cleanDesc,
    image: makeAbsoluteUrl(image),
    thumbnail: image ? `${makeAbsoluteUrl(image)}?w=300&h=450&fit=cover` : null,
    type,
    categories,
    url: `https://olympustaff.com/series/${mangaId}`,
    source: 'olympustaff'
  };
}

// دالة لاستخراج التصنيفات
function extractMangaCategories($, title, description) {
  const categories = new Set();
  
  // من meta keywords
  const keywords = $('meta[name="keywords"]').attr('content') || '';
  if (keywords) {
    keywords.split(/[،,]/).forEach(keyword => {
      const clean = keyword.trim();
      if (clean.length > 2 && clean.length < 30) {
        categories.add(clean);
      }
    });
  }
  
  // من عناصر التصنيفات في الصفحة
  $('.tag, .genre, .category, [class*="tag"], [class*="genre"]').each((_, el) => {
    const cat = $(el).text().trim();
    if (cat && cat.length > 1) {
      categories.add(cat);
    }
  });
  
  // من العنوان والوصف
  const commonGenres = {
    'أكشن': 'أكشن',
    'مغامرة': 'مغامرة',
    'فانتازيا': 'فانتازيا',
    'رومانسي': 'رومانسي',
    'كوميدي': 'كوميدي',
    'دراما': 'دراما',
    'خارق': 'خارق',
    'مستويات': 'مستويات',
    'برج': 'برج',
    'زراعة': 'زراعة',
    'فردي': 'فردي'
  };
  
  const allText = (title + ' ' + description).toLowerCase();
  Object.entries(commonGenres).forEach(([key, value]) => {
    if (allText.includes(key.toLowerCase())) {
      categories.add(value);
    }
  });
  
  return Array.from(categories).slice(0, 15);
}

// ===== معالجة الفصول =====

// دالة لجلب جميع الفصول
async function fetchAllChapters(mangaId) {
  const possibleUrls = [
    `https://olympustaff.com/series/${mangaId}/chapters`,
    `https://olympustaff.com/series/${mangaId}/all-chapters`,
    `https://olympustaff.com/series/${mangaId}?view=all`,
    `https://olympustaff.com/series/${mangaId}` // الصفحة الرئيسية كحل احتياطي
  ];

  let bestChapters = [];
  let bestSource = 'main-page';

  for (const url of possibleUrls) {
    try {
      const data = await fetchWithProxies(url);
      if (!data.html) continue;

      const $ = cheerio.load(data.html);
      const chapters = extractChaptersFromPage($, mangaId);
      
      if (chapters.length > bestChapters.length) {
        bestChapters = chapters;
        bestSource = url;
        
        // إذا حصلنا على أكثر من 20 فصل، نتوقف
        if (chapters.length > 20) break;
      }
    } catch {
      continue;
    }
  }

  return { chapters: bestChapters, source: bestSource };
}

// دالة لاستخراج الفصول من صفحة
function extractChaptersFromPage($, mangaId) {
  const chapters = [];
  
  // البحث في جميع الروابط للعثور على الفصول
  $('a').each((_, element) => {
    const link = $(element);
    const href = link.attr('href') || '';
    
    // التحقق مما إذا كان الرابط لفصل
    if (isChapterLink(href, mangaId)) {
      const chapterData = extractChapterData(link, href, mangaId);
      if (chapterData) {
        // تجنب التكرار
        if (!chapters.find(ch => ch.number === chapterData.number)) {
          chapters.push(chapterData);
        }
      }
    }
  });
  
  // ترتيب تنازلي وإزالة التكرارات
  return removeDuplicates(chapters.sort((a, b) => b.number - a.number));
}

// دالة للتحقق مما إذا كان الرابط لفصل
function isChapterLink(href, mangaId) {
  if (!href) return false;
  
  const patterns = [
    new RegExp(`/series/${mangaId}/\\d+`),
    new RegExp(`/series/${mangaId}/chapter-?\\d+`),
    new RegExp(`/chapter-?\\d+`),
    /\/\d+(?:\/|$)/
  ];
  
  return patterns.some(pattern => pattern.test(href));
}

// دالة لاستخراج بيانات الفصل
function extractChapterData(link, href, mangaId) {
  // استخراج رقم الفصل من الرابط
  const numberMatch = href.match(/\/(\d+)(?:\/|$)/) || 
                     href.match(/chapter-?(\d+)/i);
  if (!numberMatch) return null;
  
  const chapterNumber = parseInt(numberMatch[1]);
  
  // استخراج النص الكامل
  const fullText = link.text()
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // استخراج العنوان
  let title = fullText
    .replace(new RegExp(`^\\d{1,3}(?:,\\d{3})*\\s*`), '') // إزالة أرقام المشاهدات
    .replace(new RegExp(`الفصل\\s*${chapterNumber}\\s*[:-]?\\s*`, 'i'), '')
    .replace(/\\s*\\d+\\s*(?:years?|months?|days?|سنة|شهر|يوم).*/i, '')
    .trim();
  
  // إذا كان العنوان قصيراً، نأخذ جزءاً من النص
  if (!title || title.length < 3 || title === 'الفصل') {
    const parentText = link.parent().text()
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (parentText.length > fullText.length) {
      title = parentText
        .replace(new RegExp(`الفصل\\s*${chapterNumber}\\s*[:-]?\\s*`, 'i'), '')
        .replace(/\\s*\\d+\\s*(?:years?|months?|days?|سنة|شهر|يوم).*/i, '')
        .trim();
    }
  }
  
  // عنوان افتراضي إذا لزم الأمر
  if (!title || title.length < 2) {
    title = `الفصل ${chapterNumber}`;
  }
  
  // استخراج المشاهدات
  const viewsMatch = fullText.match(/(\d{1,3}(?:,\d{3})*)\s*(?:مشاهدة|view)/i);
  const views = viewsMatch ? parseInt(viewsMatch[1].replace(/,/g, '')) : null;
  
  // استخراج التاريخ
  const dateMatch = fullText.match(/(\d+\s*(?:years?|months?|days?|سنة|شهر|يوم)\s*(?:ago|قبل)?)/i);
  const date = dateMatch ? dateMatch[1] : null;
  
  return {
    number: chapterNumber,
    title: title,
    url: makeAbsoluteUrl(href),
    views: views,
    date: date,
    rawText: fullText
  };
}

// ===== دوال مساعدة =====

// دالة لإزالة الفصول المكررة
function removeDuplicates(chapters) {
  const unique = [];
  const seen = new Set();
  
  for (const chapter of chapters) {
    if (!seen.has(chapter.number)) {
      seen.add(chapter.number);
      unique.push(chapter);
    }
  }
  
  return unique;
}

// دالة لإنشاء slug
function createSlug(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// دالة لتحويل الرابط إلى مطلق
function makeAbsoluteUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `https://olympustaff.com${url.startsWith('/') ? url : '/' + url}`;
      } 
