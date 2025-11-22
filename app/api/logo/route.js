import { NextResponse } from "next/server";

// Helper: fetch + JSON safely
async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null; 
  }
  return { res, data };
}

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
    const { res: registerRes, data: registerData } = await fetchJson(
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
          status: registerRes.status,
          data: registerData,
        },
        { status: 500 }
      );
    }

    // استخراج brand_id بشكل صحيح
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

    // STEP 2 — محاولات متعددة لجلب ملفات اللوجوهات
    const attempts = [
      {
        desc: "GET brand_id",
        url: `https://api.zoviz.com/album/brand/assets?brand_id=${brandId}`,
        options: {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
            accept: "application/json, text/plain, */*",
          },
        },
      },
      {
        desc: "GET brandId",
        url: `https://api.zoviz.com/album/brand/assets?brandId=${brandId}`,
        options: {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
            accept: "application/json, text/plain, */*",
          },
        },
      },
      {
        desc: "POST brand_id",
        url: "https://api.zoviz.com/album/brand/assets",
        options: {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent":
              "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
            accept: "application/json, text/plain, */*",
            origin: "https://zoviz.com",
            "sec-fetch-site": "same-site",
          },
          body: JSON.stringify({ brand_id: brandId }),
        },
      },
    ];

    let assetsData = null;
    let debugLog = [];

    for (const attempt of attempts) {
      const { res, data } = await fetchJson(attempt.url, attempt.options);

      debugLog.push({
        attempt: attempt.desc,
        url: attempt.url,
        status: res.status,
        ok: res.ok,
        snippet: data ? JSON.stringify(data).slice(0, 200) : null,
      });

      if (res.ok && data) {
        assetsData = data;
        break;
      }
    }

    if (!assetsData) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 500,
          msg: "فشل جلب ملفات اللوجوهات",
          debug: debugLog,
        },
        { status: 500 }
      );
    }

    const files =
      assetsData?.files ||
      assetsData?.result?.files ||
      [];

    if (!files.length) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لا توجد لوجوهات متوفرة",
          raw: assetsData,
        },
        { status: 404 }
      );
    }

    // STEP 3 — Build logo download URLs
    const logos = files.map((file) => {
      const fileId = file.file_id || file.id || file.fileId;
      return {
        file_id: fileId,
        variant: file.variant || null,
        style: file.style || null,
        url: `https://api.zoviz.com/lfp?b=${brandId}&f=${fileId}&d=0`,
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
        msg: "خطأ داخلي",
        error: err.message,
      },
      { status: 500 }
    );
  }
          } 
