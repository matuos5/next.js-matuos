// app/api/animezid/route.js
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    const episode = searchParams.get("episode");

    if (!name || !episode) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "الرجاء ادخال اسم الانمي ورقم الحلقة",
        },
        { status: 400 }
      );
    }

    // 1️⃣ البحث عن الحلقة في الموقع
    const searchUrl = `https://animezid.cam/?s=${encodeURIComponent(
      `${name} ${episode}`
    )}`;

    const searchRes = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const searchHtml = await searchRes.text();
    const $search = cheerio.load(searchHtml);

    // نفترض أن أول رابط هو الحلقة المطلوبة
    const firstLink = $search("a").attr("href");
    if (!firstLink) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على الحلقة",
        },
        { status: 404 }
      );
    }

    // 2️⃣ جلب صفحة الحلقة
    const epRes = await fetch(firstLink, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const epHtml = await epRes.text();
    const $ep = cheerio.load(epHtml);

    // 3️⃣ استخراج روابط الفيديو
    const videoLinks = [];

    // عناصر <video> أو <source>
    $ep("video source, video").each((i, el) => {
      const src =
        $ep(el).attr("src") ||
        $ep(el).attr("data-src") ||
        $ep(el).find("source").attr("src");
      if (src) videoLinks.push(src);
    });

    const pageText = $ep.root().text();

    // البحث عن روابط m3u8 (HLS)
    const m3u8Links = [...pageText.matchAll(/https?:\/\/[^\s'"]+\.m3u8/gi)].map(
      (m) => m[0]
    );

    // البحث عن روابط mp4 عادية
    const mp4Links = [...pageText.matchAll(/https?:\/\/[^\s'"]+\.mp4/gi)].map(
      (m) => m[0]
    );

    // دمج كل الروابط وإزالة التكرار
    const found = Array.from(new Set([...videoLinks, ...m3u8Links, ...mp4Links]));

    if (!found.length) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على روابط فيديو",
        },
        { status: 404 }
      );
    }

    // 4️⃣ إعادة روابط الفيديو جاهزة للبث
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 0,
        msg: "success",
        data: found,
        info: "روابط HLS (.m3u8) يمكن استخدامها مباشرة في مشغلات HLS.js أو video tag",
      },
      { status: 200 }
    );

  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "Internal error",
        error: err.message,
      },
      { status: 500 }
    );
  }
}
