import { NextResponse } from "next/server";
import axios from "axios";

export async function GET(req) {
  try {
    const apiURL = `https://api.allorigins.win/raw?url=${encodeURIComponent('https://www.korascope.com/')}`;

    const { data: html } = await axios.get(apiURL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
        "Accept-Language": "ar,en;q=0.9",
      },
    });

    // استخراج الأخبار من HTML
    const regex = /<h2 class="entry-title"><a href="(.*?)".*?>(.*?)<\/a><\/h2>/g;
    const matches = [...html.matchAll(regex)];

    if (matches.length === 0) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على أخبار 😔",
        },
        { status: 404 }
      );
    }

    // تجهيز البيانات
    const news = matches.slice(0, 15).map((m) => ({
      title: m[2].replace(/&[^;]+;/g, ""),
      link: m[1],
    }));

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: news,
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
