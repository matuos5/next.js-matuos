import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET() {
  try {
    const response = await fetch(
      "https://api.allorigins.win/raw?url=https://www.korascope.com/",
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "Accept-Language": "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6",
        },
      }
    );

    const html = await response.text();
    const $ = cheerio.load(html);

    const articles = [];

    // كل خبر داخل div أو article بالموقع
    $("article, .jeg_post, .post, .jeg_posts, .jeg_thumb").each((i, el) => {
      const title =
        $(el).find("h3 a").text().trim() ||
        $(el).find("h2 a").text().trim() ||
        $(el).find("a").text().trim();
      const link = $(el).find("a").attr("href");
      const img =
        $(el).find("img").attr("data-src") ||
        $(el).find("img").attr("src") ||
        null;

      if (title && link)
        articles.push({
          title,
          link,
          image: img,
        });
    });

    if (!articles.length) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على أي أخبار.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      total: articles.length,
      data: articles,
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
