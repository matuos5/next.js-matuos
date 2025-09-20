import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

const BASE_URL = "https://animezid.cam";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const anime = searchParams.get("anime");
    const episode = searchParams.get("episode");

    if (!anime || !episode) {
      return NextResponse.json(
        { owner: "MATUOS3MK", code: 400, msg: "يرجى ادخال اسم الأنمي و رقم الحلقة" },
        { status: 400 }
      );
    }

    const res = await axios.get(`${BASE_URL}/search.php`, {
      params: { keywords: anime, "video-id": "" },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; MAR-LX1A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.51 Mobile Safari/537.36",
      },
    });

    const $ = cheerio.load(res.data);
    let vid = null;

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = $(el).text();
      if (href.includes("watch.php?vid=") && text.includes(episode)) {
        vid = new URL(href, BASE_URL).searchParams.get("vid");
      }
    });

    if (!vid) {
      return NextResponse.json(
        { owner: "MATUOS3MK", code: 404, msg: "لم يتم العثور على الحلقة المطلوبة" },
        { status: 404 }
      );
    }

    const epRes = await axios.get(`${BASE_URL}/watch.php`, {
      params: { vid },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; MAR-LX1A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.51 Mobile Safari/537.36",
      },
    });

    const $$ = cheerio.load(epRes.data);
    const links = [];

    $$("video source, a[href], iframe").each((_, el) => {
      const src = $$(el).attr("src") || $$(el).attr("href");
      if (src && (src.includes(".mp4") || src.includes(".m3u8"))) {
        links.push(src);
      }
    });

    if (!links.length) {
      return NextResponse.json(
        { owner: "MATUOS3MK", code: 404, msg: "لم يتم العثور على روابط فيديو للحلقة" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "MATUOS3MK",
      code: 0,
      msg: "success",
      data: { anime, episode, vid, links },
    });
  } catch (err) {
    return NextResponse.json(
      { owner: "MATUOS3MK", code: 500, msg: "Internal error", error: err.message },
      { status: 500 }
    );
  }
}
