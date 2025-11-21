import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

/**
 * GET /api/mangatime3?manga=Boruto-Naruto-Next-Generation&chapter=80
 *
 * يجلب صفحات الشابتر (روابط الصور) من مانجا تايم
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const manga = searchParams.get("manga");      // مثال: Boruto-Naruto-Next-Generation
    const chapterParam = searchParams.get("chapter"); // مثال: 80

    // تحقّق من الباراميترات
    if (!manga || !chapterParam) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى إضافة باراميترات manga و chapter مثل: ?manga=Boruto-Naruto-Next-Generation&chapter=80",
        },
        { status: 400 }
      );
    }

    const chapterNumber = Number(chapterParam);
    if (Number.isNaN(chapterNumber)) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "قيمة chapter يجب أن تكون رقم صحيح",
        },
        { status: 400 }
      );
    }

    // نفس رابط السكربت الأصلي
    const url = `https://mangatime.org/manga/${manga}/chapter-${chapterNumber}/`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "sec-ch-ua": '"Chromium";v="139", "Not;A=Brand";v="99"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "upgrade-insecure-requests": "1",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "navigate",
        "sec-fetch-user": "?1",
        "sec-fetch-dest": "document",
        "accept-language":
          "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: response.status,
          msg: "فشل الاتصال بموقع مانجا تايم أو أن الشابتر غير موجود",
        },
        { status: 500 }
      );
    }

    const html = await response.text();

    // نستخدم cheerio فقط لو حاب نقرأ العنوان
    const $ = cheerio.load(html);
    const h4Texts = $("h4")
      .map((_, el) => $(el).text().trim())
      .get();
    const pageTitle =
      h4Texts[1] || h4Texts[0] || `Chapter ${chapterNumber}`;

    // نقرأ بيانات الشابترات من سكربت addChapterToListDropdrog({...})
    const chaptersData = [];
    const regex = /addChapterToListDropdrog\(\s*(\{[\s\S]*?\})\s*\);/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
      try {
        const jsonText = match[1];
        const chapterObj = JSON.parse(jsonText);
        chaptersData.push(chapterObj);
      } catch {
        // لو واحد خربان نتجاهله
        continue;
      }
    }

    if (!chaptersData.length) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على بيانات الشابترات في الصفحة (addChapterToListDropdrog)",
        },
        { status: 404 }
      );
    }

    // نختار الشابتر المطلوب حسب order (اللي هو رقم الشابتر)
    const targetChapter = chaptersData.find(
      (ch) => Number(ch.order) === chapterNumber
    );

    if (!targetChapter) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: `تم العثور على بيانات شابترات، لكن لم أجد الشابتر رقم ${chapterNumber}`,
        },
        { status: 404 }
      );
    }

    const pages = Array.isArray(targetChapter.pages)
      ? targetChapter.pages
      : [];

    if (!pages.length) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "تم العثور على الشابتر ولكن بدون أي صفحات (مصفوفة pages فارغة)",
        },
        { status: 404 }
      );
    }

    // بناء روابط الصور
    const images = pages
      .map((p) => {
        if (typeof p !== "string") return null;
        if (p.startsWith("http://") || p.startsWith("https://")) return p;
        return `https://mangatime.org/get_image/${p}`;
      })
      .filter(Boolean);

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: {
        manga,
        chapter: chapterNumber,
        title: pageTitle,
        chapterId: targetChapter.chapter_id ?? null,
        pagesCount: pages.length,
        rawPages: pages,
        images,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "حدث خطأ داخلي أثناء معالجة الطلب",
        error: err?.message,
      },
      { status: 500 }
    );
  }
          }
