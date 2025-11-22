import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى إضافة باراميتر name مثل: ?name=MATUOS",
        },
        { status: 400 }
      );
    }

    //
    // STEP 1 — Create brand (register)
    //
    const registerRes = await fetch(
      "https://api.zoviz.com/album/brand/register",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
          "sec-ch-ua": '"Chromium";v="139", "Not;A=Brand";v="99"',
          "sec-ch-ua-mobile": "?1",
          "sec-ch-ua-platform": '"Android"',
          origin: "https://zoviz.com",
          "sec-fetch-site": "same-site",
          "sec-fetch-mode": "cors",
          "sec-fetch-dest": "empty",
          referer: "https://zoviz.com/",
          "accept-language":
            "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6",
        },
        body: JSON.stringify({
          brand_name: [name],
        }),
      }
    );

    if (!registerRes.ok) {
      const raw = await registerRes.text().catch(() => null);
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 500,
          msg: "فشل إنشاء البراند من Zoviz",
          status: registerRes.status,
          raw,
        },
        { status: 500 }
      );
    }

    const registerData = await registerRes.json();

    // Extract brand_id
    const brandId =
      registerData?.brandId ||
      registerData?.brand_id ||
      registerData?.result?.id;

    if (!brandId) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 500,
          msg: "تعذر استخراج brand_id من رد Zoviz",
          data: registerData,
        },
        { status: 500 }
      );
    }

    //
    // STEP 2 — Fetch album HTML page (your GET scraper)
    //
    const albumUrl = `https://zoviz.com/app/album?brand_name=${encodeURIComponent(
      name
    )}`;

    const albumRes = await fetch(albumUrl, {
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
    });

    if (!albumRes.ok) {
      const albumText = await albumRes.text().catch(() => null);
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 500,
          msg: "فشل جلب صفحة الألبوم من Zoviz",
          status: albumRes.status,
          raw: albumText?.slice(0, 300) || null,
        },
        { status: 500 }
      );
    }

    const albumHtml = await albumRes.text();

    //
    // RETURN FINAL JSON
    //
    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: {
        name,
        brand_id: brandId,
        albumUrl,
        albumHtml,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "خطأ داخلي في السيرفر",
        error: err.message,
      },
      { status: 500 }
    );
  }
  } 
