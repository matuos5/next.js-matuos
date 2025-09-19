import { NextResponse } from "next/server";
import puppeteer from "puppeteer";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const anime = searchParams.get("anime");
    const episode = searchParams.get("episode");

    if (!anime || !episode) {
      return NextResponse.json(
        {
          owner: "MATUOS3MK",
          code: 400,
          msg: "يرجى ادخال اسم الأنمي و رقم الحلقة",
        },
        { status: 400 }
      );
    }

    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Linux; Android 10; MAR-LX1A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.51 Mobile Safari/537.36"
    );

    const searchUrl = `https://animezid.cam/search.php?keywords=${encodeURIComponent(
      anime
    )}&video-id=`;
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForTimeout(3000);

    const vid = await page.evaluate((episodeNumber) => {
      const anchors = Array.from(document.querySelectorAll("a[href]"));
      for (const a of anchors) {
        const href = a.href || "";
        const text = a.innerText || "";
        if (href.includes("watch.php?vid=") && text.includes(episodeNumber)) {
          const url = new URL(href);
          return url.searchParams.get("vid");
        }
      }
      return null;
    }, episode);

    if (!vid) {
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

    const episodeUrl = `https://animezid.cam/watch.php?vid=${vid}`;
    await page.goto(episodeUrl, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForTimeout(3000);

    const links = await page.evaluate(() => {
      const found = [];
      document.querySelectorAll("video source, iframe, a[href]").forEach((el) => {
        const src = el.src || el.getAttribute("data-src") || el.href;
        if (src && (src.includes(".m3u8") || src.includes(".mp4"))) found.push(src);
      });

      document.querySelectorAll("script").forEach((s) => {
        const text = s.innerText;
        const regex = /https?:\/\/[^'"\s]+(\.m3u8|\.mp4)/g;
        const matches = text.match(regex);
        if (matches) found.push(...matches);
      });

      return Array.from(new Set(found));
    });

    await browser.close();

    if (!links.length) {
      return NextResponse.json(
        {
          owner: "MATUOS3MK",
          code: 404,
          msg: "لم يتم العثور على روابط فيديو للحلقة",
        },
        { status: 404 }
      );
    }

    const formatted = links.map((src) => ({
      src,
      type: src.includes(".m3u8") ? "hls" : "mp4",
    }));

    return NextResponse.json({
      owner: "MATUOS3MK",
      code: 0,
      msg: "success",
      data: { anime, episode, vid, links: formatted },
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
