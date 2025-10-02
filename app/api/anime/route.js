// app/api/anime/route.js
import { NextResponse } from "next/server";
import axios from "axios";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 400,
        msg: "يرجى اضافة رابط صالح للحلقة",
      },
      { status: 400 }
    );
  }

  try {
    const response = await axios.get(url, {
      responseType: "stream",
      headers: {
        'Host': 'a1.mp4upload.com:183',
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0',
        'sec-ch-ua': '"Not;A=Brand";v="99", "Brave";v="139", "Chromium";v="139"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Sec-GPC': '1',
        'Accept-Language': 'ar-SY,ar;q=0.9',
        'Sec-Fetch-Site': 'same-site',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-User': '?1',
        'Sec-Fetch-Dest': 'document',
        'Referer': 'https://www.mp4upload.com/',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
      }
    });

    // هنا نكتفي بإرجاع رسالة فقط لأن الملفات كبيرة جدًا
    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "Request sent successfully. File streaming not handled in this example.",
    }, { status: 200 });

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
