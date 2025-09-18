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
    // لو ID مباشر
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    // watch?v=
    const ytMatch = input.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (ytMatch) return ytMatch[1];
    // youtu.be/
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
      return NextResponse.json(
        {
          owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
          code: 400,
          msg: "يرجى ادخال رابط او ID للفيديو",
          processed_time: (Date.now() - start) / 1000,
          data: null,
        },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(input);
    if (!videoId) {
      return NextResponse.json(
        {
          owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
          code: 404,
          msg: "تعذر استخراج videoId من الادخال",
          processed_time: (Date.now() - start) / 1000,
          data: null,
        },
        { status: 404 }
      );
    }

    // بناء رابط مثل الـ curl اللي بعته (مع الـ sig وباراميتر v وf)
    const remoteUrl = `https://nuun.mnuu.nu/api/v1/download?sig=MenPTpoN%2Br%2FJhPWHJaqZw%2B%2BZgWFeE7bN%2FyENRTlREOSs4EUkG1tFQgxYbnRfXU%2FIK9xA0Wqgj5tWcVjhX2AcIobwQ5JUNVPqUZw9kaZY%2FrvUl%2FWbB01TD%2BhC4IMd3nRxr%2F%2B8fP9qEHcJwoHzsN309C7ukVhrphKF29AmOmUI7p4C6oaNN5%2FBAz%2FaPNR69F9pafi5qe1CL1FlEWr9LEGcwmBDOgRefVMJqeoyi7mHCta9jQVLHt%2FU%2FgxdmcHwmOvqlPtMEkWPz6kk6F3%2BuBNQdi6HLD952rKiPwJ5JkOCJxCTrUZ%2FoUfuha5vgFLw9mI7Vu8ZjgM%2BDRsRE7aPpjUO2g%3D%3D&s=3&v=${videoId}&f=${encodeURIComponent(
      format
    )}`;

    // نطلب الـ remote endpoint بنفس الـ headers اللي استخدمتهم في الـ curl
    const resp = await fetch(remoteUrl, {
      method: "GET",
      headers: {
        Host: "nuun.mnuu.nu",
        Connection: "keep-alive",
        "sec-ch-ua": '"Not;A=Brand";v="99", "Android WebView";v="139", "Chromium";v="139"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "Upgrade-Insecure-Requests": "1",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 12; M2007J20CG Build/SKQ1.211019.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.160 Mobile Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "X-Requested-With": "mark.via.gp",
        Referer: "https://y2mate.nu/",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "ar,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      redirect: "follow",
    });

    // اذا الريموت رجع redirect لملف مباشر، resp.url غالبا بيكون الملف النهائي
    const contentType = resp.headers.get("content-type") || "";
    let finalLink = resp.url;

    // لو الاستجابة HTML، نحاول نفك اللينك من الصفحة زي ما عملنا في تiktok example
    if (contentType.includes("html")) {
      const html = await resp.text();
      const $ = cheerio.load(html);

      // حاول نلاقي لينكات تنتهي بصيغ mp3/mp4 أو أي زر تحميل شائع
      const selectors = [
        'a[href$=".mp3"]',
        'a[href$=".mp4"]',
        'a.download',
        'a#download',
        'a.btn',
        'a[href*="/download"]',
        'a[href*="R2lu"]', // حسب المثال اللي رجعلك
      ];

      let found = null;
      for (const sel of selectors) {
        const el = $(sel).first();
        if (el && el.attr && el.attr("href")) {
          found = el.attr("href");
          break;
        }
      }

      // لو لاقينا href نضبطه ليصبح رابط كامل لو كان نسبي
      if (found) {
        try {
          const parsed = new URL(found, resp.url);
          finalLink = parsed.href;
        } catch {
          finalLink = found;
        }
      } else {
        // محاولة بحث عام عن أي رابط يحتوي على mp3/mp4 داخل الـ HTML
        const hrefMatch = html.match(/https?:\/\/[^\s'"]+\.(mp3|mp4)(\?[^\s'"]*)?/i);
        if (hrefMatch) finalLink = hrefMatch[0];
      }
    } else {
      // غير HTML — قد يكون ملف مباشر (audio/video) أو redirect لواحد
      // finalLink خليناه resp.url فوق
    }

    // لو ما لقيناش شيء صالح، أرجع 404
    if (!finalLink) {
      return NextResponse.json(
        {
          owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
          code: 404,
          msg: "No download link found",
          processed_time: (Date.now() - start) / 1000,
          data: null,
        },
        { status: 404 }
      );
    }

    // ارجع JSON بنفس شكل تيك توك example (link قد يكون رابط مؤقت أو مباشر)
    return NextResponse.json({
      owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
      code: 1,
      msg: "success",
      processed_time: (Date.now() - start) / 1000,
      data: {
        videoId,
        format,
        link: finalLink,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
        code: 500,
        msg: err.message || "Internal error",
        processed_time: (Date.now() - start) / 1000,
        data: null,
      },
      { status: 500 }
    );
  }
}
