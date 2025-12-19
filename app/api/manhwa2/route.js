// app/api/olympustaff/manga/route.js

import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

// خدمات البروكسي مع إضافة المزيد من الخيارات
const proxyServices = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`,
  (url) => `https://cors-anywhere.herokuapp.com/${url}`,
  (url) => `https://proxy.cors.sh/${url}`,
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

    // جلب بيانات المانجا الرئيسية
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
      
      // إضافة فصول مفقودة واستكمال السلاسل
      const generatedChapters = generateMissingChapterUrls(chapters, mangaId);
      chapters = [...chapters, ...generatedChapters];
      
      // معالجة نهائية وتنظيف
      const processed = processCollectedChapters(chapters, mangaId);
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
        chaptersCount: chapters.length,
        collectionMethod: getAllChapters ? "full-scrape-with-fallback" : "basic-scrape"
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
        timestamp: new Date().toISOString(),
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// ===== الدوال الأساسية =====

/**
 * جلب بيانات الصفحة مع نظام بروكسي متقدم وإعادة محاولة
 */
async function getPageData(url, retries = 3) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ar,en-US;q=0.7,en;q=0.3',
    'Referer': 'https://olympustaff.com/',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
  };

  for (let attempt = 0; attempt < retries; attempt++) {
    // خلط خدمات البروكسي عشوائياً لكل محاولة
    const shuffledProxies = [...proxyServices].sort(() => Math.random() - 0.5);
    
    for (const getProxyUrl of shuffledProxies) {
      try {
        const proxyUrl = getProxyUrl(url);
        console.log(`جرب البروكسي: ${proxyUrl.substring(0, 50)}...`);
        
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
          
          // التحقق من صفحات الحجب
          if (html.includes('Just a moment') || 
              html.includes('Cloudflare') || 
              html.includes('الوصول مرفوض') ||
              html.length < 1000) {
            console.log("تم حجب الطلب، جرب بروكسي آخر...");
            continue;
          }
          
          console.log(`نجح جلب البيانات، حجم HTML: ${html.length} حرف`);
          return html;
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log("انتهت مهلة الطلب، جرب بروكسي آخر...");
        }
        continue;
      }
    }
    
    // الانتظار قبل إعادة المحاولة
    if (attempt < retries - 1) {
      console.log(`انتظر ${attempt + 1} ثانية قبل إعادة المحاولة...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  
  console.error(`فشل جلب البيانات بعد ${retries} محاولات`);
  return null;
}

/**
 * استخراج تفاصيل المانجا
 */
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

  // البحث عن معلومات إضافية
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

/**
 * جلب جميع الفصول المتاحة مع دعم الصفحات
 */
async function getAllAvailableChapters(mangaId) {
  const baseUrls = [
    `https://olympustaff.com/series/${mangaId}/chapters`,
    `https://olympustaff.com/series/${mangaId}`,
    `https://olympustaff.com/series/${mangaId}/all`,
    `https://olympustaff.com/series/${mangaId}?view=all`
  ];
  
  let bestChapters = [];
  let bestSource = 'main-page';
  
  for (const baseUrl of baseUrls) {
    console.log(`جرب جلب الفصول من: ${baseUrl}`);
    const chapters = await fetchPaginatedChapters(baseUrl, mangaId);
    
    if (chapters.length > bestChapters.length) {
      bestChapters = chapters;
      bestSource = baseUrl;
      console.log(`تم العثور على ${chapters.length} فصل من ${baseUrl}`);
    }
  }
  
  return { chapters: bestChapters, source: bestSource };
}

/**
 * جلب الفصول من صفحات متعددة (دعم الترقيم)
 */
