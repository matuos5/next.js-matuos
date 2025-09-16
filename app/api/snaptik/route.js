// app/api/snaptik/route.js
import { URLSearchParams } from "url";
import vm from "vm";

export async function GET(req) {
  const start = Date.now();
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get("url");
    if (!targetUrl) {
      return jsonResponse(400, "missing url", {}, start);
    }

    const raw = await postToSnaptik(targetUrl);

    // حاول نفك الـ packed JS لو فيه eval(function(...)
    const unpacked = tryUnpackPackedEval(raw);

    // الآن استخرج الروابط من النص المفكوك (أو من raw لو unpacked فشل)
    const sourceForParse = unpacked || raw;
    const data = extractDataFromText(sourceForParse);

    return jsonResponse(0, "success", data, start, { raw: String(raw).slice(0, 20000) });
  } catch (err) {
    return jsonResponse(-1, String(err), {}, start);
  }
}

async function postToSnaptik(videoUrl) {
  const form = new URLSearchParams();
  form.append("url", videoUrl);
  // خيار: لو واجهت مشاكل مع application/x-www-form-urlencoded
  // ممكن تغيّر الـ content-type إلى multipart/form-data وتبني boundary يدوياً.
  const res = await fetch("https://snaptik.app/abc2.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36",
      Origin: "https://snaptik.app",
      Referer: "https://snaptik.app/",
      Accept: "*/*",
    },
    body: form.toString(),
  });

  if (!res.ok) {
    throw new Error(`snaptik responded ${res.status}`);
  }
  return await res.text();
}

/**
 * يحاول يفك نصّ ملف JS الذي يستعمل صيغة eval(function(...)(...))
 * الفكرة: نغير أول occurrence من "eval(" إلى "var __decoded = (" ثم نشغّل داخل vm sandbox
 * ونستعيد __decoded. لو فشل نعيد null.
 */
