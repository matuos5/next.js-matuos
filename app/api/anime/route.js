// app/api/anime/route.js
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    // الحصول على القيم من query params
    const anime_name = searchParams.get("anime_name") || "Unknown Anime"; // قيمة افتراضية إذا لم يتم توفيرها
    const episode_number = searchParams.get("episode_number") || "N/A";  // قيمة افتراضية إذا لم يتم توفيرها

    // تعريف جسم الطلب
    const body = {
      event: "request",
      anime_name,
      episode_number,
    };

    const response = await fetch(`https://push-sdk.com/event?z=1081313`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
        "sec-ch-ua": `"Not;A=Brand";v="99", "Android WebView";v="139", "Chromium";v="139"`,
        "sec-ch-ua-platform": '"Android"',
        "sec-ch-ua-mobile": "?1",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 12; M2007J20CG Build/SKQ1.211019.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.160 Mobile Safari/537.36",
        "Origin": "https://en.loader.to",
        "X-Requested-With": "mark.via.gp",
        "Referer": "https://en.loader.to/",
        "Accept": "*/*",
      },
      body: JSON.stringify(body),
    });

    const data = await response.text();

    return NextResponse.json({
      owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
      code: 0,
      msg: "success",
      data: { raw: data, anime_name, episode_number },
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
        code: 500,
        msg: "Internal error",
        data: { error: err.message },
      },
      { status: 500 }
    );
  }
}      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
        "sec-ch-ua": `"Not;A=Brand";v="99", "Android WebView";v="139", "Chromium";v="139"`,
        "sec-ch-ua-platform": '"Android"',
        "sec-ch-ua-mobile": "?1",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 12; M2007J20CG Build/SKQ1.211019.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.160 Mobile Safari/537.36",
        "Origin": "https://en.loader.to",
        "X-Requested-With": "mark.via.gp",
        "Referer": "https://en.loader.to/",
        "Accept": "*/*",
      },
      body: JSON.stringify(body),
    });

    const data = await response.text();

    return NextResponse.json({
      owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
      code: 0,
      msg: "success",
      data: { raw: data },
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
        code: 500,
        msg: "Internal error",
        data: { error: err.message },
      },
      { status: 500 }
    );
  }
}
