import { NextResponse } from "next/server";
import yts from "yt-search";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q) {
      return NextResponse.json(
        { error: "مطلوب اسم او رابط للبحث" },
        { status: 400 }
      );
    }

    // البحث عن الفيديو
    const results = await yts(q);
    if (!results || !results.videos || results.videos.length === 0) {
      return NextResponse.json(
        { error: "لم يتم العثور على نتائج" },
        { status: 404 }
      );
    }

    const video = results.videos[0];
    const youtubeUrl = `https://www.youtube.com/watch?v=${video.videoId}`;

    // يرجعلك بيانات الفيديو + الرابط الأصلي
    return NextResponse.json({
      status: "success",
      data: {
        title: video.title,
        description: video.description,
        thumbnail: video.thumbnail,
        time: video.timestamp,
        ago: video.ago,
        views: video.views,
        url: youtubeUrl,
        author: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
        channel: video.author?.url,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "حدث خطأ غير متوقع" },
      { status: 500 }
    );
  }
}
