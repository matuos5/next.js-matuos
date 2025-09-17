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
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 12; M2007J20CG Build/SKQ1.211019.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.160 Mobile Safari/537.36",
        Accept: "application/json, text/plain, */*",
        Origin: "https://ttsave.app",
        Referer: "https://ttsave.app/en",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { code: 500, msg: "Internal error", error: err.message },
      { status: 500 }
    );
  }
}
