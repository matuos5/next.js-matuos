// app/api/ssvid/route.js
import { NextResponse } from "next/server";
import qs from "querystring";

export async function POST(req) {
  try {
    const { vid, k } = await req.json();

    if (!vid || !k) {
      return NextResponse.json(
        {
          owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
          code: 400,
          msg: "يرجى تقديم vid و k صالحين",
        },
        { status: 400 }
      );
    }

    const body = qs.stringify({ vid, k });

    const response = await fetch("https://ssvid.net/api/ajax/convert?hl=en", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Origin": "https://ssvid.net",
        "Referer": "https://ssvid.net/en10/youtube-to-mp3",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 12; M2007J20CG Build/SKQ1.211019.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.160 Mobile Safari/537.36",
      },
    });

    const data = await response.json();

    if (!data || !data.url) {
      return NextResponse.json(
        {
          owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
          code: 404,
          msg: "No download link found",
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
