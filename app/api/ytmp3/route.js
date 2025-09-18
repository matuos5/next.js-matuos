// app/api/ytmp3/route.js
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

/**
 * يستخرج videoId من:
 * - id مباشر
 * - رابط youtube.com/watch?v=...
 * - رابط youtu.be/...
 */
function extractVideoId(input) {
  try {
    if (!input) return null;
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    const ytMatch = input.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (ytMatch) return ytMatch[1];
    const shortMatch = input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return shortMatch[1];
    return null;
  } catch {
    return null;
  }
}

export async function GET(req) {
  const start = Date.now();
  try {
    const { searchParams } = new URL(req.url);
    const input = searchParams.get("v");
    const format = (searchParams.get("f") || "mp3").toLowerCase();

    if (!input) {
      return NextResponse.json({
        owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
        code: 400,
        msg: "يرجى ادخال رابط او ID للفيديو",
        processed_time: (Date.now() - start) / 1000,
        data: null,
      }, { status: 400 });
    }

    const videoId = extractVideoId(input);
    if (!videoId) {
      return NextResponse.json({
        owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
        code: 404,
        msg: "تعذر استخراج videoId من الادخال",
        processed_time: (Date.now() - start) / 1000,
        data: null,
      }, { status: 404 });
    }

    // رابط Nuun downloader
    const remoteUrl = `https://nuun.mnuu.nu/api/v1/download?sig=MenPTpoN%2Br%2FJhPWHJaqZw%2B%2BZgWFeE7bN%2FyENRTlREOSs4EUkG1tFQgxYbnRfXU%2FIK9xA0Wqgj5tWcVjhX2AcIobwQ5JUNVPqUZw9kaZY%2FrvUl%2FWbB01TD%2BhC4IMd3nRxr%2F%2B8fP9qEHcJwoHzsN309C7ukVhrphKF29AmOmUI7p4C6oaNN5%2FBAz%2FaPNR69F9pafi5qe1CL1FlEWr9LEGcwmBDOgRefVMJqeoyi7mHCta9jQVLHt%2FU%2FgxdmcHwmOvqlPtMEkWPz6kk6F3%2BuBNQdi6HLD952rKiPwJ5JkOCJxCTrUZ%2FoUfuha5vgFLw9mI7Vu8ZjgM%2BDRsRE7aPpjUO2g%3D%3D&s=3&v=${videoId}&f=${encodeURIComponent(format)}`;

    // جلب رابط التحميل النهائي
    const resp = await fetch(remoteUrl, {
      method: "GET",
      headers: {
        Host: "nuun.mnuu.nu",
        Connection: "keep-alive",
        "sec-ch-ua": '"Not;A=Brand";v="99", "Android WebView";v="139", "Chromium";v="139"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "Upgrade-Insecure-Requests": "1",
        "User-Agent": "Mozilla/5.0 (Linux; Android 12; M2007J20CG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139 Mobile Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "X-Requested-With": "mark.via.gp",
        Referer: "https://y2mate.nu/",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "ar,en-US;q=0.9",
      },
      redirect: "follow",
    });

    let finalLink = resp.url;
    const contentType = resp.headers.get("content-type") || "";

    if (contentType.includes("html")) {
      const html = await resp.text();
      const $ = cheerio.load(html);
      const selectors = ['a[href$=".mp3"]','a[href$=".mp4"]','a.download','a#download','a.btn','a[href*="/download"]','a[href*="R2lu"]'];
      let found = null;
      for (const sel of selectors) {
        const el = $(sel).first();
        if (el && el.attr && el.attr("href")) { found = el.attr("href"); break; }
      }
      if (found) {
        try { finalLink = new URL(found, resp.url).href; } catch { finalLink = found; }
      } else {
        const hrefMatch = html.match(/https?:\/\/[^\s'"]+\.(mp3|mp4)(\?[^\s'"]*)?/i);
        if (hrefMatch) finalLink = hrefMatch[0];
      }
    }

    if (!finalLink) {
      return NextResponse.json({
        owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
        code: 404,
        msg: "No download link found",
        processed_time: (Date.now() - start) / 1000,
        data: null,
      }, { status: 404 });
    }

    // جلب الملف الحقيقي
    const fileResp = await fetch(finalLink);
    if (!fileResp.ok) throw new Error("Failed to fetch file");

    const arrayBuffer = await fileResp.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // JSON وهمي
    const fakeJson = {
      owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
      code: 1,
      msg: "success",
      data: { videoId, format, link: finalLink, processed_time: (Date.now() - start) / 1000 }
    };

    const res = new NextResponse(fileBuffer);
    res.headers.set("Content-Disposition", `attachment; filename=${videoId}.${format}`);
    res.headers.set("Content-Type", format === "mp3" ? "audio/mpeg" : "video/mp4");
    res.headers.set("X-Fake-JSON", encodeURIComponent(JSON.stringify(fakeJson)));

    return res;

  } catch (err) {
    return NextResponse.json({
      owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
      code: 500,
      msg: err.message || "Internal error",
      processed_time: (Date.now() - start) / 1000,
      data: null,
    });
  }
}
