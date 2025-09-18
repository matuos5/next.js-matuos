import { NextResponse } from "next/server";

export async function GET(req) {
  const start = Date.now();
  try {
    const { searchParams } = new URL(req.url);
    const fileUrl = searchParams.get("url"); // رابط الفيديو/الصوت النهائي

    if (!fileUrl) {
      return NextResponse.json({
        owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
        code: 400,
        msg: "No URL",
        data: null,
      }, { status: 400 });
    }

    // استخدام fetch المدمج
    const resp = await fetch(fileUrl);
    if (!resp.ok) {
      return NextResponse.json({
        owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
        code: 404,
        msg: "File not found",
        data: null,
      }, { status: 404 });
    }

    const arrayBuffer = await resp.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // JSON وهمي
    const fakeJson = {
      owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
      code: 1,
      msg: "success",
      data: { link: fileUrl, processed_time: (Date.now() - start) / 1000 }
    };

    const res = new NextResponse(fileBuffer);
    res.headers.set("Content-Disposition", "attachment; filename=file.mp3"); // غيّر حسب النوع
    res.headers.set("Content-Type", "audio/mpeg"); // mp3 أو video/mp4
    res.headers.set("X-Fake-JSON", JSON.stringify(fakeJson)); // JSON وهمي في الهيدر

    return res;
  } catch (err) {
    return NextResponse.json({
      owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
      code: 500,
      msg: err.message || "Internal error",
      processed_time: (Date.now() - start) / 1000,
      data: null,
    });
  }
}