async function fetchPaginatedChapters(baseUrl, mangaId) {
  let allChapters = [];
  let currentPage = 1;
  const maxPages = 50; // حد أقصى آمن للصفحات
  
  console.log(`بدء جلب الفصول من الرابط الأساسي: ${baseUrl}`);
  
  while (currentPage <= maxPages) {
    let pageUrl;
    
    if (currentPage === 1) {
      pageUrl = baseUrl;
    } else {
      // أنماط الترقيم الشائعة
      pageUrl = `${baseUrl}?page=${currentPage}`;
      
      // جرب أنماطاً أخرى أيضاً
      if (baseUrl.includes('?')) {
        pageUrl = `${baseUrl}&page=${currentPage}`;
      }
    }
    
    console.log(`جلب الصفحة ${currentPage}: ${pageUrl}`);
    const html = await getPageData(pageUrl);
    if (!html) {
      console.log(`لا توجد بيانات للصفحة ${currentPage}`);
      break;
    }
    
    const $ = cheerio.load(html);
    const pageChapters = getChaptersFromPage($, mangaId);
    
    console.log(`تم العثور على ${pageChapters.length} فصل في الصفحة ${currentPage}`);
    
    if (pageChapters.length === 0) {
      console.log(`لا توجد فصول في الصفحة ${currentPage}`);
      break;
    }
    
    // التحقق من التكرارات
    const newChapters = pageChapters.filter(ch => 
      !allChapters.some(existing => existing.number === ch.number)
    );
    
    if (newChapters.length === 0 && pageChapters.length > 0) {
      console.log("تكرار الفصول، توقف عن الجلب");
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
        text.includes('الصفحة التالية') ||
        href.includes(`page=${currentPage + 1}`) ||
        href.includes(`/page/${currentPage + 1}`)
      );
    });
    
    const hasNextPage = nextPageLinks.length > 0;
    
    if (!hasNextPage) {
      console.log("لا توجد صفحة تالية");
      break;
    }
    
    currentPage++;
  }
  
  console.log(`تم جلب إجمالي ${allChapters.length} فصل من ${currentPage - 1} صفحة`);
  return allChapters;
}

/**
 * استخراج الفصول من صفحة معينة
 */
function getChaptersFromPage($, mangaId) {
  const chaptersFound = [];
  const seenNumbers = new Set();
  
  console.log(`بدء استخراج الفصول من الصفحة`);
  
  // البحث في جميع الروابط
  $('a').each((_, element) => {
    const link = $(element);
    const href = link.attr('href');
    
    if (!href) return;
    
    // أنماط أكثر مرونة للتعرف على الفصول
    const isChapter = (
      // الروابط التي تحتوي معرف المانجا
      (href.includes(`/series/${mangaId}/`) && 
       (href.includes('/chapter') || href.includes('/ch-') || /\/(\d+(?:\.\d+)?)(?:\/|$)/.test(href))) ||
      // الروابط التي تبدأ مباشرة برقم الفصل
      /^\/series\/[^\/]+\/(chapter-)?\d+(?:\.\d+)?(?:\/|$)/.test(href) ||
      // روابط الفصول العامة
      (href.includes('/chapter/') && href.includes(mangaId))
    );
    
    if (isChapter) {
      const chapterInfo = extractChapterInfo(link, href, mangaId);
      if (chapterInfo && !seenNumbers.has(chapterInfo.number)) {
        seenNumbers.add(chapterInfo.number);
        chaptersFound.push(chapterInfo);
      }
    }
  });
  
  // البحث أيضاً في عناصر أخرى (divs, spans)
  $('div, span').each((_, element) => {
    const el = $(element);
    const text = el.text();
    
    // البحث عن أرقام الفصول في النصوص
    const chapterMatch = text.match(/الفصل\s*(\d+(?:\.\d+)?)/i);
    if (chapterMatch) {
      const chapterNum = parseFloat(chapterMatch[1]);
      
      // البحث عن رابط في العنصر أو العناصر المحيطة
      const link = el.find('a').first() || el.closest('a');
      const href = link.attr('href');
      
      if (href && !seenNumbers.has(chapterNum)) {
        const chapterInfo = {
          number: chapterNum,
          title: text.trim().substring(0, 100),
          url: fixUrl(href),
          estimated: false,
          needsVerification: false
        };
        
        seenNumbers.add(chapterNum);
        chaptersFound.push(chapterInfo);
      }
    }
  });
  
  // ترتيب الفصول تنازلياً
  const sorted = chaptersFound.sort((a, b) => b.number - a.number);
  console.log(`تم استخراج ${sorted.length} فصل من الصفحة`);
  
  return sorted;
}

