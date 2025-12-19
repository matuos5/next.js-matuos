// app/api/olympustaff/manga/route.js

import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

// خدمات البروكسي فقط
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

    if (getAllChapters) {
      const allChaptersResult = await getAllAvailableChapters(mangaId);
      chapters = allChaptersResult.chapters;
      chaptersSource = allChaptersResult.source;
    } else {
      chapters = getChaptersFromPage($main, mangaId);
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

    return NextResponse.json(responseData);

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

async function getPageData(url) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  };

  for (const getProxyUrl of proxyServices) {
    try {
      const proxyUrl = getProxyUrl(url);
      const response = await fetch(proxyUrl, {
        headers: headers,
        cache: 'no-store'
      });

      if (!response.ok) continue;
      
      const html = await response.text();
      if (html.includes('Just a moment')) continue;
      
      return html;
    } catch {
      continue;
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

  return {
    id: mangaId,
    title: title,
    slug: generateSlug(title),
    description: description,
    image: fixUrl(image),
    type: type,
    url: `https://olympustaff.com/series/${mangaId}`
  };
}

async function getAllAvailableChapters(mangaId) {
  const urlsToTry = [
    `https://olympustaff.com/series/${mangaId}/chapters`,
    `https://olympustaff.com/series/${mangaId}/all-chapters`,
    `https://olympustaff.com/series/${mangaId}?view=all`,
    `https://olympustaff.com/series/${mangaId}`
  ];

  let bestChapters = [];
  let bestSource = 'main-page';

  for (const url of urlsToTry) {
    const html = await getPageData(url);
    if (!html) continue;

    const $ = cheerio.load(html);
    const chapters = getChaptersFromPage($, mangaId);
    
    if (chapters.length > bestChapters.length) {
      bestChapters = chapters;
      bestSource = url;
    }
  }

  return { chapters: bestChapters, source: bestSource };
}

function getChaptersFromPage($, mangaId) {
  const chaptersFound = [];
  
  $('a').each((_, element) => {
    const link = $(element);
    const href = link.attr('href');
    
    if (!href) return;
    
    // التحقق من رابط الفصل
    const isChapter = href.includes(`/series/${mangaId}/`) && 
                     (href.includes('/chapter') || /\/(\d+)$/.test(href));
    
    if (isChapter) {
      const chapterInfo = extractChapterInfo(link, href);
      if (chapterInfo) {
        // منع التكرار
        const exists = chaptersFound.some(ch => ch.number === chapterInfo.number);
        if (!exists) {
          chaptersFound.push(chapterInfo);
        }
      }
    }
  });

  // ترتيب وتنظيف
  const sorted = chaptersFound.sort((a, b) => b.number - a.number);
  return removeDuplicateChapters(sorted);
}

function extractChapterInfo(linkElement, href) {
  // استخراج الرقم
  const numMatch = href.match(/\/(\d+)(?:\/|$)/) || href.match(/chapter-?(\d+)/i);
  if (!numMatch) return null;
  
  const chapterNum = parseInt(numMatch[1]);
  
  // النص الكامل
  const fullText = linkElement.text()
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // العنوان
  let title = fullText
    .replace(new RegExp(`^\\d{1,3}(?:,\\d{3})*\\s*`), '')
    .replace(new RegExp(`الفصل\\s*${chapterNum}\\s*[:-]?\\s*`, 'i'), '')
    .trim();
  
  if (!title || title.length < 2) {
    title = `الفصل ${chapterNum}`;
  }
  
  // المشاهدات
  const viewsMatch = fullText.match(/(\d{1,3}(?:,\d{3})*)/);
  const views = viewsMatch ? parseInt(viewsMatch[1].replace(/,/g, '')) : null;
  
  // التاريخ
  const dateMatch = fullText.match(/(\d+\s*(?:years?|months?|days?|سنة|شهر|يوم))/i);
  const date = dateMatch ? dateMatch[1] : null;
  
  return {
    number: chapterNum,
    title: title,
    url: fixUrl(href),
    views: views,
    date: date
  };
}

// ===== دوال مساعدة =====

function removeDuplicateChapters(chapters) {
  const seen = new Set();
  return chapters.filter(chapter => {
    if (seen.has(chapter.number)) return false;
    seen.add(chapter.number);
    return true;
  });
}

function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function fixUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `https://olympustaff.com${url.startsWith('/') ? url : '/' + url}`;
      } 
