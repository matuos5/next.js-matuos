import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

export async function GET() {
  try {
    // نجيب الصفحة الرئيسية لأخبار كورة
    const url = "https://www.yallakora.com/news";
    const { data: html } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });

    const $ = cheerio.load(html);

    // نبحث عن العناصر اللي فيها الأخبار
    const news = [];
    $(".articleCard").each((i, el) => {
      const title = $(el).find(".articleTitle").text().trim();
      const description = $(el).find(".articleSubTitle").text().trim();
      const url = $(el).find("a").attr("href");
      const img = $(el).find("img").attr("data-src") || $(el).find("img").attr("src");

      if (title) {
        news.push({
          title,
          description,
          url: url ? `https://www.yallakora.com${url}` : null,
          image: img || null,
        });
      }
    });

    return NextResponse.json({
      code: 0,
      msg: "success",
      data: news.slice(0, 10), // أول 10 أخبار فقط
    });
  } catch (err) {
    console.error("Scrape Error:", err.message);
    return NextResponse.json(
      { code: 500, msg: "Scraping error", error: err.message },
      { status: 500 }
    );
  }
}
