import { NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chromium from "chrome-aws-lambda";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const tiktokUrl = searchParams.get("url");

    if (!tiktokUrl) {
      return NextResponse.json({ code: 0, msg: "No URL provided", data: null }, { status: 400 });
    }

    // تشغيل Puppeteer مع Chromium الخاص بـ Vercel
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.goto(tiktokUrl, { waitUntil: "networkidle2" });

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
