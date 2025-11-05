import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(req) {
  try {
    // قراءة الاسم من الباراميتر ?name=
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى تمرير اسم الأنمي في الباراميتر 'name'. مثال: /api/witanime/search?name=dragon ball",
        },
        { status: 400 }
      );
    }

    // بناء رابط البحث
    const query = encodeURIComponent(name.trim());
    const targetUrl = `https://witanime.world/?search_param=animes&s=${query}`;

    // جلب صفحة البحث مباشرة من الموقع
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language":
          "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6,fr;q=0.5",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: response.status,
          msg: `فشل في تحميل صفحة البحث (${response.status})`,
        },
        { status: response.status }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const results = [];

    // كل أنمي في نتائج البحث
    $(".anime-card, .anime-card-container, .anime-card-title").each((i, el) => {
      const title =
        $(el).find("h3 a").text().trim() ||
        $(el).find("a").attr("title") ||
        $(el).find("a").text().trim();

      const link = $(el).find("a").attr("href");
      const image =
        $(el).find("img").attr("data-src") ||
        $(el).find("img").attr("src") ||
        null;

      if (title && link) results.push({ title, link, image });
    });

    if (!results.length) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: `لم يتم العثور على أي نتائج للأنمي: ${name}`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      total: results.length,
      data: results,
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "Internal error",
        error: err.message,
      },
      { status: 500 }
    );
  }
}    });

    if (!response.ok) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: response.status,
          msg: `فشل في تحميل الصفحة (${response.status})`,
        },
        { status: response.status }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // تحليل الصفحة
    const episodes = [];
    $(".episodes-card, .episode-card, .ep-card").each((i, el) => {
      const title =
        $(el).find(".episode-title a").text().trim() ||
        $(el).find("a").text().trim();

      const link = $(el).find("a").attr("href");
      const img =
        $(el).find("img").attr("data-src") ||
        $(el).find("img").attr("src") ||
        null;

      if (title && link) episodes.push({ title, link, image: img });
    });

    const animeTitle =
      $("h1.entry-title").text().trim() ||
      $(".anime-title, .entry-title").first().text().trim();

    const animeImage =
      $(".anime-thumbnail img").attr("data-src") ||
      $(".anime-thumbnail img").attr("src") ||
      $("img").first().attr("src") ||
      null;

    const animeDescription =
      $(".anime-story").text().trim() ||
      $(".story p").text().trim() ||
      null;

    if (!animeTitle && !episodes.length) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: `لم يتم العثور على أنمي بالاسم: ${name}`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      anime: {
        title: animeTitle,
        image: animeImage,
        description: animeDescription,
      },
      total_episodes: episodes.length,
      episodes,
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "Internal error",
        error: err.message,
      },
      { status: 500 }
    );
  }
    }
