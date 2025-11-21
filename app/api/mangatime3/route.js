import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

/**
 * GET /api/mangatime3?manga=Boruto-Naruto-Next-Generation&chapter=80
 *
 * يستخرج صفحات شابتر معيّن (كروابط صور جاهزة للعرض)
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const manga = searchParams.get("manga");    // مثال: Boruto-Naruto-Next-Generation
    const chapterParam = searchParams.get("chapter"); // مثال: 80

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

    // نفس رابط السكربت الذي استخدمته بالضبط
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
        "accept-language": "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: response.status,
          msg: "فشل الاتصال بموقع مانجا تايم أو الشابتر غير موجود",
        },
        { status: 500 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 1) استخراج اسم المانجا/العنوان إن وُجد (للمعلومة فقط)
    const pageTitle =
      $("h4")
        .first()
        .text()
        .trim() || `Chapter ${chapterNumber}`;

    // 2) استخراج بيانات الشابترات من استدعاءات addChapterToListDropdrog(...)
    const chaptersData = [];
    const regex = /addChapterToListDropdrog\((\{[\s\S]*?\})\);/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
      try {
        // النص بين القوسين هو كائن JSON صالح (مفاتيح وسلاسل محاطة بعلامات تنصيص مزدوجة)
        const jsonText = match[1];
        const chapterObj = JSON.parse(jsonText);
        chaptersData.push(chapterObj);
      } catch {
        // لو واحد منهم فشل في الـ JSON.parse نتجاهله ونكمل
        continue;
      }
    }

    if (!chaptersData.length) {
      // هذه هي المشكلة التي كنت تراها: لا توجد نتائج، لأننا سابقاً كنا نبحث عن <img> بدل السكربت
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على بيانات الشابترات في الصفحة (addChapterToListDropdrog)",
        },
        { status: 404 }
      );
    }

    // 3) البحث عن الشابتر المطلوب حسب رقم order
    const targetChapter = chaptersData.find(
      (ch) => Number(ch.order) === chapterNumber
    );

    if (!targetChapter) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: `لم يتم العثور على بيانات الشابتر رقم ${chapterNumber} في هذه الصفحة`,
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
          msg: "تم العثور على الشابتر ولكن بدون أي صفحات",
        },
        { status: 404 }
      );
    }

    // 4) بناء روابط الصور النهائية
    const images = pages.map((p) => {
      // لو القيمة أصلاً رابط كامل نستخدمها كما هي، غير ذلك نركّبها على /get_image/
      if (typeof p !== "string") return null;
      if (p.startsWith("http://") || p.startsWith("https://")) return p;
      return `https://mangatime.org/get_image/${p}`;
    }).filter(Boolean);

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
        rawPages: pages,    // IDs الأصلية مثل f_xxx في حال احتجتها لاحقاً
        images,             // روابط الصور الجاهزة للعرض
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
      }        "sec-fetch-user": "?1",
        "sec-fetch-dest": "document",
        "accept-language":
          "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 500,
          msg: "فشل الاتصال بموقع مانجا تايم",
        },
        { status: 500 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const images = [];

    // نمط الصور الأول (data-src)
    $("img").each((_, el) => {
      const ds = $(el).attr("data-src");
      const src = $(el).attr("src");

      const img = ds || src;

      if (img && img.includes("/get_image/")) {
        images.push(img.startsWith("http") ? img : `https://mangatime.org${img}`);
      }
    });

    if (!images.length) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على صور الفصل",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: {
        manga,
        chapter,
        totalImages: images.length,
        images,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "حدث خطأ داخلي",
        error: err.message,
      },
      { status: 500 }
    );
  }
        } 
