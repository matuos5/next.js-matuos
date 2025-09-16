// app/api/snaptik/route.js
/* eslint-disable no-console */
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

    const unpacked = tryUnpackPackedEval(raw);

    const sourceForParse = unpacked || raw;
    const data = extractDataFromText(sourceForParse);

    return jsonResponse(0, "success", data, start, { raw: String(raw).slice(0, 20000) });
  } catch (_err) {
    console.error("Unhandled error in GET:", _err);
    return jsonResponse(-1, String(_err?.message || _err), {}, start);
  }
}

async function postToSnaptik(videoUrl) {
  const form = new URLSearchParams();
  form.append("url", videoUrl);

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
 * Try to unpack `eval(function(...` packed JS by replacing first eval( with var __decoded = (
 * then run in a sandboxed vm. If fails, return null.
 */
function tryUnpackPackedEval(text) {
  try {
    const str = String(text);
    if (!str.includes("eval(function(") && !str.includes("eval (function(")) {
      return null;
    }

    const replaced = str.replace(/eval\s*\(/, "var __decoded = (");

    const sandbox = {
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
    };

    vm.createContext(sandbox);
    vm.runInContext(replaced, sandbox, { timeout: 2000 });
    const decoded = sandbox.__decoded;
    if (!decoded) return null;
    return String(decoded);
  } catch (_err) {
    // لا ترجع خطأ هنا — سنستخدم الـ raw لاحقًا
    console.error("unpack error:", _err);
    return null;
  }
}

/**
 * استخراج روابط وحقول من النص (المفكوك أو raw)
 */
function extractDataFromText(txt) {
  const text = String(txt);

  const mp4Regex = /https?:\/\/[^\s"']+\.mp4[^\s"']*/g;
  const mp4Matches = uniqueMatches(text.match(mp4Regex) || []);

  const imgRegex = /https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp|gif)[^\s"']*/g;
  const imgMatches = uniqueMatches(text.match(imgRegex) || []);

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

  let author = { id: null, unique_id: null, nickname: null, avatar: null };
  try {
    const authorRe = /"author"\s*:\s*(\{[^}]+\})/i;
    const am = text.match(authorRe);
    if (am) {
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
      const nick = text.match(/"nickname"\s*:\s*"([^"]+)"/);
      const av = text.match(/"avatar"\s*:\s*"([^"]+)"/);
      if (nick) author.nickname = nick[1];
      if (av) author.avatar = av[1];
    }
  } catch (_err2) {
    console.error("author parse error:", _err2);
  }

  const wmPlay = mp4Matches.find((u) => /wm|watermark|wmplay/i.test(u)) || null;
  const play = mp4Matches.find((u) => !/wm|watermark|wmplay/i.test(u)) || mp4Matches[0] || null;
  const cover = imgMatches[0] || null;
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
    commerce_info: {
      adv_promotable: false,
      auction_ad_invited: false,
      branded_content_type: 0,
      organic_log_extra: null,
      with_comment_filter_words: false,
    },
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

function tryParseJsonLoose(str) {
  try {
    return JSON.parse(str);
  } catch (_err3) {
    const s2 = str.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');
    try {
      return JSON.parse(s2);
    } catch (_err4) {
      return null;
    }
  }
}

function jsonResponse(code, msg, data, startTime, extra = {}) {
  const processed_time = Number(((Date.now() - startTime) / 1000).toFixed(4));
  const body = { code, msg, processed_time, data, ...extra };
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}
