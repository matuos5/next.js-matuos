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
            "/api/olympustaff/manga?id=SL&all=true"
          ]
        },
        { status: 400 }
      );
    }

    // الروابط المحتملة لصفحة الفصول الكاملة
    const possibleChapterUrls = [
      `https://olympustaff.com/series/${mangaId}/chapters`,
      `https://olympustaff.com/series/${mangaId}/all-chapters`,
      `https://olympustaff.com/series/${mangaId}?view=all`,
      `https://olympustaff.com/series/${mangaId}?page=all`,
      `https://olympustaff.com/series/${mangaId}`
    ];

    let allChapters = [];
    let chaptersSource = 'main-page';

    // إذا طلب المستخدم جميع الفصول
    if (getAllChapters) {
      console.log(`🔍 محاولة جلب جميع الفصول للمانجا: ${mangaId}`);
      
      // تجربة جميع الروابط المحتملة
      for (const chapterUrl of possibleChapterUrls) {
        try {
          const chapters = await fetchChaptersFromUrl(chapterUrl, mangaId);
          if (chapters.length > allChapters.length) {
            allChapters = chapters;
            chaptersSource = chapterUrl;
            console.log(`✅ تم العثور على ${chapters.length} فصل من: ${chapterUrl}`);
            
            if (chapters.length > 20) {
              break;
            }
          }
        } catch {
          // تجاهل الخطأ والمتابعة
          continue;
        }
      }
      
      if (allChapters.length <= 5) {
        console.log(`⚠️ لم نجد صفحة الفصول الكاملة، نستخدم الصفحة الرئيسية`);
        allChapters = await fetchChaptersFromUrl(possibleChapterUrls[4], mangaId);
      }
    } else {
      allChapters = await fetchChaptersFromUrl(possibleChapterUrls[4], mangaId);
    }

    // إذا فشلت جميع المحاولات
    if (allChapters.length === 0) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على أي فصول للمانجا",
          data: {
            mangaId,
            chaptersRequested: getAllChapters ? "جميع الفصول" : "الفصول المحدودة"
          }
        },
        { status: 404 }
      );
    }

    // جلب معلومات المانجا الأساسية
    const mangaInfo = await fetchMangaInfo(mangaId);
    
    if (!mangaInfo) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على المانجا",
          data: { mangaId }
        },
        { status: 404 }
      );
    }

    // بناء البيانات النهائية
    const mangaData = {
      ...mangaInfo,
      chapters: allChapters,
      chaptersInfo: {
        total: allChapters.length,
        source: chaptersSource,
        hasMore: allChapters.length > 50,
        limitedView: !getAllChapters && allChapters.length <= 10
      }
    };

    if (!getAllChapters && allChapters.length <= 10) {
      mangaData.note = `⚠️ يتم عرض ${allChapters.length} فصل فقط. استخدم &all=true لجلب جميع الفصول`;
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
        chaptersFetchedFrom: chaptersSource,
        proxyUsed: true
      }
    });

  } catch {
    // إصلاح السطر 89: استخدام catch {} بدون معلمة
    console.error("❌ خطأ في API:");
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

// دالة جديدة لجلب الفصول من رابط محدد
async function fetchChaptersFromUrl(url, mangaId) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
    'sec-ch-ua-mobile': '?1',
    'referer': `https://olympustaff.com/?search=${encodeURIComponent(mangaId)}`,
    'accept-language': 'ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6'
  };

  let chapters = [];

  for (const getProxyUrl of proxyServices) {
    try {
      const proxyUrl = getProxyUrl(url);
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: headers,
        cache: 'no-store'
      });

      if (!response.ok) continue;

      const html = await response.text();
      
      if (html.includes('Just a moment') || html.includes('Enable JavaScript')) {
        continue;
      }

      const $ = cheerio.load(html);
      chapters = extractChaptersData($, mangaId);
      
      if (chapters.length > 0) {
        break;
      }
    } catch {
      // إصلاح السطر 54: تجاهل الخطأ بدون معلمة
      continue;
    }
  }

  return chapters;
}

// دالة لجلب معلومات المانجا الأساسية
async function fetchMangaInfo(mangaId) {
  const url = `https://olympustaff.com/series/${mangaId}`;
  
  for (const getProxyUrl of proxyServices) {
    try {
      const proxyUrl = getProxyUrl(url);
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7'
        },
        cache: 'no-store'
      });

      if (!response.ok) continue;

      const html = await response.text();
      
      if (html.includes('Just a moment') || html.includes('Enable JavaScript')) {
        continue;
      }

      const $ = cheerio.load(html);
      return extractMangaDetails($, mangaId, html);
      
    } catch {
      // إصلاح السطر 133: تجاهل الخطأ بدون معلمة
      continue;
    }
  }
  
  return null;
}

