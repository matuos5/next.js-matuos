// app/api/episode/route.js
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const anime = searchParams.get("anime"); // مثال: "dragon ball"
    const episode = searchParams.get("ep");  // مثال: "1"

    if (!anime || !episode) {
      return NextResponse.json(
        {
          owner: "matuos",
          code: 400,
          msg: "يرجى اضافة اسم الانمي + رقم الحلقة",
        },
        { status: 400 }
      );
    }

    // خطوة 1: البحث في الموقع
    const searchUrl = `https://anime3rb.com/?s=${encodeURIComponent(anime + " " + episode)}`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      },
    });

    const searchHtml = await searchRes.text();
    const $search = cheerio.load(searchHtml);

    // يجيب أول نتيجة (رابط الحلقة)
    const episodeUrl = $search(".post-title a").attr("href");

    if (!episodeUrl) {
      return NextResponse.json(
        {
          owner: "matuos",
          code: 404,
          msg: "الحلقة غير موجودة",
        },
        { status: 404 }
      );
    }

    // خطوة 2: سكراب صفحة الحلقة للحصول على رابط التحميل
    const epRes = await fetch(episodeUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      },
    });

    const epHtml = await epRes.text();
    const $ep = cheerio.load(epHtml);

    // مثال: جلب رابط التحميل الأول (هنا لازم تعدل selector حسب الموقع)
    const downloadLink = $ep("a[href*='.mp4']").first().attr("href");

    if (!downloadLink) {
      return NextResponse.json(
        {
          owner: "matuos",
          code: 404,
          msg: "رابط التحميل غير موجود",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "matuos",
      code: 0,
      msg: "success",
      data: {
        anime,
        episode,
        link: downloadLink,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "matuos",
        code: 500,
        msg: "Internal error",
        error: err.message,
      },
      { status: 500 }
    );
  }
}      code: 0,
      msg: "success",
      data: { vid, download: filePath },
    });

  } catch (err) {
    return NextResponse.json(
      { code: 500, msg: "Internal error", error: err.message },
      { status: 500 }
    );
  }
}
