// ./app/api/anime/route.js
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
      return NextResponse.json(
        { code: 400, msg: "vid و token مطلوبان" },
        { status: 400 }
      );
    }

    // اسم الملف المؤقت
    const tempDir = path.resolve("./tmp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, `anime_${vid}.mkv`);

    // رابط التحميل النهائي
    const url = `https://fs20.bowfile.com/token/download/dl/${vid}/[AnimeZid.net]_Episode.mkv`;

    // تحميل الحلقة مؤقتًا
    const response = await axios.get(url, {
      params: { download_token },
      responseType: "stream",
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "*/*",
      },
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    // الانتظار حتى ينتهي التحميل
    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    // إعادة JSON بمعلومات الحلقة
    return NextResponse.json({
      code: 0,
      msg: "success",
      data: {
        vid,
        download: filePath,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { code: 500, msg: "Internal error", error: err.message },
      { status: 500 }
    );
  }
}
  } catch (err) {
    return NextResponse.json({ code: 500, msg: "خطأ داخلي", error: err.message }, { status: 500 });
  }
}
