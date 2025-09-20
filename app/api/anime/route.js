import { NextResponse } from "next/server";

let chromium;
let puppeteer;

export async function GET(req) {
  try {
    // تحميل المكتبات فقط أثناء runtime
    if (!chromium) chromium = await import("chrome-aws-lambda");
    if (!puppeteer) puppeteer = await import("puppeteer-core");

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

    // تشغيل المتصفح فقط عند الطلب
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // صفحة البحث
    const searchUrl = `https://animezid.cam/search.php?keywords=${encodeURIComponent(
      anime
    )}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });

    // البحث عن الحلقة
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
      await browser.close();
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

    await browser.close();

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
  }
}
