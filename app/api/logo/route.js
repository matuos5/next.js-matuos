import { NextResponse } from "next/server";

/**
 * GET /api/zoviz?brand_name=Ahmad
 *
 * يرسل طلب إلى Zoviz لإنشاء ألبوم لاسم معيّن، ويرجع الـ HTML الخام للصفحة.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    // نفس الباراميتر المستخدم في axios
    const brandName =
      searchParams.get("brand_name") || searchParams.get("name");

    if (!brandName) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى إضافة باراميتر brand_name مثل: ?brand_name=Ahmad",
        },
        { status: 400 }
      );
    }

    const encoded = encodeURIComponent(brandName);

    const response = await fetch(
      `https://zoviz.com/app/album?brand_name=${encoded}`,
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "sec-ch-ua": '"Chromium";v="139", "Not;A=Brand";v="99"',
          "sec-ch-ua-mobile": "?1",
          "sec-ch-ua-platform": '"Android"',
          "upgrade-insecure-requests": "1",
          "sec-fetch-site": "same-origin",
          "sec-fetch-mode": "navigate",
          "sec-fetch-user": "?1",
          "sec-fetch-dest": "document",
          referer:
            "https://zoviz.com/ar/?srsltid=AfmBOooSlm2gsN3KnJ3ks0A8kbK3VpuRe20B3jYJL5o5rDJ1RdfrpFZ7",
          "accept-language":
            "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6",
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: response.status,
          msg: "فشل في الاتصال بموقع Zoviz أو حدث خطأ في إنشاء الألبوم",
        },
        { status: 500 }
      );
    }

    const html = await response.text();

    // هنا نرجع الـ HTML الخام (تقدر لاحقاً تحلله أو تستخدمه كما تريد)
    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: {
        brand_name: brandName,
        html,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "حدث خطأ داخلي في السيرفر أثناء استعلام Zoviz",
        error: err?.message,
      },
      { status: 500 }
    );
  }
          } 
