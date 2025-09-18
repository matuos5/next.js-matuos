// app/api/download/route.js
import { NextResponse } from "next/server";
import fetch from "node-fetch";
import * as zlib from "zlib";

export async function POST(req) {
  try {
    const body = await req.json();
    const userData = body.data || "";

    // بيانات مشابهة للـ curl الأصلي
    const postData = new URLSearchParams(userData);

    const response = await fetch('https://rv400.com/?z=9454635&syncedCookie=false&rhd=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://rv400.com',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 12; M2007J20CG Build/SKQ1.211019.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.160 Mobile Safari/537.36',
        'Accept-Encoding': 'gzip, deflate, br'
      },
      body: postData.toString()
    });

    let buffer = await response.arrayBuffer();
    let contentEncoding = response.headers.get("content-encoding");
    let decoded;

    if (contentEncoding === "gzip") {
      decoded = zlib.gunzipSync(Buffer.from(buffer));
    } else if (contentEncoding === "br") {
      decoded = zlib.brotliDecompressSync(Buffer.from(buffer));
    } else {
      decoded = Buffer.from(buffer);
    }

    let text = decoded.toString("utf-8");

    // محاولة استخراج رابط الفيديو أو الملف من الـ HTML
    const videoMatch = text.match(/https?:\/\/[^\s'"]+\.(mp4|webm)/);
    const videoUrl = videoMatch ? videoMatch[0] : null;

    return NextResponse.json({
      owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
      code: videoUrl ? 1 : 404,
      msg: videoUrl ? "success" : "No video found",
      data: videoUrl
    });
  } catch (e) {
    return NextResponse.json({
      owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
      code: 500,
      msg: "Server error",
      error: e.message
    });
  }
}
