// app/api/mangatime/search/route.js

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
    const query = searchParams.get("q"); // مثال: /api/mangatime/search?q=boruto

    if (!query) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى اضافة اسم مانجا في باراميتر q",
        },
        { status: 400 }
      );
    }

    const encoded = encodeURIComponent(query);

    const response = await fetch(`https://mangatime.org/search?q=${encoded}`, {
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
        referer: "https://mangatime.org/",
        "accept-language":
          "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6",
      },
      // اختياري: منع الكاش من جهة Next
      // cache: "no-store",
      // next: { revalidate: 0 },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: response.status,
          msg: "فشل في الإتصال بموقع مانجا تايم",
        },
        { status: 500 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const results = [];

    // كل نتيجة في grid
    $(".UpdatedTitles-module_gridContainer_mw8H9 .UpdatedTitle-module_title_2KlMr").each(
      (_, el) => {
        const item = $(el);

        // الرابط الرئيسي للمانجا (عليه data-manga-name / data-manga-id)
        const link = item.find("a.manga-link").first();
        const mangaName =
          link.attr("data-manga-name")?.trim() ||
          item.find(".title_manga").text().trim();

        if (!mangaName) return;

        const mangaId = link.attr("data-manga-id") || null;
        const slug = slugifyName(mangaName);
        const mangaUrl = `https://mangatime.org/manga/${slug}`;

        // الصورة / البوستر
        const poster = item.find(".product__item__pic_catogary").first();
        const imageLow = poster.attr("data-setbg-low") || null;
        const imageHigh = poster.attr("data-setbg-high") || null;

        // عدد الشابترات الإجمالي (من div.ep)
        const ep = poster.find(".ep").first();
        const totalChaptersAttr = ep.attr("data-total-chapters");
        const totalChapters = totalChaptersAttr
          ? Number(totalChaptersAttr)
          : null;
        const epLabel = ep.text().trim() || null;

        // التصنيفات
        const categories = [];
        item
          .find(
            ".UpdatedTitle-module_titleDescription_Cf0hO ul li a"
          )
          .each((_, catEl) => {
            const catName = $(catEl).text().trim();
            if (catName) categories.push(catName);
          });

        // عدد التعليقات والمشاهدات
        const commentsText = item
          .find(".UpdatedTitle-module_titleDescription_Cf0hO .comment")
          .text();
        const viewsText = item
          .find(".UpdatedTitle-module_titleDescription_Cf0hO .view")
          .text();

        const comments = Number(
          (commentsText || "").replace(/[^\d]/g, "")
        ) || 0;
        const views = Number(
          (viewsText || "").replace(/[^\d]/g, "")
        ) || 0;

        // آخر الشابترات (من buttons تحت الكارد)
        const latestChapters = [];
        item
          .find(".product__item__text__chapter a")
          .each((_, chEl) => {
            const $ch = $(chEl);
            const order = $ch.attr("data-manga-chapter_order");
            if (!order) return;

            const chapterNumber = Number(order);
            const chapterUrl = `${mangaUrl}/chapter-${order}`;

            latestChapters.push({
              order: chapterNumber,
              url: chapterUrl,
            });
          });

        results.push({
          id: mangaId,
          title: mangaName,
          slug,
          url: mangaUrl,
          imageLow,
          imageHigh,
          totalChapters,
          epLabel,
          categories,
          comments,
          views,
          latestChapters,
        });
      }
    );

    if (!results.length) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
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