// دالة لاستخراج تفاصيل المانجا من HTML
function extractMangaDetails($, mangaId) {
  const title = $('title').text()
    .replace(' - مانجا مترجمة', '')
    .replace(' | Team-X', '')
    .replace(/\s+/g, ' ')
    .trim();
  
  const description = $('meta[name="description"]').attr('content') || 
                     $('meta[property="og:description"]').attr('content') || '';
  
  const image = $('meta[property="og:image"]').attr('content') ||
               $('meta[name="twitter:image"]').attr('content') ||
               $('img').first().attr('src');
  
  const keywords = $('meta[name="keywords"]').attr('content') || '';
  
  let type = 'manhwa';
  const descLower = description.toLowerCase();
  if (descLower.includes('مانجا') || descLower.includes('manga')) {
    type = 'manga';
  } else if (descLower.includes('مانهوا') || descLower.includes('manhua')) {
    type = 'manhua';
  }
  
  const categories = extractCategories(keywords, title, $);
  
  return {
    id: mangaId,
    title,
    slug: slugifyName(title),
    description: cleanDescription(description),
    image: ensureAbsoluteUrl(image),
    thumbnail: image ? `${ensureAbsoluteUrl(image)}?w=300&h=450&fit=cover` : null,
    type,
    categories,
    url: `https://olympustaff.com/series/${mangaId}`,
    source: 'olympustaff'
  };
}

// دالة لاستخراج الفصول
function extractChaptersData($, mangaId) {
  const chapters = [];
  
  // البحث في جداول الفصول
  $('table tbody tr, .table tbody tr, .chapters-table tr').each((_, row) => {
    const element = $(row);
    extractChapterFromRow(element, mangaId, chapters);
  });
  
  // البحث في القوائم
  if (chapters.length === 0) {
    $('.chapter-list li, .chapters-list li, [class*="chapter-item"]').each((_, li) => {
      const element = $(li);
      extractChapterFromRow(element, mangaId, chapters);
    });
  }
  
  // البحث في الروابط
  if (chapters.length === 0) {
    $('a').each((_, link) => {
      const element = $(link);
      const href = element.attr('href') || '';
      
      if (href.includes('/chapter') || href.includes(`/series/${mangaId}/`)) {
        const chapterMatch = href.match(/\/chapter-?(\d+)/) || 
                            href.match(/\/(\d+)(?:\/|$)/);
        
        if (chapterMatch) {
          const chapterNumber = parseInt(chapterMatch[1]);
          const text = element.text().trim();
          
          if (!chapters.find(ch => ch.number === chapterNumber)) {
            const cleanTitle = text
              .replace(/\d{1,3}(?:,\d{3})*/g, '')
              .replace(/الفصل\s*\d+\s*[:-]?\s*/i, '')
              .trim();
            
            chapters.push({
              number: chapterNumber,
              title: cleanTitle || `الفصل ${chapterNumber}`,
              url: ensureAbsoluteUrl(href),
              source: 'link-extraction'
            });
          }
        }
      }
    });
  }
  
  // إزالة التكرارات والترتيب
  return removeDuplicates(chapters.sort((a, b) => b.number - a.number));
}

// دالة مساعدة لاستخراج فصل من صف
function extractChapterFromRow(element, mangaId, chaptersArray) {
  const text = element.text().trim();
  if (!text || text.length < 3) return;
  
  const link = element.find('a').first();
  const href = link.attr('href') || '';
  
  const chapterNumber = extractChapterNumber(text, href, mangaId);
  if (!chapterNumber) return;
  
  const chapterTitle = extractChapterTitle(text, chapterNumber);
  const views = extractViewsCount(text);
  const date = extractPublishDate(element);
  
  if (!chaptersArray.find(ch => ch.number === chapterNumber)) {
    chaptersArray.push({
      number: chapterNumber,
      title: chapterTitle,
      url: ensureAbsoluteUrl(href) || `https://olympustaff.com/series/${mangaId}/chapter-${chapterNumber}`,
      views: views,
      date: date,
      rawText: text.replace(/\s+/g, ' ').trim()
    });
  }
}

