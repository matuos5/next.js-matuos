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
      return NextResponse.json(
        { owner: "MATUOS3MK", code: 400, msg: "يرجى إضافة vid و download_token" },
        { status: 400 }
      );
    }

    // تحديد اسم الملف المؤقت
    const fileName = `anime_${vid}.mkv`;
    const filePath = path.resolve(`./tmp/${fileName}`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    // رابط تحميل الحلقة
    const downloadUrl = `https://fs20.bowfile.com/token/download/dl/${vid}`;

    // تحميل الحلقة مؤقتاً
    const response = await axios.get(downloadUrl, {
      params: { download_token: token },
      responseType: "stream",
      headers: {
        Referer: "https://bowfile.com/",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36"
      },
      maxRedirects: 5,
      timeout: 0
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    return NextResponse.json({
      owner: "MATUOS3MK",
      code: 0,
      msg: "تم تحميل الحلقة مؤقتًا",
      data: { file: fileName, path: filePath }
    });
  } catch (err) {
    return NextResponse.json(
      { owner: "MATUOS3MK", code: 500, msg: "Internal error", error: err.message },
      { status: 500 }
    );
  }
}      }
    });

    if (!results.length) {
      return NextResponse.json(
        { owner: "MATUOS3MK", code: 404, msg: "لم يتم العثور على نتائج" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "MATUOS3MK",
      code: 0,
      msg: "success",
      data: { query, results },
    });
  } catch (err) {
    return NextResponse.json(
      { owner: "MATUOS3MK", code: 500, msg: "Internal error", error: err.message },
      { status: 500 }
    );
  }
    }
