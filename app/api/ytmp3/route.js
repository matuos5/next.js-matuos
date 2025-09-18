// app/api/push-event/route.js
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    // قراءة القيم من query params أو استخدام القيم الافتراضية
    const zone_id = parseInt(searchParams.get("zone_id")) || 1081313;
    const subid1 = searchParams.get("subid1") || null;
    const subid2 = searchParams.get("subid2") || "";

    const body = {
      event: "request",
      zone_id,
      subid1,
      subid2,
      ext_click_id: null,
      client_hints: {
        architecture: "",
        bitness: "",
        brands: [
          { brand: "Not;A=Brand", version: "99" },
          { brand: "Android WebView", version: "139" },
          { brand: "Chromium", version: "139" },
        ],
        full_version_list: [],
        mobile: true,
        model: "",
        platform: "Android",
        platform_version: "",
        wow64: false,
      },
    };

    const response = await fetch(`https://push-sdk.com/event?z=${zone_id}`, {
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
