// app/api/anime/route.js
import { NextResponse } from "next/server";
import axios from "axios";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const keyword = searchParams.get("keyword");

    if (!keyword) {
      return NextResponse.json(
        {
          owner: "matuos-3mk",
          code: 400,
          msg: "يرجى اضافة كلمة بحث",
        },
        { status: 400 }
      );
    }

    // 1. سكرب البحث
    const searchResponse = await axios.get("https://animezid.cam/search.php", {
      params: { keywords: keyword, "video-id": "" },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; MAR-LX1A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.51 Mobile Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        Referer: "https://animezid.cam/",
        Cookie: "PHPSESSID=2spf8d71h7p51lpn5v9838jpbe",
      },
    });

    // استخراج حلقات الفيديو
    const vidRegex = /watch\.php\?vid=([a-z0-9]+)/gi;
    const titleRegex = /<a href="watch\.php\?vid=[a-z0-9]+".*?>(.*?)<\/a>/gi;

    const episodes = [];
    let vidMatch;
    let titleMatch;
    while ((vidMatch = vidRegex.exec(searchResponse.data)) !== null) {
      titleMatch = titleRegex.exec(searchResponse.data);
      episodes.push({
        title: titleMatch ? titleMatch[1].trim() : "Unknown",
        vid: vidMatch[1],
        download: null,
      });
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
