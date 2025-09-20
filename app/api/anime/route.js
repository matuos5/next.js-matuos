// ./app/api/anime/route.js
import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const keyword = searchParams.get("keyword");

    if (!keyword) {
      return NextResponse.json(
        {
          owner: "matuos-3mk",
          code: 400,
          msg: "يرجى إضافة اسم الأنمي",
        },
        { status: 400 }
      );
    }

    // 1. البحث عن الأنمي
    const searchRes = await axios.get("https://animezid.cam/search.php", {
      params: { keywords: keyword, "video-id": "" },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; MAR-LX1A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.51 Mobile Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        Referer: "https://animezid.cam/",
        Cookie: "PHPSESSID=2spf8d71h7p51lpn5v9838jpbe",
      },
    });

    const $ = cheerio.load(searchRes.data);

    // استخراج كل الـ vid من نتائج البحث
    const results = [];
    $("a").each((i, el) => {
      const href = $(el).attr("href");
      if (href && href.includes("watch.php?vid=")) {
        const vid = href.split("vid=")[1];
        const title = $(el).text().trim();
        results.push({ title, vid });
      }
    });

    if (!results.length) {
      return NextResponse.json({
        owner: "matuos-3mk",
        code: 404,
        msg: "لم يتم العثور على حلقات للأنمي",
      });
    }

    // 2. الحصول على رابط التحميل لكل حلقة
    const episodes = [];
    for (const r of results) {
      try {
        const videoPage = await axios.get("https://animezid.cam/watch.php", {
          params: { vid: r.vid },
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Linux; Android 10; MAR-LX1A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.51 Mobile Safari/537.36",
            Referer: "https://animezid.cam/",
            Cookie: "PHPSESSID=2spf8d71h7p51lpn5v9838jpbe",
          },
        });

        const downloadMatch = videoPage.data.match(
          /https:\/\/fs\d+\.koramaup\.com\/.*?\.mkv\?download_token=[a-z0-9]+/i
        );

        episodes.push({
          title: r.title,
          vid: r.vid,
          download: downloadMatch ? downloadMatch[0] : null,
        });
      } catch {
        episodes.push({
          title: r.title,
          vid: r.vid,
          download: null,
        });
      }
    }

    return NextResponse.json({
      owner: "matuos-3mk",
      code: 0,
      msg: "success",
      data: episodes,
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "matuos-3mk",
        code: 500,
        msg: "Internal error",
        error: err.message,
      },
      { status: 500 }
    );
  }
          }
