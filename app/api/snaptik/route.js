import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json({
        code: -1,
        msg: "No URL provided",
        processed_time: 0,
        data: {},
      });
    }

    const start = Date.now();

    const html = await fetch(
      `https://snaptik.app/action.php?url=${encodeURIComponent(url)}`,
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36",
        },
      }
    ).then((r) => r.text());

    // استخدم cheerio عشان نفك الـ HTML
    const $ = cheerio.load(html);

    // SnapTik غالباً بيحط روابط الفيديوهات في <a download> أو <video src>
    const links = [];
    $("a").each((_, el) => {
      const href = $(el).attr("href");
      if (href && href.startsWith("http")) {
        links.push(href);
      }
    });

    $("video").each((_, el) => {
      const src = $(el).attr("src");
      if (src && src.startsWith("http")) {
        links.push(src);
      }
    });

    return NextResponse.json({
      code: 0,
      msg: "success",
      processed_time: (Date.now() - start) / 1000,
      data: {
        count: links.length,
        links,
      },
    });
  } catch (error) {
    return NextResponse.json({
      code: -1,
      msg: String(error),
      processed_time: 0,
      data: {},
    });
  }
}
