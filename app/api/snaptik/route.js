// app/api/download/route.js
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        {
          owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
          code: 400,
          msg: "يرجى اضافة رابط تيك توك صالح",
        },
        { status: 400 }
      );
    }

    const body = {
      query: url,
      language_id: "1",
    };

    const response = await fetch("https://ttsave.app/download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://ttsave.app",
        "Referer": "https://ttsave.app/en",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 12; M2007J20CG Build/SKQ1.211019.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.160 Mobile Safari/537.36",
      },
      body: JSON.stringify(body),
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    // استخراج أول لينك تحميل
    const downloadLink = $("#button-download-ready a").attr("href");

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

    return NextResponse.json({
      owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
      code: 0,
      msg: "success",
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
