// app/api/olympustaff/manga/route.js

import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

// خدمات البروكسي المحسنة مع تناوب ذكي
const proxyServices = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
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

    // جلب بيانات المانجا
    const mainData = await fetchWithRetry(`https://olympustaff.com/series/${mangaId}`);
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
    const mangaInfo = extractMangaDetails($main, mangaId);
    
    // استخراج جميع الروابط الممكنة للفصول
    const allLinks = extractAllChapterLinks($main, mangaId);
    
    // جمع الفصول من مصادر متعددة
    let allChapters = [];
    
    if (getAllChapters) {
      // الطريقة 1: من الروابط المباشرة في الصفحة
      const directChapters = extractChaptersFromLinks(allLinks, mangaId);
      
      // الطريقة 2: من البيانات المضمنة في scripts
      const scriptChapters = extractChaptersFromScripts($main, mangaId);
      
      // الطريقة 3: من الروابط الشائعة
      const commonChapters = await fetchCommonChapterPatterns(mangaId);
      
      // الطريقة 4: من صفحات الترحيم
      const paginatedChapters = await fetchPaginatedChapters(mangaId);
      
      // دمج جميع الفصول مع إزالة التكرارات
      allChapters = mergeAndDeduplicateChapters([
        ...directChapters,
        ...scriptChapters,
        ...commonChapters,
        ...paginatedChapters
      ]);
      
      // إذا كان عدد الفصول قليلاً، نجرب البحث في صفحات إضافية
      if (allChapters.length < 20) {
        const additionalChapters = await searchAdditionalChapterPages(mangaId);
        allChapters = mergeAndDeduplicateChapters([...allChapters, ...additionalChapters]);
      }
    } else {
      allChapters = extractChaptersFromLinks(allLinks, mangaId);
    }
    
    // معالجة الفصول وترتيبها
    const processedChapters = processChapters(allChapters, mangaId);
    
    // بناء الاستجابة النهائية
    const responseData = {
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: {
        ...mangaInfo,
        chapters: processedChapters.chapters,
        chaptersInfo: {
          total: processedChapters.chapters.length,
          fetched: processedChapters.stats.fetched,
          generated: processedChapters.stats.generated,
          missingInSequence: processedChapters.stats.missingInSequence,
          source: processedChapters.stats.source,
          hasMore: processedChapters.chapters.length > 50
        }
      },
      metadata: {
        source: "olympustaff.com",
        timestamp: new Date().toISOString(),
        url: `https://olympustaff.com/series/${mangaId}`,
        collectionMethod: getAllChapters ? "comprehensive-scrape" : "quick-scrape"
      }
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error("Error in manga API:", error.message);
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

// ===== الدوال الأساسية المحسنة =====

/**
 * جلب البيانات مع إعادة المحاولة والبروكسي المتناوب
 */
async function fetchWithRetry(url, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    // تناوب عشوائي لخدمات البروكسي
    const shuffledProxies = [...proxyServices].sort(() => Math.random() - 0.5);
    
    for (const getProxyUrl of shuffledProxies) {
      try {
        const proxyUrl = getProxyUrl(url);
        const response = await fetch(proxyUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ar,en-US;q=0.7,en;q=0.3',
            'Referer': 'https://olympustaff.com/',
            'Accept-Encoding': 'gzip, deflate',
          },
          cache: 'no-store'
        });

        if (response.ok) {
          const html = await response.text();
          
          // التحقق من أن الصفحة ليست صفحة حجب
          if (html.includes('Just a moment') || html.includes('Cloudflare') || html.length < 500) {
            continue;
          }
          
          return html;
        }
      } catch (error) {
        // تجاهل الخطأ وجرب البروكسي التالي
        continue;
      }
    }
    
    // انتظار قبل إعادة المحاولة
    if (attempt < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  
  return null;
}

/**
 * استخراج تفاصيل المانجا من الصفحة
 */
