// app/api/meme/route.js
import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";
import { promises as fs } from "fs";
import path from "path";

const OWNER = "MATUOS-3MK";
const SITE_BASE = "https://arabmeems.com";
const SENT_FILE = path.join(process.cwd(), "sent.json");

// قراءة الملف الذي يحفظ المنشورات المرسلة
async function readSent() {
  try {
    const txt = await fs.readFile(SENT_FILE, "utf8");
    return JSON.parse(txt);
  } catch (err) {
    // إذا لم يكن الملف موجودًا أو يوجد خطأ في القراءة، نعيد هيكل افتراضي
    return { sentPosts: [] };
  }
}

// كتابة الحالة المحدثة إلى الملف
async function writeSent(obj) {
  try {
    await fs.writeFile(SENT_FILE, JSON.stringify(obj, null, 2), "utf8");
    return true;
  } catch (err) {
    // لا نفشل التنفيذ بسبب فشل الكتابة، لكن نُبلغ اللوغز
    console.error("writeSent error:", err);
    return false;
  }
}

// جلب قائمة روابط المنشورات من الصفحة الرئيسية (أو أرشيف)
async function fetchPostList() {
  const resp = await axios.get(SITE_BASE, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MatuosBot/1.0)" },
    timeout: 10000,
  });

  const $ = cheerio.load(resp.data);
  const links = new Set();

  // نجمع روابط تبدو كمنشورات (نمط بسيط يعتمد على وجود سنة في الرابط)
  $("article a, .post a, a").each((i, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if ((href.startsWith(SITE_BASE) || href.startsWith("/")) && /\/20\d{2}\//.test(href)) {
      const full = href.startsWith("http") ? href : `${SITE_BASE}${href.startsWith("/") ? "" : "/"}${href}`;
      links.add(full.split("#")[0].split("?")[0]);
    }
  });

  return Array.from(links);
}

