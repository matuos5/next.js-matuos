// app/api/olympustaff/manga/route.js

import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

// خدمات البروكسي
const proxyServices = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`,
];

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const searchParams = url.searchParams;
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

    // جلب بيانات المانجا
    const mainData = await getPageData(`https://olympustaff.com/series/${mangaId}`);
    if (!mainData) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على المانجا أو فشل الاتصال",
        },
        { status: 404 }
      );
    }

    const $main = cheerio.load(mainData);
    const mangaInfo = getMangaDetails($main, mangaId);

    // جلب الفصول
    let chapters = [];
    let chaptersSource = 'main-page';
    let chaptersStats = {};

    if (getAllChapters) {
      const allChaptersResult = await getAllAvailableChapters(mangaId);
      chapters = allChaptersResult.chapters;
      chaptersSource = allChaptersResult.source;
      
      // إضافة فصول مفقودة
      const generatedChapters = generateMissingChapterUrls(chapters, mangaId);
      chapters = [...chapters, ...generatedChapters];
      
      // معالجة نهائية
      const processed = processCollectedChapters(chapters);
      chapters = processed.chapters;
      chaptersStats = processed.stats;
    } else {
      chapters = getChaptersFromPage($main, mangaId);
      chaptersStats = {
        total: chapters.length,
        range: `عدد الفصول: ${chapters.length}`,
        completeness: "100%"
      };
    }

    // بناء الاستجابة النهائية
    const responseData = {
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: {
        ...mangaInfo,
        chapters: chapters,
        chaptersInfo: {
          total: chapters.length,
          source: chaptersSource,
          hasMore: chapters.length > 50,
          stats: chaptersStats
        }
      },
      metadata: {
        source: "olympustaff.com",
        timestamp: new Date().toISOString(),
        url: `https://olympustaff.com/series/${mangaId}`,
        chaptersCount: chapters.length
      }
    };

    if (!getAllChapters && chapters.length <= 10) {
      responseData.data.note = `يتم عرض ${chapters.length} فصل فقط. أضف &all=true للرابط لجلب جميع الفصول`;
    }

    if (chaptersStats.missingCount > 0) {
      responseData.data.note = `تم العثور على ${chapters.length - chaptersStats.missingCount} فصل مباشرة، وتم توليد ${chaptersStats.missingCount} فصل للروابط المفقودة`;
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error("Error in manga API:", error);
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

async function getPageData(url, retries = 3) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ar,en-US;q=0.7,en;q=0.3',
    'Referer': 'https://olympustaff.com/',
  };

  for (let attempt = 0; attempt < retries; attempt++) {
    const shuffledProxies = [...proxyServices].sort(() => Math.random() - 0.5);
    
    for (const getProxyUrl of shuffledProxies) {
      try {
        const proxyUrl = getProxyUrl(url);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(proxyUrl, {
          headers: headers,
          cache: 'no-store',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const html = await response.text();
          
          if (html.includes('Just a moment') || 
              html.includes('Cloudflare') || 
              html.length < 1000) {
            continue;
          }
          
          return html;
        }
      } catch {
        continue;
      }
    }
    
    if (attempt < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  
  return null;
}

function getMangaDetails($, mangaId) {
  const titleText = $('title').text();
  const title = titleText
    .replace(' - مانجا مترجمة', '')
    .replace(' | Team-X', '')
    .replace(/\s+/g, ' ')
    .trim();

  const descMeta = $('meta[name="description"]').attr('content') || '';
  const description = descMeta
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const image = $('meta[property="og:image"]').attr('content') || '';

  let type = 'manhwa';
  if (description.includes('مانجا')) type = 'manga';
  if (description.includes('مانهوا')) type = 'manhua';

  const author = $('.info:contains("المؤلف")').next().text() || 
                 $('span:contains("المؤلف")').next().text() || 'غير معروف';
  
  const status = $('.info:contains("الحالة")').next().text() || 
                 $('span:contains("الحالة")').next().text() || 'مستمرة';

  return {
    id: mangaId,
    title: title,
    slug: generateSlug(title),
    description: description,
    image: fixUrl(image),
    type: type,
    author: author.trim(),
    status: status.trim(),
    url: `https://olympustaff.com/series/${mangaId}`
  };
}

async function getAllAvailableChapters(mangaId) {
  const baseUrls = [
    `https://olympustaff.com/series/${mangaId}/chapters`,
    `https://olympustaff.com/series/${mangaId}`,
  ];
  
  let bestChapters = [];
  let bestSource = 'main-page';
  
  for (const baseUrl of baseUrls) {
    const chapters = await fetchPaginatedChapters(baseUrl, mangaId);
    
    if (chapters.length > bestChapters.length) {
      bestChapters = chapters;
      bestSource = baseUrl;
    }
  }
  
  return { chapters: bestChapters, source: bestSource };
}

async function fetchPaginatedChapters(baseUrl, mangaId) {
  let allChapters = [];
  let currentPage = 1;
  const maxPages = 50;
  
  while (currentPage <= maxPages) {
    let pageUrl;
    
    if (currentPage === 1) {
      pageUrl = baseUrl;
    } else {
      pageUrl = `${baseUrl}?page=${currentPage}`;
    }
    
    const html = await getPageData(pageUrl);
    if (!html) break;
    
    const $ = cheerio.load(html);
    const pageChapters = getChaptersFromPage($, mangaId);
    
    if (pageChapters.length === 0) break;
    
    // التحقق من التكرارات
    const newChapters = pageChapters.filter(ch => 
      !allChapters.some(existing => existing.number === ch.number)
    );
    
    if (newChapters.length === 0 && pageChapters.length > 0) {
      break;
    }
    
    allChapters = [...allChapters, ...newChapters];
    
    // البحث عن رابط الصفحة التالية
    const nextPageLinks = $('a').filter((_, el) => {
      const $el = $(el);
      const text = $el.text().toLowerCase();
      const href = $el.attr('href') || '';
      
      return (
        text.includes('next') || 
        text.includes('التالي') || 
        href.includes(`page=${currentPage + 1}`)
      );
    });
    
    const hasNextPage = nextPageLinks.length > 0;
    
    if (!hasNextPage) break;
    currentPage++;
  }
  
  return allChapters;
}

function getChaptersFromPage($, mangaId) {
  const chaptersFound = [];
  const seenNumbers = new Set();
  
  // البحث في الروابط
  $('a').each((_, element) => {
    const link = $(element);
    const href = link.attr('href');
    
    if (!href) return;
    
    const isChapter = (
      (href.includes(`/series/${mangaId}/`) && 
       (href.includes('/chapter') || href.includes('/ch-') || /\/(\d+(?:\.\d+)?)(?:\/|$)/.test(href))) ||
      /^\/series\/[^\/]+\/(chapter-)?\d+(?:\.\d+)?(?:\/|$)/.test(href)
    );
    
    if (isChapter) {
      const chapterInfo = extractChapterInfo(link, href);
      if (chapterInfo && !seenNumbers.has(chapterInfo.number)) {
        seenNumbers.add(chapterInfo.number);
        chaptersFound.push(chapterInfo);
      }
    }
  });
  
  const sorted = chaptersFound.sort((a, b) => b.number - a.number);
  return sorted;
}

function extractChapterInfo(linkElement, href) {
  // أنماط استخراج رقم الفصل
  const numPatterns = [
    /\/(chapter-?)?(\d+(?:\.\d+)?)(?:\/|$)/i,
    /chapter[_-]?(\d+(?:\.\d+)?)/i,
    /\b(\d+(?:\.\d+)?)\s*$/,
    /ch\.?\s*(\d+(?:\.\d+)?)/i,
    /فصل\s*(\d+(?:\.\d+)?)/i
  ];
  
  let chapterNum = null;
  
  for (const pattern of numPatterns) {
    const match = href.match(pattern);
    if (match) {
      chapterNum = parseFloat(match[1] || match[2]);
      break;
    }
  }
  
  if (!chapterNum) {
    const text = linkElement.text();
    const textMatch = text.match(/\b(\d+(?:\.\d+)?)\b/);
    if (textMatch) {
      chapterNum = parseFloat(textMatch[1]);
    }
  }
  
  if (!chapterNum) return null;
  
  const fullText = linkElement.text()
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  let title = fullText
    .replace(new RegExp(`^\\s*${chapterNum}\\s*[-:]?\\s*`), '')
    .replace(new RegExp(`الفصل\\s*${chapterNum}\\s*[:-]?\\s*`, 'i'), '')
    .trim();
  
  if (!title || title.length < 2 || title === String(chapterNum)) {
    title = `الفصل ${chapterNum}`;
  }
  
  const viewsMatch = fullText.match(/(\d{1,3}(?:,\d{3})*)\s*(?:مشاهدة|view)/i);
  const views = viewsMatch ? parseInt(viewsMatch[1].replace(/,/g, '')) : null;
  
  const dateMatch = fullText.match(/(\d{1,2}\/\d{1,2}\/\d{4})|(\d+\s*(?:سنة|شهر|يوم))/i);
  const date = dateMatch ? dateMatch[0] : null;
  
  return {
    number: chapterNum,
    title: title.substring(0, 200),
    url: fixUrl(href),
    views: views,
    date: date,
    estimated: false
  };
}

function generateMissingChapterUrls(foundChapters, mangaId) {
  if (foundChapters.length === 0) return [];
  
  const sorted = [...foundChapters].sort((a, b) => a.number - b.number);
  const minChapter = sorted[0].number;
  const maxChapter = sorted[sorted.length - 1].number;
  const foundNumbers = new Set(sorted.map(ch => ch.number));
  
  const generated = [];
  
  // توليد الفصول المفقودة في النطاق
  for (let i = minChapter; i <= maxChapter; i++) {
    if (!foundNumbers.has(i)) {
      generated.push({
        number: i,
        title: `الفصل ${i}`,
        url: `https://olympustaff.com/series/${mangaId}/chapter-${i}`,
        estimated: true,
        needsVerification: true,
        generated: true
      });
    }
  }
  
  // توليد فصول قبل النطاق الموجود فقط (حذف extraAfter)
  const extraBefore = 5;
  
  for (let i = minChapter - 1; i >= Math.max(1, minChapter - extraBefore); i--) {
    if (!foundNumbers.has(i)) {
      generated.push({
        number: i,
        title: `الفصل ${i}`,
        url: `https://olympustaff.com/series/${mangaId}/chapter-${i}`,
        estimated: true,
        needsVerification: true,
        generated: true
      });
    }
  }
  
  return generated;
}

function processCollectedChapters(rawChapters) {
  const uniqueChapters = [];
  const seenKeys = new Set();
  
  for (const chapter of rawChapters) {
    const key = `${chapter.number}:${chapter.url}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueChapters.push(chapter);
    }
  }
  
  uniqueChapters.sort((a, b) => b.number - a.number);
  
  const chapterNumbers = uniqueChapters.map(ch => ch.number);
  const maxChapter = Math.max(...chapterNumbers);
  const minChapter = Math.min(...chapterNumbers);
  const missingChapters = [];
  
  const nonEstimatedChapters = uniqueChapters.filter(ch => !ch.estimated);
  const nonEstimatedNumbers = nonEstimatedChapters.map(ch => ch.number);
  
  if (nonEstimatedNumbers.length > 0) {
    const nonEstimatedMax = Math.max(...nonEstimatedNumbers);
    const nonEstimatedMin = Math.min(...nonEstimatedNumbers);
    
    for (let i = nonEstimatedMin; i <= nonEstimatedMax; i++) {
      if (!nonEstimatedNumbers.includes(i) && !chapterNumbers.includes(i)) {
        missingChapters.push(i);
      }
    }
  }
  
  const estimatedChapters = uniqueChapters.filter(ch => ch.estimated).length;
  const verifiedChapters = uniqueChapters.filter(ch => !ch.estimated).length;
  
  const completeness = nonEstimatedNumbers.length > 0 ? 
    ((nonEstimatedNumbers.length / (Math.max(1, nonEstimatedMax - nonEstimatedMin + 1))) * 100).toFixed(1) : 
    "0.0";
  
  return {
    chapters: uniqueChapters,
    stats: {
      total: uniqueChapters.length,
      verified: verifiedChapters,
      estimated: estimatedChapters,
      range: `${minChapter} - ${maxChapter}`,
      missingCount: missingChapters.length,
      missing: missingChapters.slice(0, 20),
      completeness: `${completeness}%`
    }
  };
}

// ===== دوال مساعدة =====

function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .substring(0, 100);
}

function fixUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `https://olympustaff.com${url}`;
  return `https://olympustaff.com/${url}`;
}

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
}; 
