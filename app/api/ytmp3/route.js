// app/api/ssvid/route.js
import { NextResponse } from "next/server";
import qs from "querystring";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        {
          owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
          code: 400,
          msg: "يرجى إضافة رابط صالح",
        },
        { status: 400 }
      );
    }

    // 1️⃣ جلب صفحة الفيديو
    const pageRes = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 12; M2007J20CG Build/SKQ1.211019.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.160 Mobile Safari/537.36",
      },
    });
    const html = await pageRes.text();

    // 2️⃣ استخراج vid و k من HTML مباشرة
    const vidMatch = html.match(/vid\s*=\s*["']([a-zA-Z0-9_-]+)["']/);
    const kMatch = html.match(/k\s*=\s*["']([^"']+)["']/);

    if (!vidMatch || !kMatch) {
      return NextResponse.json(
        {
          owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
          code: 404,
          msg: "تعذر استخراج بيانات الفيديو",
        },
        { status: 404 }
      );
    }

    const vid = vidMatch[1];
    const k = kMatch[1];

    // 3️⃣ إرسال POST للحصول على رابط التحميل
    const apiRes = await fetch("https://ssvid.net/api/ajax/convert?hl=en", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Origin": "https://ssvid.net",
        "Referer": url,
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 12; M2007J20CG Build/SKQ1.211019.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.160 Mobile Safari/537.36",
      },
      body: qs.stringify({ vid, k }),
    });

    const data = await apiRes.json();

    if (!data || !data.url) {
      return NextResponse.json(
        {
          owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
          code: 404,
          msg: "لم يتم العثور على رابط التحميل",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
      code: 0,
      msg: "success",
      data: { link: data.url },
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