function tryUnpackPackedEval(text) {
  try {
    const str = String(text);
    if (!str.includes("eval(function(") && !str.includes("eval (function(")) {
      return null;
    }

    // استبدل أول eval( ب var __decoded = (
    // نستخدم replace بمطابقة أول ظهور فقط
    const replaced = str.replace(/eval\s*\(/, "var __decoded = (");

    // ننفّذ داخل sandbox محدود جدا
    const sandbox = {
      // بعض الدوال/متغيرات التي قد يحتاجها السكربت عند فك الشيفرة
      decodeURIComponent,
      escape,
      unescape,
      String,
      Math,
      Array,
      Object,
      RegExp,
      Date,
      Number,
      Boolean,
      // لتجنب استخدام أي متغيّر خارجي نترك globalThis فارغاً
    };

    // اجعل sandbox قابل للكتابة ثم نفّذ
    vm.createContext(sandbox);
    // نفّذ الكود. قد يعود __decoded كسلسلة HTML/JS مفكوك
    vm.runInContext(replaced, sandbox, { timeout: 2000 });
    // __decoded ممكن تكون في sandbox
    const decoded = sandbox.__decoded;
    if (!decoded) return null;

    // __decoded قد يكون سلسلة مع بعض التعبيرات الغريبة؛ نعيده كنص
    return String(decoded);
  } catch (e) {
    // لو فشل فكّ الشيفرة نرجع null (المعالجة ستستخدم raw لاحقًا)
    return null;
  }
}

/**
 * استخراج روابط / بيانات من نص مفكوك أو raw
 *
 * يعثر على:
 * - روابط .mp4 (قد تكون play links أو wmplay)
 * - صور (jpg/png/...) التي تبدو كـ cover
 * - play_count, digg_count ... إن وُجدت كأرقام بجوار الكلمات
 * - مؤلف الفيديو (nickname/avatar) إن كانت موجودة كـ JSON داخل النص
 */
function extractDataFromText(txt) {
  const text = String(txt);

  // اجمع روابط فيديو mp4 (قد تتكرر بصيغ مختلفة)
  const mp4Regex = /https?:\/\/[^\s"']+\.mp4[^\s"']*/g;
  const mp4Matches = uniqueMatches(text.match(mp4Regex) || []);

  // صور الغلاف
  const imgRegex = /https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp|gif)[^\s"']*/g;
  const imgMatches = uniqueMatches(text.match(imgRegex) || []);

  // حاول استخراج بعض الحقول الرقمية المعروفة
  const getNumber = (key) => {
    const re = new RegExp(`"${key}"\\s*[:=]\\s*(\\d+)`, "i");
    const m = text.match(re);
    return m ? Number(m[1]) : null;
  };

  const play_count = getNumber("play_count") ?? getNumber("playcount") ?? null;
  const digg_count = getNumber("digg_count") ?? getNumber("likes") ?? null;
  const comment_count = getNumber("comment_count") ?? null;
  const share_count = getNumber("share_count") ?? null;
  const download_count = getNumber("download_count") ?? null;
  const create_time = getNumber("create_time") ?? null;

  // حاول إيجاد JSON-like author object إن وُجد
  let author = { id: null, unique_id: null, nickname: null, avatar: null };
  try {
    // بعض الردود تحتوي على JSON داخل النص. نحاول إيجاد أول كائن "author":{...}
    const authorRe = /"author"\s*:\s*(\{[^}]+\})/i;
    const am = text.match(authorRe);
    if (am) {
      // تنظيف بسيط ثم JSON.parse إن أمكن
      const candidate = am[1].replace(/(\r|\n)/g, " ");
      const parsed = tryParseJsonLoose(candidate);
      if (parsed && typeof parsed === "object") {
        author = {
          id: parsed.id ?? null,
          unique_id: parsed.unique_id ?? parsed.uniqueId ?? null,
          nickname: parsed.nickname ?? parsed.name ?? null,
          avatar: parsed.avatar ?? parsed.avatar_url ?? parsed.avatarUrl ?? null,
        };
      }
    } else {
      // بديل: البحث عن nickname/avatar كنمط بسيط
      const nick = text.match(/"nickname"\s*:\s*"([^"]+)"/);
      const av = text.match(/"avatar"\s*:\s*"([^"]+)"/);
      if (nick) author.nickname = nick[1];
      if (av) author.avatar = av[1];
    }
  } catch (e) {
    // تجاهل أي خطأ أثناء محاولة parse
  }

  // لهيكلة البيانات نضع أول رابط mp4 كـ play، وأي رابط فيه 'wm' أو 'watermark' كـ wmplay إن وُجد
  const wmPlay = mp4Matches.find((u) => /wm|watermark|wmplay/i.test(u)) || null;
  const play = mp4Matches.find((u) => !/wm|watermark|wmplay/i.test(u)) || mp4Matches[0] || null;
  const cover = imgMatches[0] || null;

  // حاول استخراج title إن وُجد
  const titleMatch = text.match(/"title"\s*:\s*"([^"]{1,200})"/);
  const title = titleMatch ? titleMatch[1] : null;

  return {
    id: null,
    region: null,
    title,
    cover,
    ai_dynamic_cover: null,
    origin_cover: cover,
    duration: null,
    play,
    wmplay: wmPlay,
    size: null,
    wm_size: null,
    music: null,
    music_info: null,
    play_count,
    digg_count,
    comment_count,
    share_count,
    download_count,
    collect_count: null,
    create_time,
    anchors: null,
    anchors_extras: "",
    is_ad: false,
    commerce_info: { adv_promotable: false, auction_ad_invited: false, branded_content_type: 0, organic_log_extra: null, with_comment_filter_words: false },
    commercial_video_info: "",
    item_comment_settings: 0,
    mentioned_users: "",
    author,
    links: mp4Matches,
    images: imgMatches,
  };
}

function uniqueMatches(arr) {
  const seen = new Set();
  const out = [];
  for (const s of arr) {
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

/** يحاول تحويل JSON-like string إلى object بمرونة */
function tryParseJsonLoose(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    // جرب تحويل علامات الاقتباس المفردة ثم parse
    const s2 = str.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');
    try {
      return JSON.parse(s2);
    } catch (e2) {
      return null;
    }
  }
}

function jsonResponse(code, msg, data, startTime, extra = {}) {
  const processed_time = Number(((Date.now() - startTime) / 1000).toFixed(4));
  const body = { code, msg, processed_time, data, ...extra };
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}
