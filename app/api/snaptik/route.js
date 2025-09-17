// app/api/download/route.js
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { code: 400, msg: "Missing TikTok URL" },
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
        "Host": "ttsave.app",
        "Connection": "keep-alive",
        "sec-ch-ua-platform": '"Android"',
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 12; M2007J20CG Build/SKQ1.211019.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.160 Mobile Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "sec-ch-ua":
          '"Not;A=Brand";v="99", "Android WebView";v="139", "Chromium";v="139"',
        "Content-Type": "application/json",
        "sec-ch-ua-mobile": "?1",
        "Origin": "https://ttsave.app",
        "X-Requested-With": "mark.via.gp",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
        "Referer": "https://ttsave.app/en",
        "Accept-Language": "ar,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();

    // حاول نعمل parse للـ JSON
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch {
      // رجّع النص زي ما هو لو مش JSON
      return NextResponse.json(
        { code: 502, msg: "Server did not return JSON", raw: text.slice(0, 300) },
        { status: 502 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      { code: 500, msg: "Internal error", error: err.message },
      { status: 500 }
    );
  }
}
