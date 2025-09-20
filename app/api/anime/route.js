import { NextResponse } from "next/server";
import axios from "axios";
import fs from "fs";
import path from "path";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const vid = searchParams.get("vid");
    const token = searchParams.get("token");

    if (!vid || !token) {
      return NextResponse.json({ code: 400, msg: "vid و token مطلوبان" }, { status: 400 });
    }

    const fileName = `anime_${vid}.mkv`;
    const filePath = path.resolve(`./tmp/${fileName}`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const downloadUrl = `https://fs20.bowfile.com/token/download/dl/${vid}`;

    const response = await axios.get(downloadUrl, {
      params: { download_token: token },
      responseType: "stream",
      headers: { Referer: "https://bowfile.com/", "User-Agent": "Mozilla/5.0" },
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    return NextResponse.json({ code: 0, msg: "تم تحميل الحلقة", file: fileName });

  } catch (err) {
    return NextResponse.json({ code: 500, msg: "خطأ داخلي", error: err.message }, { status: 500 });
  }
}
