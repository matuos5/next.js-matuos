import { NextResponse } from "next/server";
import yts from "yt-search";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q) {
      return NextResponse.json(
        { error: "مطلوب اسم او رابط البحث كـ ?q=..." },
        { status: 400 }
      );
    }

    // yt-search يقبل اسم او رابط يوتيوب
    const results = await yts(q);

    const video = results?.videos?.[0];
    if (!video) {
      return NextResponse.json(
        { error: "لم يتم العثور على نتائج" },
        { status: 404 }
      );
    }

    const data = {
      title: video.title,
      videoId: video.videoId,
      url: video.url,           // رابط اليوتيوب الأصلي (البوت يستخدمه للتحميل)
      thumbnail: video.thumbnail,
      duration: video.timestamp,
      views: video.views,
      ago: video.ago,
      author: video.author?.name || null,
    };

    return NextResponse.json({ status: "ok", data }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "حدث خطأ غير متوقع" },
      { status: 500 }
    );
  }
}
