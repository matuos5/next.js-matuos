import { NextResponse } from "next/server";
import { chromium } from "playwright-chromium";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const tiktokUrl = searchParams.get("url");

    if (!tiktokUrl) {
      return NextResponse.json({ code: 0, msg: "No URL provided", data: null }, { status: 400 });
    }

    // تشغيل Chromium باستخدام Playwright
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(tiktokUrl, { waitUntil: "networkidle" });

    // جلب رابط الفيديو من صفحة تيك توك
    const videoLink = await page.evaluate(() => {
      const video = document.querySelector("video");
      return video ? video.src : null;
    });

    await browser.close();

    if (!videoLink) {
      return NextResponse.json({ code: 0, msg: "No video found", data: null });
    }

    return NextResponse.json({
      code: 1,
      msg: "success",
      data: { link: videoLink },
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({
      code: 0,
      msg: "Error fetching video",
      error: error.message,
      data: null,
    }, { status: 500 });
  }
}