// دوال مساعدة
function extractChapterNumber(text, href, mangaId) {
  let chapterNumber = null;
  
  if (href) {
    const urlPatterns = [
      new RegExp(`/series/${mangaId}/chapter-?(\\d+)`, 'i'),
      new RegExp(`/series/${mangaId}/(\\d+)`, 'i'),
      new RegExp(`/chapter-?(\\d+)`, 'i'),
      new RegExp(`/(\\d+)(?:/|$)`, 'i')
    ];
    
    for (const pattern of urlPatterns) {
      const match = href.match(pattern);
      if (match) {
        chapterNumber = parseInt(match[1]);
        break;
      }
    }
  }
  
  if (!chapterNumber) {
    const textPatterns = [
      /الفصل\s*(\d+)/i,
      /Chapter\s*(\d+)/i,
      /\b(\d{1,3})\b(?=.*فصل)/i
    ];
    
    for (const pattern of textPatterns) {
      const match = text.match(pattern);
      if (match) {
        chapterNumber = parseInt(match[1]);
        break;
      }
    }
  }
  
  return chapterNumber;
}

function extractChapterTitle(text, chapterNumber) {
  let cleanTitle = text.replace(/\d{1,3}(?:,\d{3})*/g, '');
  cleanTitle = cleanTitle
    .replace(new RegExp(`الفصل\\s*${chapterNumber}\\s*[:-]?\\s*`, 'i'), '')
    .replace(new RegExp(`Chapter\\s*${chapterNumber}\\s*[:-]?\\s*`, 'i'), '');
  cleanTitle = cleanTitle.replace(/\d+\s*(?:years?|months?|days?|سنة|شهر|يوم)\s*(?:ago|قبل)?/gi, '');
  cleanTitle = cleanTitle
    .replace(/[،:;]\s*$/, '')
    .replace(/^\s*[:-]\s*/, '')
    .trim();
  
  return cleanTitle || `الفصل ${chapterNumber}`;
}

function extractViewsCount(text) {
  const viewsMatch = text.match(/(\d{1,3}(?:,\d{3})*)\s*(?:مشاهدة|views?|view)/i);
  if (viewsMatch) {
    return parseInt(viewsMatch[1].replace(/,/g, ''));
  }
  
  const numberMatch = text.match(/^(\d{1,3}(?:,\d{3})*)/);
  if (numberMatch) {
    return parseInt(numberMatch[1].replace(/,/g, ''));
  }
  
  return null;
}

function extractPublishDate(element) {
  const dateText = element.find('.date, .time, [class*="date"], [class*="time"]').text().trim();
  if (dateText) return dateText;
  
  const text = element.text();
  const datePatterns = [
    /\d+\s*(?:years?|months?|days?)\s*ago/i,
    /\d+\s*(?:سنة|شهر|يوم)\s*قبل/i,
    /\d{1,2}\/\d{1,2}\/\d{4}/,
    /\d{4}-\d{2}-\d{2}/
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}

function extractCategories(keywords, title, $) {
  const categories = new Set();
  
  if (keywords) {
    keywords.split(',').map(k => k.trim()).forEach(keyword => {
      if (keyword.length > 2 && 
          !['مانجا', 'مانهوا', 'مترجمة', 'team-x', 'teamx'].includes(keyword.toLowerCase())) {
        categories.add(keyword);
      }
    });
  }
  
  $('.tags a, .genres a, .categories a, [class*="tag"], [class*="genre"]').each((_, el) => {
    const category = $(el).text().trim();
    if (category && category.length > 2) {
      categories.add(category);
    }
  });
  
  const titleWords = title.toLowerCase().split(/[\s\-]+/);
  const commonGenres = [
    'action', 'أكشن', 'adventure', 'مغامرة', 'fantasy', 'فانتازيا',
    'romance', 'رومانسي', 'comedy', 'كوميدي', 'drama', 'دراما',
    'supernatural', 'خارق', 'leveling', 'مستويات', 'tower', 'برج',
    'farming', 'زراعة', 'solo', 'فردي'
  ];
  
  titleWords.forEach(word => {
    commonGenres.forEach(genre => {
      if (word === genre || word.includes(genre)) {
        categories.add(genre);
      }
    });
  });
  
  return Array.from(categories);
}

function cleanDescription(desc) {
  if (!desc) return '';
  return desc
    .replace(/<[^>]*>/g, '')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/مانجا\s+([^مترجمة]+)\s+مترجمة/, '$1')
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
