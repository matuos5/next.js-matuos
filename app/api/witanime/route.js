// app/api/witanime/search/route.js

import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

function slugifyName(name = "") {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractAnimeId(url) {
  if (!url) return null;
  const parts = url.split("/anime/");
  if (parts.length > 1) {
    const slug = parts[1].replace(/\//g, "");
    return slug || null;
  }
  return null;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى إضافة اسم أنمي في باراميتر q",
        },
        { status: 400 }
      );
    }

    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://witanime.you/?search_param=animes&s=${encodedQuery}`;

    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": "https://witanime.you/",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
        "sec-ch-ua": '"Chromium";v="139", "Not;A=Brand";v="99"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: response.status,
          msg: "فشل في الاتصال بموقع WitAnime",
        },
        { status: 500 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const results = [];

    // البحث عن نتائج الأنمي في الصفحة
    $(".anime-card-container").each((_, container) => {
      const $container = $(container);

      // استخراج العنوان والرابط
      const titleElement = $container.find(".anime-card-title h3 a");
      const title = titleElement.text().trim();
      const animeUrl = titleElement.attr("href");

      if (!title || !animeUrl) return;

      // استخراج الـ ID من الرابط
      const animeId = extractAnimeId(animeUrl);
      const slug = slugifyName(title);

      // استخراج الصورة
      const imgElement = $container.find(".anime-card-poster img.img-responsive");
      const image = imgElement.attr("src") || imgElement.attr("data-src");

      // استخراج الحالة (مكتمل، مستمر، إلخ)
      const statusElement = $container.find(".anime-card-status a");
      const status = statusElement.text().trim();
      const statusUrl = statusElement.attr("href");

      // استخراج النوع (TV, Movie, Special)
      const typeElement = $container.find(".anime-card-type a");
      const type = typeElement.text().trim();
      const typeUrl = typeElement.attr("href");

      // استخراج الوصف من خاصية data-content
      const description = $container.find(".anime-card-title").attr("data-content") || "";

      // استخراج معلومات إضافية إذا كانت موجودة
      const additionalInfo = {
        episodes: null,
        rating: null,
        year: null,
      };

      // البحث عن معلومات إضافية في التصميم (يمكن تعديلها حسب الصفحة الفعلية)
      $container.find(".anime-card-details .anime-card-info span").each((_, infoEl) => {
        const text = $(infoEl).text().trim();
        if (text.includes("حلقة")) {
          additionalInfo.episodes = text.replace(/[^\d]/g, "");
        } else if (text.includes("★") || text.includes("rating")) {
          additionalInfo.rating = text.replace(/[^\d.]/g, "");
        }
      });

      // استخراج التصنيفات إذا كانت موجودة
      const categories = [];
      $container.find(".anime-card-genres a").each((_, catEl) => {
        const cat = $(catEl).text().trim();
        if (cat) categories.push(cat);
      });

      results.push({
        id: animeId,
        title: title,
        slug: slug,
        url: animeUrl,
        image: image,
        status: {
          text: status,
          url: statusUrl,
        },
        type: {
          text: type,
          url: typeUrl,
        },
        description: description,
        additionalInfo: additionalInfo,
        categories: categories.length > 0 ? categories : null,
        metadata: {
          source: "WitAnime",
          scrapedAt: new Date().toISOString(),
        }
      });
    });

    // بديل إذا لم تكن النتائج موجودة في .anime-card-container
    if (results.length === 0) {
      $(".anime-list-content .col-lg-2, .anime-list-content .col-md-4, .anime-list-content .col-sm-6").each((_, col) => {
        const $col = $(col);
        const $card = $col.find(".anime-card-container");

        if ($card.length > 0) {
          const titleElement = $card.find("h3 a");
          const title = titleElement.text().trim();
          const animeUrl = titleElement.attr("href");

          if (!title || !animeUrl) return;

          const animeId = extractAnimeId(animeUrl);
          const slug = slugifyName(title);

          const imgElement = $card.find("img.img-responsive");
          const image = imgElement.attr("src");

          const statusElement = $card.find(".anime-card-status a");
          const status = statusElement.text().trim();

          const typeElement = $card.find(".anime-card-type a");
          const type = typeElement.text().trim();

          const description = $card.find(".anime-card-title").attr("data-content") || "";

          results.push({
            id: animeId,
            title: title,
            slug: slug,
            url: animeUrl,
            image: image,
            status: status,
            type: type,
            description: description,
          });
        }
      });
    }

    // الحصول على نص عنوان البحث
    const searchTitle = $(".second-section .container h3").text().trim() || `نتائج البحث عن ${query}`;

    if (results.length === 0) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على أي أنمي مطابق لنتيجة البحث",
          data: {
            query: query,
            searchTitle: searchTitle,
            searchUrl: searchUrl,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: {
        query: query,
        searchTitle: searchTitle,
        searchUrl: searchUrl,
        count: results.length,
        results: results,
      },
    });
  } catch (err) {
    console.error("Error in WitAnime search:", err);
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "حدث خطأ داخلي في السيرفر",
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
      { status: 500 }
    );
  }
          }