function extractMangaDetails($, mangaId) {
  const title = $('title').text()
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

  // استخراج معلومات إضافية من الصفحة
  const author = extractInfoFromPage($, ['المؤلف', 'Author', 'التأليف']);
  const status = extractInfoFromPage($, ['الحالة', 'Status', 'مستمرة', 'مكتملة']);
  const genres = extractGenresFromPage($);

  return {
    id: mangaId,
    title: title,
    slug: generateSlug(title),
    description: description,
    image: fixUrl(image),
    type: type,
    author: author,
    status: status,
    genres: genres,
    url: `https://olympustaff.com/series/${mangaId}`
  };
}

/**
 * استخراج جميع الروابط المحتملة للفصول
 */
function extractAllChapterLinks($, mangaId) {
  const links = new Set();
  
  // البحث عن جميع الروابط في الصفحة
  $('a').each((_, element) => {
    const href = $(element).attr('href');
    if (href && href.includes(mangaId)) {
      links.add(fixUrl(href));
    }
  });
  
  // البحث في عناصر div و span لروابط مخفية
  $('div[onclick], span[onclick], li[onclick]').each((_, element) => {
    const onclick = $(element).attr('onclick') || '';
    const hrefMatch = onclick.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
    if (hrefMatch && hrefMatch[1] && hrefMatch[1].includes(mangaId)) {
      links.add(fixUrl(hrefMatch[1]));
    }
  });
  
  // البحث عن روابط في data attributes
  $('[data-url], [data-href], [data-link]').each((_, element) => {
    const dataUrl = $(element).attr('data-url') || 
                    $(element).attr('data-href') || 
                    $(element).attr('data-link');
    if (dataUrl && dataUrl.includes(mangaId)) {
      links.add(fixUrl(dataUrl));
    }
  });
  
  return Array.from(links);
}

/**
 * استخراج الفصول من الروابط
 */
function extractChaptersFromLinks(links, mangaId) {
  const chapters = [];
  const chapterPatterns = [
    // أنماط شائعة لروابط الفصول
    new RegExp(`/series/${mangaId}/(?:chapter-)?(\\d+(?:\\.\\d+)?)(?:/|$)`),
    new RegExp(`/series/${mangaId}/(?:ch-)?(\\d+)(?:/|$)`),
    new RegExp(`/series/${mangaId}/(\\d+)$`),
    new RegExp(`/chapter/(\\d+)/.*${mangaId}`),
    new RegExp(`/read/${mangaId}/(\\d+)`),
  ];
  
  for (const link of links) {
    for (const pattern of chapterPatterns) {
      const match = link.match(pattern);
      if (match && match[1]) {
        const chapterNum = parseFloat(match[1]);
        
        // منع التكرارات
        if (!chapters.some(ch => ch.number === chapterNum)) {
          chapters.push({
            number: chapterNum,
            title: `الفصل ${chapterNum}`,
            url: link,
            fetched: true,
            verified: false
          });
        }
        break;
      }
    }
  }
  
  return chapters.sort((a, b) => b.number - a.number);
}

/**
 * استخراج الفصول من scripts في الصفحة
 */
