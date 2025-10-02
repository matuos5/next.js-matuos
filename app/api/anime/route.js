// app/api/anime/route.js
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى اضافة رابط صالح",
        },
        { status: 400 }
      );
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Host: "a1.mp4upload.com:183",
        Connection: "keep-alive",
        "Cache-Control": "max-age=0",
        "sec-ch-ua": `"Not;A=Brand";v="99", "Brave";v="139", "Chromium";v="139"`,
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": `"Android"`,
        "Upgrade-Insecure-Requests": "1",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Sec-GPC": "1",
        "Accept-Language": "ar-SY,ar;q=0.9",
        Referer: "https://www.mp4upload.com/",
        "Accept-Encoding": "gzip, deflate, br, zstd",
      },
    });

    // إعادة رابط التحميل مباشرة
    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: { link: url },
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
