import { NextResponse } from "next/server";
import axios from "axios";
import fs from "fs";
import path from "path";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const tiktokUrl = searchParams.get("url");

    if (!tiktokUrl) {
      return NextResponse.json(
        { code: 0, msg: "No URL provided", data: null },
        { status: 400 }
      );
    }

    // طلب الملف من ttsave.app بصيغة binary
    const response = await axios.post(
      "https://ttsave.app/download",
      { query: tiktokUrl, language_id: "1" },
      { responseType: "arraybuffer" }
    );

    // إنشاء اسم فريد للملف
    const fileName = `tiktok_${Date.now()}.mp4`;
    const filePath = path.join(process.cwd(), "public", fileName);

    // حفظ الملف في مجلد public
    fs.writeFileSync(filePath, Buffer.from(response.data));

    // إرجاع رابط التحميل في JSON
    const downloadUrl = `${process.env.NEXT_PUBLIC_BASE_URL || ""}/${fileName}`;
    return NextResponse.json({
      code: 1,
      msg: "success",
      data: { link: downloadUrl }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { code: 0, msg: "Error fetching video", error: error.message, data: null },
      { status: 500 }
    );
  }
}
