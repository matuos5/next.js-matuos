// app/api/download/route.js
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import axios from "axios";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى اضافة رابط صالح للحلقة",
        },
        { status: 400 }
      );
    }

    // اسم الملف المحلي من الرابط
    const fileName = url.split("/").pop();
    const outputPath = path.resolve("./", fileName);

    const response = await axios.get(url, {
      responseType: "stream",
      headers: {
        'Host': 'a1.mp4upload.com:183',
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0',
        'sec-ch-ua': '"Not;A=Brand";v="99", "Brave";v="139", "Chromium";v="139"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Sec-GPC': '1',
        'Accept-Language': 'ar-SY,ar;q=0.9',
        'Sec-Fetch-Site': 'same-site',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-User': '?1',
        'Sec-Fetch-Dest': 'document',
        'Referer': 'https://www.mp4upload.com/',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
      },
    });

    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "Download completed successfully",
      data: { file: outputPath },
    });

  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "Internal error",
        error: err.message,
      },
      { status: 500 }
    );
  }
}    // نفترض أن أول رابط هو الحلقة المطلوبة
    const firstLink = $search("a").attr("href");
    if (!firstLink) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على الحلقة",
        },
        { status: 404 }
      );
    }

    // 2️⃣ جلب صفحة الحلقة
    const epRes = await fetch(firstLink, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const epHtml = await epRes.text();
    const $ep = cheerio.load(epHtml);

    // 3️⃣ استخراج روابط الفيديو
    const videoLinks = [];

    // عناصر <video> أو <source>
    $ep("video source, video").each((i, el) => {
      const src =
        $ep(el).attr("src") ||
        $ep(el).attr("data-src") ||
        $ep(el).find("source").attr("src");
      if (src) videoLinks.push(src);
    });

    const pageText = $ep.root().text();

    // البحث عن روابط m3u8 (HLS)
    const m3u8Links = [...pageText.matchAll(/https?:\/\/[^\s'"]+\.m3u8/gi)].map(
      (m) => m[0]
    );

    // البحث عن روابط mp4 عادية
    const mp4Links = [...pageText.matchAll(/https?:\/\/[^\s'"]+\.mp4/gi)].map(
      (m) => m[0]
    );

    // دمج كل الروابط وإزالة التكرار
    const found = Array.from(new Set([...videoLinks, ...m3u8Links, ...mp4Links]));

    if (!found.length) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على روابط فيديو",
        },
        { status: 404 }
      );
    }

    // 4️⃣ إعادة روابط الفيديو جاهزة للبث
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 0,
        msg: "success",
        data: found,
        info: "روابط HLS (.m3u8) يمكن استخدامها مباشرة في مشغلات HLS.js أو video tag",
      },
      { status: 200 }
    );

  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "Internal error",
        error: err.message,
      },
      { status: 500 }
    );
  }
}
