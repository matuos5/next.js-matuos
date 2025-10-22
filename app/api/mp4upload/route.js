// app/api/mp4upload/route.js
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى إدخال رابط mp4upload صالح",
        },
        { status: 400 }
      );
    }

    // استخراج ID من الرابط (مثلاً: https://www.mp4upload.com/0s04jdy7xyux)
    const id = url.split("/").pop().replace(/[^a-zA-Z0-9]/g, "");
    if (!id) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "تعذر استخراج ID من الرابط",
        },
        { status: 400 }
      );
    }

    // تجهيز بيانات POST
    const formData = new URLSearchParams({
      op: "download2",
      id,
      rand: "",
      referer: "https://animelek.live/",
      method_free: "Free Download",
      method_premium: "",
    });

    // إرسال الطلب إلى mp4upload
    const response = await fetch("https://www.mp4upload.com/cd", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": `https://www.mp4upload.com/${id}`,
        "Origin": "https://www.mp4upload.com",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/png,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br, zstd",
      },
      body: formData,
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    // استخراج رابط الفيديو الحقيقي
    const link =
      $('a[href*=".mp4"]').attr("href") ||
      $("source").attr("src") ||
      html.match(/https?:\/\/[^\s"']+\.mp4/)?.[0];

    if (!link) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "تعذر العثور على رابط التحميل",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: {
        id,
        link,
      },
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
        }
