import { NextResponse } from "next/server";
import axios from "axios";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const tiktokUrl = searchParams.get("url");

    if (!tiktokUrl) {
      return NextResponse.json(
        { code: 0, msg: "No URL provided", data: null },
        { status: 400 }
      );
    }

    // طلب الملف من ttsave.app بصيغة binary
    const response = await axios.post(
      "https://ttsave.app/download",
      { query: tiktokUrl, language_id: "1" },
      {
        responseType: "arraybuffer", // مهم عشان نستقبل الملف binary
        headers: {
          "Host": "ttsave.app",
          "Connection": "keep-alive",
          "sec-ch-ua-platform": '"Android"',
          "User-Agent":
            'Mozilla/5.0 (Linux; Android 12; M2007J20CG Build/SKQ1.211019.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.160 Mobile Safari/537.36',
          "sec-ch-ua": '"Not;A=Brand";v="99", "Android WebView";v="139", "Chromium";v="139"',
          "sec-ch-ua-mobile": "?1",
          Origin: "https://ttsave.app",
          "X-Requested-With": "mark.via.gp",
          "Sec-Fetch-Site": "same-origin",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Dest": "empty",
          Referer: "https://ttsave.app/en",
          "Accept-Encoding": "gzip, deflate, br, zstd",
          "Accept-Language": "ar,en-GB;q=0.9,en-US;q=0.8,en;q=0.7"
        }
      }
    );

    // إعادة الملف مباشرة
    const fileBuffer = Buffer.from(response.data);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": response.headers["content-type"] || "application/octet-stream",
        "Content-Length": response.headers["content-length"] || fileBuffer.length,
        "Content-Disposition": 'attachment; filename="tiktok_video.mp4"'
      }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { code: 0, msg: "Error fetching video", error: error.message, data: null },
      { status: 500 }
    );
  }
}