/**
 * استخراج معلومات الفصل من رابط
 */
function extractChapterInfo(linkElement, href, mangaId) {
  // أنماط أكثر مرونة لاستخراج رقم الفصل
  const numPatterns = [
    /\/(chapter-?)?(\d+(?:\.\d+)?)(?:\/|$)/i,               // /chapter-123/ أو /123/
    /chapter[_-]?(\d+(?:\.\d+)?)/i,                         // chapter_123
    /\b(\d+(?:\.\d+)?)\s*$/,                                // أرقام في النهاية
    /ch\.?\s*(\d+(?:\.\d+)?)/i,                             // ch.123
    /فصل\s*(\d+(?:\.\d+)?)/i                                // فصل 123
  ];
  
  let chapterNum = null;
  let matchedPattern = '';
  
  for (const pattern of numPatterns) {
    const match = href.match(pattern);
    if (match) {
      chapterNum = parseFloat(match[1] || match[2]);
      matchedPattern = pattern.toString();
      break;
    }
  }
  
  // إذا لم يتم العثور، جرب من النص
  if (!chapterNum) {
    const text = linkElement.text();
    const textMatch = text.match(/\b(\d+(?:\.\d+)?)\b/);
    if (textMatch) {
      chapterNum = parseFloat(textMatch[1]);
    }
  }
  
  if (!chapterNum) return null;
  
  // النص الكامل
  const fullText = linkElement.text()
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // استخراج العنوان
  let title = fullText
    .replace(new RegExp(`^\\s*${chapterNum}\\s*[-:]?\\s*`), '')  // بدأ برقم
    .replace(new RegExp(`الفصل\\s*${chapterNum}\\s*[:-]?\\s*`, 'i'), '')  // بدأ بـ"الفصل"
    .replace(new RegExp(`chapter\\s*${chapterNum}\\s*[:-]?\\s*`, 'i'), '')  // بدأ بـ"chapter"
    .trim();
  
  if (!title || title.length < 2 || title === String(chapterNum)) {
    title = `الفصل ${chapterNum}`;
  }
  
  // استخراج المشاهدات
  const viewsMatch = fullText.match(/(\d{1,3}(?:,\d{3})*)\s*(?:مشاهدة|view)/i);
  const views = viewsMatch ? parseInt(viewsMatch[1].replace(/,/g, '')) : null;
  
  // استخراج التاريخ
  const dateMatch = fullText.match(/(\d{1,2}\/\d{1,2}\/\d{4})|(\d+\s*(?:سنة|شهر|يوم|years?|months?|days?))/i);
  const date = dateMatch ? dateMatch[0] : null;
  
  return {
    number: chapterNum,
    title: title.substring(0, 200),
    url: fixUrl(href),
    views: views,
    date: date,
    matchedPattern: matchedPattern.substring(0, 30),
    estimated: false
  };
}

/**
 * توليد روابط للفصول المفقودة
 */
