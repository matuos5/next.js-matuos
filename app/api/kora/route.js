import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

export async function GET() {
  try {
    const url = "https://www.yallakora.com/News";
    const { data: html } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "ar,en;q=0.9",
      },
    });

    const $ = cheerio.load(html);
    const news = [];

    // استخراج الأخبار من العناصر
    $(".articleCard, .ArticleItem").each((_, el) => {
      const title = $(el).find("h3 a, .articleTitle a").text().trim();
      const url = $(el).find("a").attr("href");
      const description = $(el).find(".articleSummary, p").first().text().trim();
      const image =
        $(el).find("img").attr("data-src") ||
        $(el).find("img").attr("src") ||
        null;

      if (title && url) {
        news.push({
          title,
          description,
          url: url.startsWith("http")
            ? url
            : `https://www.yallakora.com${url}`,
          image,
        });
      }
    });

    if (!news.length) throw new Error("لم يتم العثور على أخبار في صفحة الموقع.");

    return NextResponse.json({
      code: 0,
      msg: "success",
      data: news.slice(0, 10), // أول 10 فقط
    });
  } catch (err) {
    console.error("Kora API Error:", err.message);
    return NextResponse.json(
      { code: 500, msg: "Failed to fetch news", error: err.message },
      { status: 500 }
    );
  }
}      { code: 500, msg: "Failed to fetch news", error: err.message },
      { status: 500 }
    );
  }
}
