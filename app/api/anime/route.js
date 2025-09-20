import { NextResponse } from "next/server";
import puppeteer from "puppeteer";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const keyword = searchParams.get("keyword");

    if (!keyword) {
      return NextResponse.json(
        { owner: "matuos-3mk", code: 400, msg: "يرجى إضافة كلمة البحث" },
        { status: 400 }
      );
    }

    // تشغيل المتصفح
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Linux; Android 10; MAR-LX1A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.51 Mobile Safari/537.36"
    );

    // 1️⃣ البحث
    const searchUrl = `https://animezid.cam/search.php?keywords=${encodeURIComponent(keyword)}&video-id=`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });

    // جلب جميع الحلقات
    const episodes = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a[href*='watch.php?vid=']")).map(a => {
        return {
          title: a.textContent.trim(),
          vid: new URL(a.href).searchParams.get("vid"),
          download: null
        };
      });
    });

    // 2️⃣ الحصول على رابط التحميل لكل حلقة
    for (let ep of episodes) {
      try {
        const watchUrl = `https://animezid.cam/watch.php?vid=${ep.vid}`;
        await page.goto(watchUrl, { waitUntil: "domcontentloaded" });

        const downloadLink = await page.evaluate(() => {
          const a = document.querySelector("a[href*='fs']");
          return a ? a.href : null;
        });

        ep.download = downloadLink;
      } catch (err) {
        ep.download = null;
      }
    }

    await browser.close();

    return NextResponse.json({
      owner: "matuos-3mk",
      code: 0,
      msg: "success",
      data: episodes
    });
  } catch (err) {
    return NextResponse.json(
      { owner: "matuos-3mk", code: 500, msg: "Internal error", error: err.message },
      { status: 500 }
    );
  }
}    const results = [];
    $("a").each((i, el) => {
      const href = $(el).attr("href");
      if (href && href.includes("watch.php?vid=")) {
        const vid = href.split("vid=")[1];
        const title = $(el).text().trim();
        results.push({ title, vid });
      }
    });

    if (!results.length) {
      return NextResponse.json({
        owner: "matuos-3mk",
        code: 404,
        msg: "لم يتم العثور على حلقات للأنمي",
      });
    }

    // 2. الحصول على رابط التحميل لكل حلقة
    const episodes = [];
    for (const r of results) {
      try {
        const videoPage = await axios.get("https://animezid.cam/watch.php", {
          params: { vid: r.vid },
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Linux; Android 10; MAR-LX1A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.51 Mobile Safari/537.36",
            Referer: "https://animezid.cam/",
            Cookie: "PHPSESSID=2spf8d71h7p51lpn5v9838jpbe",
          },
        });

        const downloadMatch = videoPage.data.match(
          /https:\/\/fs\d+\.koramaup\.com\/.*?\.mkv\?download_token=[a-z0-9]+/i
        );

        episodes.push({
          title: r.title,
          vid: r.vid,
          download: downloadMatch ? downloadMatch[0] : null,
        });
      } catch {
        episodes.push({
          title: r.title,
          vid: r.vid,
          download: null,
        });
      }
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