function generateMissingChapterUrls(foundChapters, mangaId) {
  if (foundChapters.length === 0) {
    console.log("لا توجد فصول لعمل توليد للفصول المفقودة");
    return [];
  }
  
  // ترتيب الفصول تصاعدياً
  const sorted = [...foundChapters].sort((a, b) => a.number - b.number);
  const minChapter = sorted[0].number;
  const maxChapter = sorted[sorted.length - 1].number;
  const foundNumbers = new Set(sorted.map(ch => ch.number));
  
  console.log(`نطاق الفصول: ${minChapter} إلى ${maxChapter}`);
  console.log(`الفصول الموجودة: ${foundNumbers.size}`);
  
  const generated = [];
  let generatedCount = 0;
  
  // توليد الفصول المفقودة في النطاق
  for (let i = minChapter; i <= maxChapter; i++) {
    if (!foundNumbers.has(i)) {
      // أنماط مختلفة للروابط
      const possibleUrls = [
        `https://olympustaff.com/series/${mangaId}/chapter-${i}`,
        `https://olympustaff.com/series/${mangaId}/${i}`,
        `https://olympustaff.com/series/${mangaId}/ch-${i}`,
        `https://olympustaff.com/series/${mangaId}/ch${i}`,
        `https://olympustaff.com/series/${mangaId}/chapter/${i}`
      ];
      
      generated.push({
        number: i,
        title: `الفصل ${i}`,
        url: possibleUrls[0],
        estimated: true,
        needsVerification: true,
        generated: true,
        note: `تم توليد الرابط تلقائياً للفصل المفقود`
      });
      
      generatedCount++;
    }
  }
  
  // توليد فصول قبل وأبعد النطاق الموجود
  const extraBefore = 5;
  const extraAfter = 5;
  
  for (let i = minChapter - 1; i >= Math.max(1, minChapter - extraBefore); i--) {
    if (!foundNumbers.has(i)) {
      generated.push({
        number: i,
        title: `الفصل ${i}`,
        url: `https://olympustaff.com/series/${mangaId}/chapter-${i}`,
        estimated: true,
        needsVerification: true,
        generated: true,
        note: `فصل إضافي مفترض قبل النطاق`
      });
      generatedCount++;
    }
  }
  
  console.log(`تم توليد ${generatedCount} فصل مفقود`);
  return generated;
}

/**
 * معالجة نهائية للفصول المجمعة
 */
function processCollectedChapters(rawChapters, mangaId) {
  console.log(`بدء معالجة ${rawChapters.length} فصل`);
  
  // 1. إزالة التكرارات الدقيقة (نفس الرقم ونفس الرابط)
  const uniqueChapters = [];
  const seenKeys = new Set();
  
  for (const chapter of rawChapters) {
    const key = `${chapter.number}:${chapter.url}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueChapters.push(chapter);
    }
  }
  
  console.log(`بعد إزالة التكرارات: ${uniqueChapters.length} فصل`);
  
  // 2. فرز الفصول حسب الرقم
  uniqueChapters.sort((a, b) => b.number - a.number);
  
  // 3. التعرف على الفجوات في الترقيم
  const chapterNumbers = uniqueChapters.map(ch => ch.number);
  const maxChapter = Math.max(...chapterNumbers);
  const minChapter = Math.min(...chapterNumbers);
  const missingChapters = [];
  
  // حساب الفجوات فقط للفصول غير المقدرة
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
  
  // 4. احصائيات مفصلة
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
      completeness: `${completeness}%`,
      note: missingChapters.length > 0 ? 
        `يوجد ${missingChapters.length} فصل مفقود في التسلسل` : 
        "التسلسل كامل"
    }
  };
}

// ===== دوال مساعدة =====

/**
 * إزالة الفصول المكررة
 */
function removeDuplicateChapters(chapters) {
  const seen = new Set();
  return chapters.filter(chapter => {
    if (seen.has(chapter.number)) return false;
    seen.add(chapter.number);
    return true;
  });
}

/**
 * توليد اسم مختصر للمانجا
 */
function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .substring(0, 100);
}

/**
 * تصحيح الروابط
 */
function fixUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `https://olympustaff.com${url}`;
  return `https://olympustaff.com/${url}`;
}

/**
 * التحقق من صحة الرابط
 */
function validateUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export const config = {
  runtime: 'nodejs',
  maxDuration: 60, // زيادة المهلة إلى 60 ثانية للسماح بجلب الفصول الكاملة
}; 
