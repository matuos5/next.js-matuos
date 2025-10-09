import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

export async function GET() {
  try {
    const rssUrl = "https://www.yallakora.com/RSS/News/1";
    const { data: xml } = await axios.get(rssUrl, { responseType: "text" });

    // نستخدم Cheerio لاستخراج الأخبار من RSS مباشرة
    const $ = cheerio.load(xml, { xmlMode: true });

    const news = [];
    $("item").each((_, el) => {
      const title = $(el).find("title").text().trim();
      const description = $(el).find("description").text().trim();
      const url = $(el).find("link").text().trim();
      const pubDate = $(el).find("pubDate").text().trim();

      if (title && url) {
        news.push({ title, description, url, pubDate });
      }
    });

    if (!news.length) {
      throw new Error("لم يتم العثور على أخبار في RSS.");
    }

    return NextResponse.json({
      code: 0,
      msg: "success",
      data: news.slice(0, 10), // أول 10 أخبار فقط
    });
  } catch (err) {
    console.error("Kora API Error:", err.message);
    return NextResponse.json(
      { code: 500, msg: "Failed to fetch news", error: err.message },
      { status: 500 }
    );
  }
}
