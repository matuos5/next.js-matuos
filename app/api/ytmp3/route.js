// app/api/ytmp3/route.js
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(req) {
  const start = Date.now();
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url"); // رابط الفيديو أو ID

    if (!url) {
      return NextResponse.json(
        {
          owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
          code: 400,
          msg: "يرجى ادخال رابط أو ID صالح",
        },
        { status: 400 }
      );
    }

    // إعداد body للـ POST
    const body = { query: url };
    const response = await fetch("https://nuun.mnuu.nu/api/v1/download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://nuun.mnuu.nu",
        "Referer": "https://nuun.mnuu.nu/",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 12; M2007J20CG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139 Mobile Safari/537.36",
      },
      body: JSON.stringify(body),
    });

    const contentType = response.headers.get("content-type") || "";
    let downloadLink = null;

    if (contentType.includes("application/json")) {
      // لو Nuun رجعت JSON مباشر
      const json = await response.json();
      if (json && json.data && json.data.link) {
        downloadLink = json.data.link;
      }
    } else {
      // لو HTML
      const html = await response.text();
      const $ = cheerio.load(html);

      // أول محاولة: استخدام selectors شائعة
      downloadLink = $('a[href$=".mp3"], a[href$=".mp4"], a.download, a#download, a.btn').first().attr("href");

      // لو ما لاقيش شيء، استخدم regex عام
      if (!downloadLink) {
        const match = html.match(/https?:\/\/[^\s'"]+\.(mp3|mp4)/i);
        if (match) downloadLink = match[0];
      }
    }

    if (!downloadLink) {
      return NextResponse.json(
        {
          owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
          code: 404,
          msg: "No download link found",
        },
        { status: 404 }
      );
    }

    // JSON وهمي مثل TikTok downloader
    return NextResponse.json({
      owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
      code: 0,
      msg: "success",
      processed_time: (Date.now() - start) / 1000,
      data: { link: downloadLink },
    });

  } catch (err) {
    return NextResponse.json(
      {
        owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
        code: 500,
        msg: "Internal error",
        error: err.message,
      },
      { status: 500 }
    );
  }
}
