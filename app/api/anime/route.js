// app/api/push-event/route.js
import { NextResponse } from "next/server";
import axios from 'axios';
import fs from 'fs';
import path from 'path';

export async function GET(req) {
  try {
    // استخراج معلمات الـ query من الـ URL
    const { searchParams } = new URL(req.url);
    const animeName = searchParams.get("anime_name") || "One Piece"; // اسم الأنمي
    const episodeNumber = parseInt(searchParams.get("episode_number")) || 1145; // رقم الحلقة

    // إنشاء رابط الحلقة بناءً على اسم الأنمي ورقم الحلقة
    const episodeURL = getEpisodeURL(animeName, episodeNumber);
    
    if (!episodeURL) {
      return NextResponse.json({
        owner: "MATUOS-3MK",
        code: 404,
        msg: "رابط الحلقة غير صحيح أو غير متوفر.",
      });
    }

    // تحديد اسم الملف بناءً على الحلقة
    const filename = `${animeName} - الحلقة ${episodeNumber}.mp4`;
    const filePath = path.resolve(__dirname, filename);

    // ترويسات الطلب
    const headers = {
      'Host': 'a3.mp4upload.com:183',
      'Connection': 'keep-alive',
      'Cache-Control': 'max-age=0',
      'sec-ch-ua': '"Not;A=Brand";v="99", "Brave";v="139", "Chromium";v="139"',
      'sec-ch-ua-mobile': '?1',
      'sec-ch-ua-platform': '"Android"',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Sec-GPC': '1',
      'Accept-Language': 'ar-SY,ar;q=0.6',
      'Sec-Fetch-Site': 'same-site',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Sec-Fetch-Dest': 'document',
      'Referer': 'https://www.mp4upload.com/',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Cookie': 'affiliate=7fjLoOLoE7cprG3OHA1JRf%2B6WWHcuI5r56bEbxgEXAWAbBRI8X9fe07T1Bvw0JkTWGuLvic1B5mcXH250ttassfhtk3owgh5BHZASg4zRoUukm%2FfoSdxk1NqgG3XLABWr6Xd8kHlC2yxsfyWytFPfy8%3D'
    };

    // إرسال الطلب
    const response = await axios({
      method: 'get',
      url: episodeURL,
      headers,
      responseType: 'stream'
    });

    // إنشاء المجلد وتخزين الملف
    const writer = fs.createWriteStream(filePath);

    response.data.pipe(writer);

    writer.on('finish', () => {
      console.log(`تم تحميل ${filename} بنجاح!`);
    });

    writer.on('error', (err) => {
      console.error('حدث خطأ أثناء تحميل الملف:', err.message);
    });

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "تم تحميل الحلقة بنجاح.",
      data: { file: filePath },
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "حدث خطأ داخلي",
        data: { error: err.message },
      },
      { status: 500 }
    );
  }
}

// دالة لإنشاء رابط الحلقة بناءً على اسم الأنمي ورقم الحلقة
function getEpisodeURL(animeName, episodeNumber) {
  const baseURL = 'https://a3.mp4upload.com:183/d/';
  const episodePath = `${animeName} - ${episodeNumber}.mp4`; // بناء الرابط بناءً على الأنمي ورقم الحلقة
  const fullURL = `${baseURL}${episodePath}`;

  if (fullURL) {
    return fullURL;
  } else {
    return null;
  }
}    }

    const videoLink = match[1];

    // 3- إرجاع الرابط المباشر للفيديو
    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: { link: videoLink },
    });

  } catch (err) {
    // في حالة حدوث خطأ داخل الـ try
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "حدث خطأ داخلي",
        error: err.message,
      },
      { status: 500 }
    );
  }
}
