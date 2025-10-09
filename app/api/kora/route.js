import { NextResponse } from "next/server";
import axios from "axios";

export async function GET() {
  try {
    const url = 'https://www.yallakora.com/bundles/Layout?v=LwZIpLxWFfk_yUWVvwWvcmsVT_aRnJMJdGL-uFNDi741';

    const response = await axios.get(url, {
      headers: {
        'Host': 'www.yallakora.com',
        'Connection': 'keep-alive',
        'sec-ch-ua-platform': '"Android"',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
        'sec-ch-ua': '"Not;A=Brand";v="99", "Brave";v="139", "Chromium";v="139"',
        'sec-ch-ua-mobile': '?1',
        'Accept': '*/*',
        'Sec-GPC': '1',
        'Accept-Language': 'ar-SY,ar;q=0.5',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Dest': 'script',
        'Referer': 'https://www.yallakora.com/epl/2968/news/526266/',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Cookie': 'ASP.NET_SessionId=rfqhkqx3ysam3wjx4bcnqtcr; Location=Syrian Arab Republic; cf_clearance=vPmpKALPfuB89MKf9H2w0h9oWj2jlS3m3AklaPvkvt8-1760010075-1.2.1.1-WL21HgesLY3wF7WyFxt42rbvZqdjMsjh1rYe9ytkLMKMiikAzgMoEdLcHpRuAQw7MfKLlIdOv0Hqih4lZmwDb.hud.9iScdBCBiuj9fzywCT7Ql8YL2wVxQaN4fPSVg6_E7J0ocZSE7OLiF2ASlGHt.76q0dX1QwWIObEUWboM._n2hdUTPQVSeAz0m4cLeqkoz8NR36q6zwe_8FegqMx65lH0yELRSqT5mIQHTNQSM'
      }
    });

    // بيانات الـ Bundle عادة تأتي كنص JS، نحتاج تحويلها لـ JSON إذا كانت موجودة
    // مثال: البحث عن متغير window.__INITIAL_DATA__ أو أي JSON
    // سنحاول استخدام eval بحذر فقط إذا لم يكن هناك بديل
    let data;
    try {
      // eslint-disable-next-line no-eval
      data = eval(response.data); // ⚠️ هذا يعتمد على شكل Bundle، قد تحتاج تعديل
    } catch {
      data = response.data; // fallback: نص خام
    }

    // ترجيع JSON منظم (مثال على شكل أخبار)
    // افترض أن البيانات تحتوي على خاصية "News" أو "Articles"
    const news = data?.News || data?.Articles || []; // عدّل حسب شكل البيانات الفعلي

    return NextResponse.json({
      code: 0,
      msg: "success",
      data: news
    });

  } catch (err) {
    return NextResponse.json({
      code: 500,
      msg: "Internal error",
      data: { error: err.message }
    }, { status: 500 });
  }
}      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}
