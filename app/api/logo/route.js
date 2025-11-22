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

    // STEP 1 — Register brand (POST)
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
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 500,
          msg: "فشل إنشاء البراند",
        },
        { status: 500 }
      );
    }

    const registerData = await registerRes.json();

    // FIXED: استخراج الـ brand_id بشكل صحيح
    const brandId =
      registerData?.brandId ||
      registerData?.brand_id ||
      registerData?.result?.id;

    if (!brandId) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 500,
          msg: "تعذر استخراج brand_id",
          data: registerData,
        },
        { status: 500 }
      );
    }

    // STEP 2 — Get logo files (GET)
    const assetsUrl = `https://api.zoviz.com/album/brand/assets?brand_id=${brandId}`;

    const assetsRes = await fetch(assetsUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
        accept: "application/json, text/plain, */*",
      },
    });

    if (!assetsRes.ok) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 500,
          msg: "فشل جلب ملفات اللوجوهات",
        },
        { status: 500 }
      );
    }

    const assetsData = await assetsRes.json();

    const files = assetsData?.files || [];

    if (!files.length) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لا توجد لوجوهات متوفرة",
        },
        { status: 404 }
      );
    }

    // STEP 3 — Construct final logo URLs
    const logos = files.map((file) => {
      const fileId = file.file_id;
      const finalURL = `https://api.zoviz.com/lfp?b=${brandId}&f=${fileId}&d=0`;

      return {
        file_id: fileId,
        variant: file.variant,
        style: file.style,
        url: finalURL,
      };
    });

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: {
        name,
        brand_id: brandId,
        total: logos.length,
        logos,
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
