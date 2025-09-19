import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        {
          owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
          code: 400,
          msg: "يرجى اضافة رابط يوتيوب صالح",
        },
        { status: 400 }
      );
    }

    const formData = new URLSearchParams({
      sf_url: url,
      sf_submit: "",
      new: "2",
      lang: "ar",
      app: "",
      country: "sy",
      os: "Android",
      browser: "Chrome",
      channel: "main",
    });

    const response = await fetch("https://ar.savefrom.net/savefrom.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": "https://ar.savefrom.net",
        "Referer": "https://ar.savefrom.net/249Ex/",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; MAR-LX1A Build/HUAWEIMAR-L21MEB) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.51 Mobile Safari/537.36",
      },
      body: formData.toString(),
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    // نحاول استخراج أول زر تحميل
    const downloadLink = $("a.link-download[href]").attr("href");

    if (!downloadLink) {
      return NextResponse.json(
        {
          owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
          code: 404,
          msg: "لم يتم العثور على رابط تحميل",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
      code: 0,
      msg: "success",
      data: { link: downloadLink },
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
        code: 500,
        msg: "Internal error",
        error: err.message,
      },
      { status: 500 }
    );
  }
}
