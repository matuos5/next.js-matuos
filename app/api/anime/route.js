// ./app/api/anime/route.js
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
          msg: "يرجى إضافة كلمة بحث صالحة",
        },
        { status: 400 }
      );
    }

    // 1. البحث عن معرف الفيديو
    const searchResponse = await axios.get("https://animezid.cam/search.php", {
      params: { keywords: keyword, "video-id": "" },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; MAR-LX1A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.51 Mobile Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        Referer: "https://animezid.cam/",
        Cookie: "PHPSESSID=2spf8d71h7p51lpn5v9838jpbe",
      },
    });

    const vidMatch = searchResponse.data.match(/watch\.php\?vid=([a-z0-9]+)/i);
    if (!vidMatch) {
      return NextResponse.json(
        {
          owner: "matuos-3mk",
          code: 404,
          msg: "لم يتم العثور على فيديو لهذا البحث",
        },
        { status: 404 }
      );
    }
    const vid = vidMatch[1];

    // 2. الوصول لصفحة الفيديو واستخراج رابط التحميل
    const videoPage = await axios.get("https://animezid.cam/watch.php", {
      params: { vid },
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

    if (!downloadMatch) {
      return NextResponse.json(
        {
          owner: "matuos-3mk",
          code: 404,
          msg: "رابط التحميل المباشر لم يتم العثور عليه",
        },
        { status: 404 }
      );
    }

    const downloadUrl = downloadMatch[0];

    return NextResponse.json({
      owner: "matuos-3mk",
      code: 0,
      msg: "success",
      data: { vid, downloadUrl },
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
