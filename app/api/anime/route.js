// app/api/anime/route.js
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    const episode = searchParams.get("episode");

    if (!name || !episode) {
      return NextResponse.json(
        {
          owner: "matuos",
          code: 400,
          msg: "الرجاء ادخال اسم الانمي ورقم الحلقة",
        },
        { status: 400 }
      );
    }

    const searchUrl = `https://anime3rb.com/?s=${encodeURIComponent(
      `${name} ${episode}`
    )}`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const searchHtml = await searchRes.text();
    const $search = cheerio.load(searchHtml);
    const firstLink = $search("a").attr("href");

    if (!firstLink) {
      return NextResponse.json(
        { owner: "matuos", code: 404, msg: "لم يتم العثور على الحلقة" },
        { status: 404 }
      );
    }

    const epRes = await fetch(firstLink, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const epHtml = await epRes.text();
    const $ep = cheerio.load(epHtml);
    const downloadLinks = $ep("a.btn-success")
      .map((i, el) => $ep(el).attr("href"))
      .get();

    if (!downloadLinks.length) {
      return NextResponse.json(
        { owner: "matuos", code: 404, msg: "لم يتم العثور على روابط تحميل" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "matuos",
      code: 0,
      msg: "success",
      data: downloadLinks,
    });
  } catch (err) {
    return NextResponse.json(
      { owner: "matuos", code: 500, msg: "Internal error", error: err.message },
      { status: 500 }
    );
  }
}
