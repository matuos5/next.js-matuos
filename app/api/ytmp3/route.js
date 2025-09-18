import { NextResponse } from "next/server";

// دالة تظبط الفيديو ID سواء من رابط أو نص
function extractVideoId(input) {
  try {
    // لو المستخدم حاطط ID مباشر
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

    // لو رابط youtube.com/watch?v=...
    const ytMatch = input.match(/v=([a-zA-Z0-9_-]{11})/);
    if (ytMatch) return ytMatch[1];

    // لو رابط youtu.be/...
    const shortMatch = input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return shortMatch[1];

    return null;
  } catch {
    return null;
  }
}

export async function GET(req) {
  const start = Date.now();
  try {
    const { searchParams } = new URL(req.url);
    const input = searchParams.get("v");
    const format = searchParams.get("f") || "mp3";

    if (!input) {
      return NextResponse.json({
        owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
        code: 400,
        msg: "يرجى إدخال رابط أو ID للفيديو",
        processed_time: (Date.now() - start) / 1000,
        data: null,
      });
    }

    const videoId = extractVideoId(input);
    if (!videoId) {
      return NextResponse.json({
        owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
        code: 404,
        msg: "تعذر استخراج videoId من الرابط",
        processed_time: (Date.now() - start) / 1000,
        data: null,
      });
    }

    // نفس الرابط من الـ curl
    const url = `https://nuun.mnuu.nu/api/v1/download?sig=MenPTpoN%2Br%2FJhPWHJaqZw%2B%2BZgWFeE7bN%2FyENRTlREOSs4EUkG1tFQgxYbnRfXU%2FIK9xA0Wqgj5tWcVjhX2AcIobwQ5JUNVPqUZw9kaZY%2FrvUl%2FWbB01TD%2BhC4IMd3nRxr%2F%2B8fP9qEHcJwoHzsN309C7ukVhrphKF29AmOmUI7p4C6oaNN5%2FBAz%2FaPNR69F9pafi5qe1CL1FlEWr9LEGcwmBDOgRefVMJqeoyi7mHCta9jQVLHt%2FU%2FgxdmcHwmOvqlPtMEkWPz6kk6F3%2BuBNQdi6HLD952rKiPwJ5JkOCJxCTrUZ%2FoUfuha5vgFLw9mI7Vu8ZjgM%2BDRsRE7aPpjUO2g%3D%3D&s=3&v=${videoId}&f=${format}`;

    const resp = await fetch(url, {
      headers: {
        "Host": "nuun.mnuu.nu",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 12; M2007J20CG Build/SKQ1.211019.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.160 Mobile Safari/537.36",
        "Referer": "https://y2mate.nu/",
        "Accept": "*/*",
        "Accept-Language": "ar,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    const downloadUrl = resp.url;

    return NextResponse.json({
      owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
      code: 1,
      msg: "success",
      processed_time: (Date.now() - start) / 1000,
      data: {
        videoId,
        format,
        link: downloadUrl,
      },
    });
  } catch (err) {
    return NextResponse.json({
      owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
      code: 500,
      msg: err.message || "Internal error",
      processed_time: (Date.now() - start) / 1000,
      data: null,
    });
  }
}