function extractChaptersFromScripts($, mangaId) {
  const chapters = [];
  
  // البحث في scripts عن بيانات الفصول
  $('script').each((_, element) => {
    const scriptContent = $(element).html() || '';
    
    // البحث عن arrays أو objects تحتوي على بيانات الفصول
    const chapterMatches = [
      ...scriptContent.matchAll(/chapters\s*[:=]\s*(\[.*?\])/g),
      ...scriptContent.matchAll(/["']?chapters?["']?\s*:\s*(\[.*?\])/g),
      ...scriptContent.matchAll(/(\d+)\s*[:=]\s*["'][^"']*chapter[^"']*["']/gi),
    ];
    
    for (const match of chapterMatches) {
      if (match[1]) {
        try {
          // محاولة تحليل JSON
          const chaptersData = JSON.parse(match[1]);
          if (Array.isArray(chaptersData)) {
            chaptersData.forEach(chapter => {
              if (chapter.number || chapter.chapter || chapter.id) {
                const chapterNum = chapter.number || chapter.chapter || chapter.id;
                chapters.push({
                  number: parseFloat(chapterNum),
                  title: chapter.title || `الفصل ${chapterNum}`,
                  url: chapter.url || generateChapterUrl(mangaId, chapterNum),
                  fetched: true,
                  verified: true,
                  fromScript: true
                });
              }
            });
          }
        } catch (e) {
          // إذا فشل تحليل JSON، نجرب regex مباشرة
          const directMatches = match[1].match(/\b\d+(?:\.\d+)?\b/g);
          if (directMatches) {
            directMatches.forEach(chapterNum => {
              chapters.push({
                number: parseFloat(chapterNum),
                title: `الفصل ${chapterNum}`,
                url: generateChapterUrl(mangaId, chapterNum),
                fetched: true,
                verified: false,
                fromScript: true
              });
            });
          }
        }
      }
    }
    
    // البحث عن روابط مباشرة في scripts
    const urlMatches = scriptContent.matchAll(/["'](https?:\/\/[^"']*\/series\/[^"']*\/\d+[^"']*)["']/g);
    for (const match of urlMatches) {
      const url = match[1];
      const chapterMatch = url.match(/\/(\d+)(?:\/|$)/);
      if (chapterMatch && url.includes(mangaId)) {
        const chapterNum = parseFloat(chapterMatch[1]);
        chapters.push({
          number: chapterNum,
          title: `الفصل ${chapterNum}`,
          url: url,
          fetched: true,
          verified: true,
          fromScript: true
        });
      }
    }
  });
  
  return chapters;
}

/**
 * جلب الفصول من أنماط الروابط الشائعة
 */
async function fetchCommonChapterPatterns(mangaId) {
  const chapters = [];
  const maxChapterToCheck = 300; // حد أقصى للفحص
  
  // أنماط URLs الشائعة
  const patterns = [
    (num) => `https://olympustaff.com/series/${mangaId}/chapter-${num}`,
    (num) => `https://olympustaff.com/series/${mangaId}/${num}`,
    (num) => `https://olympustaff.com/series/${mangaId}/ch-${num}`,
    (num) => `https://olympustaff.com/series/${mangaId}/chapter/${num}`,
  ];
  
  // نفحص من 1 إلى 50 أولاً (الأكثر شيوعًا)
  for (let i = 1; i <= Math.min(50, maxChapterToCheck); i++) {
    for (const pattern of patterns) {
      const url = pattern(i);
      try {
        const html = await fetchWithRetry(url, 1); // محاولة واحدة سريعة
        if (html) {
          chapters.push({
            number: i,
            title: `الفصل ${i}`,
            url: url,
            fetched: true,
            verified: true,
            fromPattern: true
          });
          break; // وجدنا الفصل، ننتقل للرقم التالي
        }
      } catch (error) {
        // تجاهل الخطأ
      }
    }
  }
  
  return chapters;
}

/**
 * جلب الفصول من صفحات الترحيم
 */
async function fetchPaginatedChapters(mangaId) {
  const chapters = [];
  const pageUrls = [
    `https://olympustaff.com/series/${mangaId}/chapters`,
    `https://olympustaff.com/series/${mangaId}/all-chapters`,
    `https://olympustaff.com/series/${mangaId}?view=chapters`,
    `https://olympustaff.com/series/${mangaId}?tab=chapters`,
  ];
  
  for (const pageUrl of pageUrls) {
    const html = await fetchWithRetry(pageUrl);
    if (html) {
      const $ = cheerio.load(html);
      const pageChapters = extractChaptersFromLinks(extractAllChapterLinks($, mangaId), mangaId);
      chapters.push(...pageChapters);
    }
  }
  
  return chapters;
}

/**
 * البحث في صفحات إضافية للفصول
 */
async function searchAdditionalChapterPages(mangaId) {
  const chapters = [];
  
  // نماذج صفحات إضافية للبحث
  const additionalPages = [
    `https://olympustaff.com/series/${mangaId}?page=1`,
    `https://olympustaff.com/series/${mangaId}?page=2`,
    `https://olympustaff.com/series/${mangaId}?page=3`,
    `https://olympustaff.com/series/${mangaId}/1`,
    `https://olympustaff.com/series/${mangaId}/2`,
  ];
  
  for (const pageUrl of additionalPages) {
    try {
      const html = await fetchWithRetry(pageUrl);
      if (html) {
        const $ = cheerio.load(html);
        const pageChapters = extractChaptersFromLinks(extractAllChapterLinks($, mangaId), mangaId);
        chapters.push(...pageChapters);
      }
    } catch (error) {
      // تجاهل الصفحات التي لا تعمل
    }
  }
  
  return chapters;
}

/**
 * دمج الفصول وإزالة التكرارات
 */
function mergeAndDeduplicateChapters(chapterArrays) {
  const chapterMap = new Map();
  
  for (const chapterArray of chapterArrays) {
    for (const chapter of chapterArray) {
      if (!chapterMap.has(chapter.number) || 
          (chapter.verified && !chapterMap.get(chapter.number).verified)) {
        chapterMap.set(chapter.number, chapter);
      }
    }
  }
  
  return Array.from(chapterMap.values())
    .sort((a, b) => b.number - a.number);
}

/**
 * معالجة الفصول النهائية
 */
function processChapters(chapters, mangaId) {
  if (chapters.length === 0) {
    return { chapters: [], stats: { fetched: 0, generated: 0, missingInSequence: 0, source: 'none' } };
  }
  
  const fetchedChapters = chapters.filter(ch => ch.fetched);
  const maxChapter = Math.max(...chapters.map(ch => ch.number));
  const minChapter = Math.min(...chapters.map(ch => ch.number));
  
  // توليد الفصول المفقودة في التسلسل
  const generatedChapters = [];
  const fetchedNumbers = new Set(fetchedChapters.map(ch => ch.number));
  
  for (let i = minChapter; i <= maxChapter; i++) {
    if (!fetchedNumbers.has(i)) {
      generatedChapters.push({
        number: i,
        title: `الفصل ${i}`,
        url: generateChapterUrl(mangaId, i),
        fetched: false,
        generated: true,
        needsVerification: true
      });
    }
  }
  
  // دمج الفصول
  const allChapters = [...fetchedChapters, ...generatedChapters]
    .sort((a, b) => b.number - a.number);
  
  return {
    chapters: allChapters,
    stats: {
      fetched: fetchedChapters.length,
      generated: generatedChapters.length,
      missingInSequence: generatedChapters.length,
      source: fetchedChapters.length > 0 ? 'mixed' : 'generated',
      range: `${minChapter} - ${maxChapter}`,
      completeness: fetchedChapters.length > 0 ? 
        `${((fetchedChapters.length / (maxChapter - minChapter + 1)) * 100).toFixed(1)}%` : '0%'
    }
  };
}

// ===== دوال مساعدة =====

/**
 * توليد رابط للفصل
 */
function generateChapterUrl(mangaId, chapterNumber) {
  const patterns = [
    `https://olympustaff.com/series/${mangaId}/chapter-${chapterNumber}`,
    `https://olympustaff.com/series/${mangaId}/${chapterNumber}`,
    `https://olympustaff.com/series/${mangaId}/ch-${chapterNumber}`,
  ];
  return patterns[0];
}

/**
 * استخراج المعلومات من الصفحة
 */
function extractInfoFromPage($, keywords) {
  for (const keyword of keywords) {
    const element = $(`:contains("${keyword}")`).filter((_, el) => {
      return $(el).text().trim().startsWith(keyword);
    });
    
    if (element.length > 0) {
      const text = element.text().replace(keyword, '').replace(/[:\-]/g, '').trim();
      if (text) return text;
    }
  }
  return 'غير معروف';
}

/**
 * استخراج الأنواع من الصفحة
 */
function extractGenresFromPage($) {
  const genres = [];
  $('a[href*="genre"], a[href*="category"], .genre, .tag').each((_, element) => {
    const text = $(element).text().trim();
    if (text && !text.includes('http') && text.length > 1) {
      genres.push(text);
    }
  });
  return [...new Set(genres)].slice(0, 10); // حد أقصى 10 أنواع
}

/**
 * إصلاح الروابط
 */
function fixUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `https://olympustaff.com${url}`;
  return `https://olympustaff.com/${url}`;
}

/**
 * توليد slug
 */
function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .substring(0, 100);
}

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
}; 
