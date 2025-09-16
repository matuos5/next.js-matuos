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

    const $ = cheerio.load(html);
    let videoLink = null;

    // نجرب نجيب أول رابط موجود في <a download> أو <video src> وينتهي بـ mp4
    $("a").each((_, el) => {
      const href = $(el).attr("href");
      if (!videoLink && href && href.startsWith("http") && href.endsWith(".mp4")) {
        videoLink = href;
      }
    });

    if (!videoLink) {
      $("video").each((_, el) => {
        const src = $(el).attr("src");
        if (!videoLink && src && src.startsWith("http")) {
          videoLink = src;
        }
      });
    }

    return NextResponse.json({
      code: 0,
      msg: videoLink ? "success" : "No video found",
      processed_time: (Date.now() - start) / 1000,
      data: {
        link: videoLink || null,
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
