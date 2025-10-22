import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const reelUrl = searchParams.get("url");

    if (!reelUrl) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى اضافة رابط انستقرام صالح",
        },
        { status: 400 }
      );
    }

    const encoded = encodeURIComponent(reelUrl);

    const response = await fetch(`https://igram.website/content.php?url=${encoded}`, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://igram.website/ar",
      },
    });

    const data = await response.json();

    if (!data || data.status !== "ok" || !data.html) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على الفيديو أو الرابط غير صالح",
        },
        { status: 404 }
      );
    }

    // تحليل الـHTML لاستخراج رابط الفيديو
    const $ = cheerio.load(data.html);
    let videoUrl;

    $("a").each((_, el) => {
      const href = $(el).attr("href");
      if (href && href.includes(".mp4")) {
        videoUrl = href;
      }
    });

    if (!videoUrl) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على رابط الفيديو في الصفحة",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: {
        username: data.username || "unknown",
        link: videoUrl,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "حدث خطأ داخلي في السيرفر",
        error: err.message,
      },
      { status: 500 }
    );
  }
}
