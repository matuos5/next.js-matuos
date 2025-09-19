import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

const BASE = "https://animezid.cam";
const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 10; MAR-LX1A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.51 Mobile Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  Connection: "keep-alive",
  "Accept-Language": "ar,en-US;q=0.7,en;q=0.6",
};

async function httpGet(path, params = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const searchParams = new URLSearchParams(params).toString();
  const finalUrl = searchParams ? `${url}?${searchParams}` : url;
  const res = await fetch(finalUrl, { headers: DEFAULT_HEADERS });
  return await res.text();
}

async function searchAnime(keywords, limit = 5) {
  const html = await httpGet("/search.php", { keywords, "video-id": "" });
  const $ = cheerio.load(html);
  const results = [];
  $("a[href]").each((_, el) => {
    if (results.length >= limit) return;
    const href = $(el).attr("href") || "";
    if (href.includes("watch.php?vid=")) {
      const url = new URL(href, BASE).toString();
      const vid = new URL(url).searchParams.get("vid");
      const title = $(el).text().trim() || $(el).attr("title") || null;
      results.push({ vid, title, link: url });
    }
  });
  return results;
}

async function getVideoLinks(vid) {
  const html = await httpGet("/watch.php", { vid });
  const $ = cheerio.load(html, { decodeEntities: false });
  const found = [];

  $("video source").each((_, el) => {
    const s = $(el).attr("src") || $(el).attr("data-src");
    if (s) found.push(s);
  });
  $("iframe").each((_, el) => {
    const s = $(el).attr("src");
    if (s) found.push(s);
  });
  $("a[href]").each((_, el) => {
    const s = $(el).attr("href");
    if (s && (s.includes(".m3u8") || s.includes(".mp4"))) found.push(s);
  });

  const m3u8Regex = html.match(/https?:\/\/[^'"\s]+\.m3u8/g) || [];
  const mp4Regex = html.match(/https?:\/\/[^'"\s]+\.mp4/g) || [];
  found.push(...m3u8Regex, ...mp4Regex);

  const unique = Array.from(new Set(found));
  return unique.map((src) => ({
    src,
    type: src.includes(".m3u8")
      ? "hls"
      : src.includes(".mp4")
      ? "mp4"
      : "embed",
  }));
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const vid = searchParams.get("vid");
    const limit = parseInt(searchParams.get("limit") || "5", 10);

    if (!q && !vid) {
      return NextResponse.json(
        {
          owner: "MATUOS3MK",
          code: 400,
          msg: "يرجى اضافة q للبحث أو vid لجلب روابط الفيديو",
        },
        { status: 400 }
      );
    }

    if (vid) {
      const links = await getVideoLinks(vid);
      return NextResponse.json({
        owner: "MATUOS3MK",
        code: 0,
        msg: "success",
        data: { vid, links },
      });
    }

    const results = await searchAnime(q, limit);
    const enriched = [];
    for (const r of results) {
      const sources = r.vid ? await getVideoLinks(r.vid) : [];
      enriched.push({ ...r, sources });
    }

    return NextResponse.json({
      owner: "MATUOS3MK",
      code: 0,
      msg: "success",
      data: { query: q, results: enriched },
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
