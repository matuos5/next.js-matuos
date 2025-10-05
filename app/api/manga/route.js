import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى إضافة رابط تيك توك صالح",
        },
        { status: 400 }
      );
    }

    const response = await fetch("https://ttsave.app/download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://ttsave.app",
        Referer: "https://ttsave.app/en",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 12; M2007J20CG Build/SKQ1.211019.001) AppleWebKit/537.36 (KHTML, مثل Gecko) Chrome/139.0.7258.160 Mobile Safari/537.36",
      },
      body: JSON.stringify({
        query: url,
        language_id: "1",
      }),
    });

    const html = await response.text();
    const $ = cheerio.load(html);
    const downloadLink = $("#button-download-ready a").attr("href");

    if (!downloadLink) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على رابط التحميل",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: {
        link: downloadLink,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "حدث خطأ في الخادم",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
