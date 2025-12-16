import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

function slugifyName(name = "") {
  return name
    .replace(/\s+/g, "-")          // استبدال المسافات بـ -
    .replace(/[^a-zA-Z0-9-]/g, ""); // إزالة أي شيء غير حروف/أرقام/داش
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q"); // مثال: /api/azoramoon/search?q=solo

    if (!query) {
      return NextResponse.json(
        {
          owner: "AZORAMOON-API",
          code: 400,
          msg: "يرجى اضافة اسم مانجا في باراميتر q",
        },
        { status: 400 }
      );
    }

    const encoded = encodeURIComponent(query);
    
    // استخدام api.allorigins.win لتجاوز CORS
    const targetUrl = `https://azoramoon.com/?s=${encoded}&post_type=wp-manga`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

    const response = await fetch(proxyUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "sec-ch-ua": '"Chromium";v="139", "Not;A=Brand";v="99"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "upgrade-insecure-requests": "1",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "navigate",
        "sec-fetch-user": "?1",
        "sec-fetch-dest": "document",
        "referer": "https://azoramoon.com/",
        "accept-language":
          "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          owner: "AZORAMOON-API",
          code: response.status,
          msg: "فشل في الإتصال بموقع ازورا مانجا",
        },
        { status: 500 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const results = [];

    // استخراج نتائج البحث من ازورا مانجا
    $(".page-listing-item .page-item-detail").each((index, el) => {
      const item = $(el);
      
      // العنوان والرابط
      const titleElement = item.find(".post-title h3, .post-title h5");
      const title = titleElement.text().trim();
      
      if (!title) return;
      
      const linkElement = item.find("a").first();
      const url = linkElement.attr("href") || "";
      const slug = slugifyName(title);
      
      // الصورة
      const imageElement = item.find(".item-thumb img");
      const image = imageElement.attr("src") || 
                    imageElement.attr("data-src") || 
                    imageElement.attr("data-cfsrc") || 
                    null;
      
      // التصنيفات (الأنواع)
      const categories = [];
      item.find(".mg_genres .summary-content a").each((_, catEl) => {
        const catName = $(catEl).text().trim();
        if (catName) categories.push(catName);
      });
      
      // التصنيفات البديلة
      if (categories.length === 0) {
        item.find(".genres .genres-item a").each((_, catEl) => {
          const catName = $(catEl).text().trim();
          if (catName) categories.push(catName);
        });
      }
      
      // أحدث فصل
      const latestChapterElement = item.find(".list-chapter .chapter-item .chapter a");
      const latestChapter = latestChapterElement.text().trim();
      const latestChapterUrl = latestChapterElement.attr("href") || "";
      
      // عدد الفصول
      const totalChaptersText = item.find(".chapter-item .chapter").text();
      const totalChaptersMatch = totalChaptersText.match(/الفصل\s*(\d+)/);
      const totalChapters = totalChaptersMatch ? 
                          parseInt(totalChaptersMatch[1]) : 
                          item.find(".list-chapter li").length;
      
      // الوصف
      const description = item.find(".manga-summary, .post-content_item.mg_summary .summary-content")
        .text()
        .trim()
        .substring(0, 200) + "...";
      
      // السنة
      const yearElement = item.find(".post-content_item.mg_release .summary-content");
      const year = yearElement.text().trim();
      
      // حالة المانجا
      const statusElement = item.find(".post-content_item.mg_status .summary-content");
      const status = statusElement.text().trim();
      
      // التصنيف
      const typeElement = item.find(".manga-title-badges");
      const type = typeElement.text().trim();
      
      results.push({
        id: index + 1,
        title,
        slug,
        url,
        image,
        categories,
        latestChapter: {
          name: latestChapter,
          url: latestChapterUrl
        },
        totalChapters,
        description,
        year,
        status,
        type,
        metadata: {
          source: "azoramoon.com",
          searchQuery: query
        }
      });
    });
    
    // محاولة ثانية إذا لم نجد نتائج بالطريقة الأولى
    if (!results.length) {
      $(".c-tabs-item .tab-summary").each((index, el) => {
        const item = $(el);
        
        const titleElement = item.find(".post-title h1, .post-title h3");
        const title = titleElement.text().trim();
        
        if (!title) return;
        
        const linkElement = item.find("a").first();
        const url = linkElement.attr("href") || "";
        const slug = slugifyName(title);
        
        const imageElement = item.find(".summary_image img");
        const image = imageElement.attr("src") || null;
        
        results.push({
          id: index + 1,
          title,
          slug,
          url,
          image,
          categories: [],
          latestChapter: { name: "", url: "" },
          totalChapters: 0,
          description: "",
          year: "",
          status: "",
          type: "",
          metadata: {
            source: "azoramoon.com",
            searchQuery: query
          }
        });
      });
    }

    if (!results.length) {
      return NextResponse.json(
        {
          owner: "AZORAMOON-API",
          code: 404,
          msg: "لم يتم العثور على أي مانجا مطابقة لنتيجة البحث",
          data: {
            query,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "AZORAMOON-API",
      code: 0,
      msg: "success",
      data: {
        query,
        count: results.length,
        results,
      },
    });
  } catch (err) {
    console.error("AZORAMOON API Error:", err);
    return NextResponse.json(
      {
        owner: "AZORAMOON-API",
        code: 500,
        msg: "حدث خطأ داخلي في السيرفر",
        error: err.message,
      },
      { status: 500 }
    );
  }
              }        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "navigate",
        "sec-fetch-user": "?1",
        "sec-fetch-dest": "document",
        referer: "https://azoramoon.com/",
        "accept-language":
          "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: response.status,
          msg: `خطأ في استجابة الموقع: ${response.status} ${response.statusText}`,
        },
        { status: response.status }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // تحقق من صفحة Cloudflare Challenge
    if (html.includes("Just a moment...") || html.includes("Enable JavaScript and cookies to continue")) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 403,
          msg: "الموقع يستخدم حماية Cloudflare ولا يمكن الوصول إليه بهذه الطريقة",
          html: html, // يمكنك إزالة هذا إذا كنت لا تريد إرجاع HTML الكامل
        },
        { status: 403 }
      );
    }

    // استخراج نتائج البحث
    const results = [];

    // استناداً إلى هيكل موقع WP-Manga، نتائج البحث عادةً تكون في عناصر معينة
    $('.c-tabs-item__content, .manga-item, .post-item, .search-wrap .row .col, .listupd > .bs, .bsx').each((index, element) => {
      const $el = $(element);
      
      // استخراج العنوان
      const title = $el.find('.post-title a, h3 a, h4 a, .tt a, .title a').text().trim() ||
                    $el.find('a').attr('title') ||
                    $el.find('a').first().text().trim();
      
      // استخراج الرابط
      const link = $el.find('a').first().attr('href');
      
      // استخراج الصورة المصغرة
      const thumbnail = $el.find('img').first().attr('src') ||
                        $el.find('img').first().attr('data-src');
      
      // استخراج الفصول أو التفاصيل الأخرى
      const chapters = $el.find('.chapter-item, .chapter, .epxs').text().trim();
      const rating = $el.find('.score, .rating, .numscore').text().trim();
      const summary = $el.find('.summary, .content, .excerpt').text().trim();

      if (title && link) {
        results.push({
          id: index + 1,
          title: title,
          slug: slugifyName(title),
          url: link,
          thumbnail: thumbnail || null,
          chapters: chapters || null,
          rating: rating || null,
          summary: summary || null,
        });
      }
    });

    // إذا لم نجد نتائج بالطريقة الأولى، نبحث عن أي عناصر قد تحتوي على نتائج
    if (results.length === 0) {
      $('article, .post, .hentry, .item').each((index, element) => {
        const $el = $(element);
        const title = $el.find('.entry-title, h2 a, .post-title').text().trim();
        const link = $el.find('a').first().attr('href');
        
        if (title && link) {
          results.push({
            id: index + 1,
            title: title,
            slug: slugifyName(title),
            url: link,
          });
        }
      });
    }

    // إذا لم نجد أي نتائج
    if (results.length === 0) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على نتائج بحث",
          query: query,
          total_results: 0,
          results: [],
        },
        { status: 200 } // نعيد 200 لأن الطلب نجح لكن بدون نتائج
      );
    }

    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 200,
        msg: "تم العثور على النتائج بنجاح",
        query: query,
        total_results: results.length,
        results: results,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error in search API:", error);
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: `خطأ أثناء تنفيذ البحث: ${error.message}`,
      },
      { status: 500 }
    );
  }
                                                                                                            }
