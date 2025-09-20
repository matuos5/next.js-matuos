import { NextResponse } from "next/server";
import chromium from "chrome-aws-lambda";
import puppeteer from "puppeteer-core";

export async function GET(req) {
  let browser = null;

  try {
    const { searchParams } = new URL(req.url);
    const anime = searchParams.get("anime");
    const episode = searchParams.get("episode");

    if (!anime || !episode) {
      return NextResponse.json(
        {
          owner: "MATUOS3MK",
          code: 400,
          msg: "يرجى تحديد اسم الأنمي ورقم الحلقة",
        },
        { status: 400 }
      );
    }

    const searchUrl = `https://animezid.cam/search.php?keywords=${encodeURIComponent(
      anime
    )}`;

    // تشغيل المتصفح
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath:
        (await chromium.executablePath) || "/usr/bin/google-chrome",
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // فتح صفحة البحث
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });

    // البحث عن رابط الحلقة
    const episodeLink = await page.evaluate((anime, episode) => {
      const anchors = Array.from(document.querySelectorAll("a"));
      const match = anchors.find((a) =>
        a.textContent
          ?.toLowerCase()
          .includes(`${anime.toLowerCase()} ${episode}`)
      );
      return match ? match.href : null;
    }, anime, episode);

    if (!episodeLink) {
      return NextResponse.json(
        {
          owner: "MATUOS3MK",
          code: 404,
          msg: "لم يتم العثور على الحلقة المطلوبة",
        },
        { status: 404 }
      );
    }

    // فتح صفحة الحلقة
    await page.goto(episodeLink, { waitUntil: "domcontentloaded" });

    // جلب روابط الفيديو
    const links = await page.evaluate(() => {
      const sources = Array.from(document.querySelectorAll("iframe, source"));
      return sources
        .map((el) => el.src || el.getAttribute("src"))
        .filter((src) => src && (src.includes("mp4") || src.includes("m3u8")));
    });

    if (!links.length) {
      return NextResponse.json(
        {
          owner: "MATUOS3MK",
          code: 404,
          msg: "لم يتم العثور على روابط تحميل/مشاهدة",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "MATUOS3MK",
      code: 0,
      msg: "success",
      data: {
        anime,
        episode,
        episodeLink,
        links,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS3MK",
        code: 500,
        msg: "Internal error",
        error: err.message,
      },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
      }
