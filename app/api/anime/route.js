import { NextResponse } from "next/server";
import axios from "axios";
import fs from "fs";
import path from "path";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const vid = searchParams.get("vid");
    const download_token = searchParams.get("download_token");

    if (!vid || !download_token) {
      return NextResponse.json({ code: 400, msg: "vid و token مطلوبان" }, { status: 400 });
    }

    const tempDir = path.resolve("./tmp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const filePath = path.join(tempDir, `anime_${vid}.mkv`);
    const url = `https://fs20.bowfile.com/token/download/dl/${vid}/[AnimeZid.net]_Episode.mkv`;

    // جلب الحلقة
    const response = await axios.get(url, {
      params: { download_token },
      responseType: "stream",
      headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*" },
    });

    // إنشاء WriteStream
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    // ننتظر حتى ينتهي الكتابة
    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    // العودة بعد انتهاء الكتابة مباشرة، بدون أي أقواس إضافية
    return NextResponse.json({
      code: 0,
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
