// app/api/yallakora/route.js
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    console.log("📡 Fetching Yallakora layout bundle...");

    const url =
      "https://www.yallakora.com/bundles/Layout?v=LwZIpLxWFfk_yUWVvwWvcmsVT_aRnJMJdGL-uFNDi741";

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Host": "www.yallakora.com",
        "Connection": "keep-alive",
        "sec-ch-ua-platform": '"Android"',
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
        "sec-ch-ua":
          '"Not;A=Brand";v="99", "Brave";v="139", "Chromium";v="139"',
        "sec-ch-ua-mobile": "?1",
        "Accept": "*/*",
        "Sec-GPC": "1",
        "Accept-Language": "ar-SY,ar;q=0.5",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Dest": "script",
        "Referer":
          "https://www.yallakora.com/epl/2968/news/526266/%d9%84%d9%8a%d9%81%d8%b1%d8%a8%d9%88%d9%84-%d9%8a%d8%b1%d8%b5%d8%af-%d8%ac%d9%88%d9%87%d8%b1%d8%a9-%d8%a3%d9%81%d8%b1%d9%8a%d9%82%d9%8a%d8%a9-%d9%84%d8%ae%d9%84%d8%a7%d9%81%d8%a9-%d9%85%d8%ad%d9%85%d8%af-%d8%b5%d9%84%d8%a7%d8%ad",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Cookie":
          "ASP.NET_SessionId=rfqhkqx3ysam3wjx4bcnqtcr; Location=Syrian Arab Republic; cf_clearance=vPmpKALPfuB89MKf9H2w0h9oWj2jlS3m3AklaPvkvt8-1760010075-1.2.1.1-WL21HgesLY3wF7WyFxt42rbvZqdjMsjh1rYe9ytkLMKMiikAzgMoEdLcHpRuAQw7MfKLlIdOv0Hqih4lZmwDb.hud.9iScdBCBiuj9fzywCT7Ql8YL2wVxQaN4fPSVg6_E7J0ocZSE7OLiF2ASlGHt.76q0dX1QwWIObEUWboM._n2hdUTPQVSeAz0m4cLeqkoz8NR36q6zwe_8FegqMx65lH0yELRSqT5mIQHTNQSM",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed with status ${response.status}`);
    }

    // قراءة النص (ملف JavaScript)
    const data = await response.text();

    console.log("✅ Successfully fetched Yallakora layout");

    return NextResponse.json({
      owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
      code: 0,
      msg: "success",
      data: {
        raw: data,
        contentLength: data.length,
      },
    });
  } catch (err) {
    console.error("❌ Error fetching Yallakora layout:", err.message);
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
