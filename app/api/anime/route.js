// ./app/api/anime/route.js
import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";

// ⚠️ ملاحظة: تأكد من أن البوت موجود ويعمل منفصلاً لاستقبال ملفات التحميل
// بوت Node.js يتحمل إرسال الفيديو على واتساب

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const keyword = searchParams.get("keyword");
    const chatId = searchParams.get("chatId"); // رقم واتساب المستقبل

    if (!keyword || !chatId) {
      return NextResponse.json({
        owner: "matuos-3mk",
        code: 400,
        msg: "يرجى إضافة كلمة بحث ورقم واتساب صالح",
      }, { status: 400 });
    }

    // 1️⃣ البحث عن الانمي
    const searchRes = await axios.get('https://animezid.cam/search.php', {
      params: { keywords: keyword, 'video-id': '' },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; MAR-LX1A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.51 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Referer': 'https://animezid.cam/',
      }
    });

    const $ = cheerio.load(searchRes.data);
    const episodes = [];

    // استخراج قائمة الحلقات من نتائج البحث
    $('a[href*="watch.php?vid="]').each((i, el) => {
      const title = $(el).text().trim() || "Unknown";
      const vidMatch = $(el).attr('href').match(/vid=([a-z0-9]+)/i);
      if (vidMatch) {
        episodes.push({
          title,
          vid: vidMatch[1],
          download: null
        });
      }
    });

    if (!episodes.length) {
      return NextResponse.json({
        owner: "matuos-3mk",
        code: 404,
        msg: "لم يتم العثور على حلقات للأنمي",
      }, { status: 404 });
    }

    // 2️⃣ تحميل الحلقة الأولى مؤقتاً
    const firstEpisode = episodes[0];

    const videoPage = await axios.get('https://animezid.cam/watch.php', {
      params: { vid: firstEpisode.vid },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; MAR-LX1A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.51 Mobile Safari/537.36',
        'Referer': 'https://animezid.cam/',
      }
    });

    const downloadMatch = videoPage.data.match(/https:\/\/fs\d+\.koramaup\.com\/.*?\.mkv\?download_token=[a-z0-9]+/i);
    if (!downloadMatch) throw new Error('رابط التحميل المباشر لم يتم العثور عليه');
    const downloadUrl = downloadMatch[0];

    // تحميل الحلقة مؤقتاً
    const tempPath = path.resolve(`./temp_${firstEpisode.vid}.mkv`);
    const writer = fs.createWriteStream(tempPath);
    const downloadResponse = await axios.get(downloadUrl, { responseType: 'stream' });
    downloadResponse.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // 3️⃣ إرسال الحلقة عبر واتساب عن طريق البوت Node.js
    // ⚠️ هذا الجزء يفترض أن البوت جاهز للاستلام من هذا الملف المؤقت
    // مثال إرسال: (يتم تنفيذ الدالة من سكربت البوت)
    // await sendEpisode(chatId, tempPath);

    // بعد الإرسال يمكنك حذف الملف المؤقت
    fs.unlinkSync(tempPath);

    return NextResponse.json({
      owner: "matuos-3mk",
      code: 0,
      msg: "success",
      data: episodes
    });

  } catch (err) {
    return NextResponse.json({
      owner: "matuos-3mk",
      code: 500,
      msg: "Internal error",
      error: err.message
    }, { status: 500 });
  }
      }    $(".video-block").each((i, el) => {
      const title = $(el).find("h3 a").text().trim();
      const href = $(el).find("h3 a").attr("href");
      const vidMatch = href ? href.match(/vid=([a-z0-9]+)/) : null;

      if (vidMatch) {
        episodes.push({
          title,
          vid: vidMatch[1],
          download: null,
        });
      }
    });

    return NextResponse.json({
      owner: "matuos-3mk",
      code: 0,
      msg: "success",
      data: episodes,
    });

  } catch (err) {
    return NextResponse.json(
      {
        owner: "matuos-3mk",
        code: 500,
        msg: "Internal error",
        error: err.message,
      },
      { status: 500 }
    );
  }
  }    // 2. استخراج حلقات البحث
    $(".video-block").each((i, el) => {
      const title = $(el).find("h3 a").text().trim();
      const href = $(el).find("h3 a").attr("href");
      const vidMatch = href ? href.match(/vid=([a-z0-9]+)/) : null;

      if (vidMatch) {
        episodes.push({
          title,
          vid: vidMatch[1],
          download: null, // التحميل يحتاج سكرب آخر لكل فيديو
        });
      }
    });

    return NextResponse.json({
      owner: "matuos-3mk",
      code: 0,
      msg: "success",
      data: episodes,
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "matuos-3mk",
        code: 500,
        msg: "Internal error",
        error: err.message,
      },
      { status: 500 }
    );
  }
}    const episodes = [];
    let vidMatch;
    let titleMatch;
    while ((vidMatch = vidRegex.exec(searchResponse.data)) !== null) {
      titleMatch = titleRegex.exec(searchResponse.data);
      episodes.push({
        title: titleMatch ? titleMatch[1].trim() : "Unknown",
        vid: vidMatch[1],
        download: null,
      });
    }

    return NextResponse.json({
      owner: "matuos-3mk",
      code: 0,
      msg: "success",
      data: episodes,
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "matuos-3mk",
        code: 500,
        msg: "Internal error",
        error: err.message,
      },
      { status: 500 }
    );
  }
}