// جلب رابط صورة من بوست محدد
async function fetchImageFromPost(postUrl) {
  const resp = await axios.get(postUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MatuosBot/1.0)" },
    timeout: 10000,
  });
  const $ = cheerio.load(resp.data);

  const selectors = [
    ".entry-content img",
    ".post-content img",
    ".wp-block-image img",
    "article img",
    "img"
  ];

  for (const sel of selectors) {
    const imgs = $(sel);
    for (let i = 0; i < imgs.length; i++) {
      const el = imgs[i];
      const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src");
      if (!src) continue;
      // نقبل صور مرفوعة أو أي رابط HTTP صالح
      if (/wp-content\/uploads|uploads/.test(src) || src.startsWith("http")) {
        const full = src.startsWith("http") ? src : `${SITE_BASE}${src.startsWith("/") ? "" : "/"}${src}`;
        return full;
      }
    }
  }

  return null;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const to = searchParams.get("to"); // نحتفظ بالمعلمة لكن الكود لا يرسل واتساب (تركت المعلمة للمطابقة مع واجهة الطلب)

    if (!to) {
      return NextResponse.json({
        owner: OWNER,
        code: 400,
        msg: "يرجى إضافة رقم المستلم كـ query param 'to' بصيغة whatsapp:+COUNTRYNUMBER",
      }, { status: 400 });
    }

    // جلب قائمة المنشورات
    const posts = await fetchPostList();
    if (!posts || posts.length === 0) {
      return NextResponse.json({
        owner: OWNER,
        code: 500,
        msg: "لم يتم العثور على منشورات في الموقع",
      }, { status: 500 });
    }

    // قراءة سجل المرسلات
    const sent = await readSent();
    const sentSet = new Set(sent.sentPosts || []);

    // خلط القائمة
    for (let i = posts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [posts[i], posts[j]] = [posts[j], posts[i]];
    }

    // اختيار أول منشور لم يُرسل من قبل مع صورة
    let selectedPost = null;
    let selectedImage = null;

    for (const p of posts) {
      if (sentSet.has(p)) continue;
      try {
        const img = await fetchImageFromPost(p);
        if (img) {
          selectedPost = p;
          selectedImage = img;
          break;
        }
      } catch (err) {
        // لو فشل تحميل بوست نتجاهله (نسجل الخطأ للديباغ فقط)
        console.error("failed to fetch post", p, err);
        continue;
      }
    }

    if (!selectedPost || !selectedImage) {
      return NextResponse.json({
        owner: OWNER,
        code: 404,
        msg: "انتهت الميمز الجديدة أو تعذر إيجاد ميمز غير مُرسلة. حاول لاحقاً.",
      }, { status: 404 });
    }

    // سجل أننا أرسلنا هذا المنشور (حفظ محلي بسيط)
    sent.sentPosts = sent.sentPosts || [];
    sent.sentPosts.push(selectedPost);
    // حافظ على حد للملف
    if (sent.sentPosts.length > 1000) sent.sentPosts = sent.sentPosts.slice(-1000);
    await writeSent(sent);

    // أعد النتيجة (الخطوة التي سترسل منها الصورة عبر واتساب تتم خارج هذا الكود)
    return NextResponse.json({
      owner: OWNER,
      code: 200,
      msg: "تم اختيار ميمز عشوائي بنجاح",
      post: selectedPost,
      image: selectedImage
    }, { status: 200 });

  } catch (err) {
    console.error("GET /api/meme error:", err);
    return NextResponse.json({
      owner: OWNER,
      code: 500,
      msg: "حدث خطأ أثناء العملية",
      error: err.message || String(err)
    }, { status: 500 });
  }
    }t img = null;
  const selectors = [
    ".entry-content img",
    ".post-content img",
    "article img",
    ".wp-block-image img",
    "img"
  ];

  for (const sel of selectors) {
    const imgs = $(sel);
    for (let i = 0; i < imgs.length; i++) {
      const src = $(imgs[i]).attr("src") || $(imgs[i]).attr("data-src");
      if (!src) continue;
      // أفضل أن نأخذ صور الرفع الخاص بالووردبريس أو صور كبيرة
      if (/wp-content\/uploads|uploads/.test(src) || src.startsWith("http")) {
        img = src.startsWith("http") ? src : `${SITE_BASE}${src.startsWith("/") ? "" : "/"}${src}`;
        // إرجاع بمجرد إيجاد صورة مناسبة
        return img;
      }
    }
  }
  return null;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const to = searchParams.get("to"); // يجب أن يكون بصيغة whatsapp:+XXXXXXXXX
    const source = searchParams.get("source") || SITE_BASE; // اختياري: مصدر الموقع
    // اختبار تواجد رقم المستلم
    if (!to) {
      return NextResponse.json(
        { owner: OWNER, code: 400, msg: "يرجى إضافة رقم المستلم كـ query param 'to' بصيغة whatsapp:+COUNTRYNUMBER" },
        { status: 400 }
      );
    }

    // 1. جلب قائمة المنشورات من الصفحة (أو من مصدر محدد)
    const posts = await fetchPostList();

    if (!posts || posts.length === 0) {
      return NextResponse.json({ owner: OWNER, code: 500, msg: "لم يتم العثور على منشورات في الموقع" }, { status: 500 });
    }

    // 2. قراءة ما تم إرساله سابقًا
    const sent = await readSent();
    const sentSet = new Set(sent.sentPosts || []);

    // 3. خلط القائمة واختيار أول منشور لم يُرسل من قبل
    // ش shuffle بسيط
    for (let i = posts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [posts[i], posts[j]] = [posts[j], posts[i]];
    }

    let selectedPost = null;
    let selectedImage = null;

    for (const p of posts) {
      if (sentSet.has(p)) continue; // تخطي إذا أرسلنا رابط البوست سابقاً
      try {
        const img = await fetchImageFromPost(p);
        if (img) {
          selectedPost = p;
          selectedImage = img;
          break;
        } else {
          // لو مافي صورة نتجاهل البوست
          continue;
        }
      } catch (e) {
        // لو فشل تحميل البوست، تجاهله واستمر
        continue;
      }
    }

    // إذا لم نجد أي منشور جديد، نعيد رسالة مناسبة
    if (!selectedPost || !selectedImage) {
      return NextResponse.json(
        { owner: OWNER, code: 404, msg: "انتهت الميمز الجديدة أو تعذر إيجاد ميمز غير مُرسلة. حاول لاحقاً." },
        { status: 404 }
      );
    }

    // 4. رد النجاح
    return NextResponse.json({
      owner: OWNER,
      code: 200,
      msg: "تم اختيار ميمز عشوائي بنجاح",
      post: selectedPost,
      image: selectedImage,
    });
  } catch (error) {
    console.error("Error send-random-meme:", error);
    return NextResponse.json(
      { owner: OWNER, code: 500, msg: "حدث خطأ أثناء العملية", error: (error && error.message) || String(error) },
      { status: 500 }
    );
  }
  }
