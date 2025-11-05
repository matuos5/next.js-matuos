import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(req) {
  try {
    // قراءة اسم الأنمي من الباراميتر ?name=
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى تمرير اسم الأنمي في الباراميتر 'name'. مثال: /api/witanime?name=boku-no-hero-academia",
        },
        { status: 400 }
      );
    }

    // تحويل الاسم إلى slug متوافق مع موقع witanime
    const slug = name.trim().toLowerCase().replace(/\s+/g, "-");

    // تجهيز الرابط
    const targetUrl = `https://witanime.world/anime/${slug}/`;
    const fetchUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

    const response = await fetch(fetchUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language":
          "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6,fr;q=0.5",
      },
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    // استخراج الحلقات
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

    // بيانات الأنمي العامة
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
