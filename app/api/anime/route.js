// app/api/anime/route.js
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    // قراءة القيم من query params أو استخدام القيم الافتراضية
    const zone_id = parseInt(searchParams.get("zone_id")) || 1081313;
    const subid1 = searchParams.get("subid1") || null;
    const subid2 = searchParams.get("subid2") || "";

    const body = {
      event: "request",
      zone_id,
      subid1,
      subid2,
      ext_click_id: null,
      client_hints: {
        architecture: "",
        bitness: "",
        brands: [
          { brand: "Not;A=Brand", version: "99" },
          { brand: "Android WebView", version: "139" },
          { brand: "Chromium", version: "139" },
        ],
        full_version_list: [],
        mobile: true,
        model: "",
        platform: "Android",
        platform_version: "",
        wow64: false,
      },
    };

    const response = await fetch(`https://push-sdk.com/event?z=${zone_id}`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
        "sec-ch-ua": `"Not;A=Brand";v="99", "Android WebView";v="139", "Chromium";v="139"`,
        "sec-ch-ua-platform": '"Android"',
        "sec-ch-ua-mobile": "?1",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 12; M2007J20CG Build/SKQ1.211019.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.160 Mobile Safari/537.36",
        "Origin": "https://en.loader.to",
        "X-Requested-With": "mark.via.gp",
        "Referer": "https://en.loader.to/",
        "Accept": "*/*",
      },
      body: JSON.stringify(body),
    });

    const data = await response.text();

    return NextResponse.json({
      owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
      code: 0,
      msg: "success",
      data: { raw: data },
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
        code: 500,
        msg: "Internal error",
        data: { error: err.message },
      },
      { status: 500 }
    );
  }
}

// الكود الذي فيه المشكلة كان يبدو هكذا، فتم تعديل الأقواس فيه:
} else {
  return null;
        }      'Upgrade-Insecure-Requests': '1',
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
