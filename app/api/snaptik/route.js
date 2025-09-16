// app/api/snaptik/route.js
import vm from "vm";

const MAX_DEBUG = 2000;

function extractLinksFromText(hay) {
  const urlRegex =
    /(https?:\/\/[^\s"'<>]+?\.(?:mp4|m4a|webm|m3u8|mp3|mov)(?:\?[^"'<>\s]*)?)/g;
  const links = [];
  let m;
  while ((m = urlRegex.exec(hay)) !== null) {
    if (!links.includes(m[1])) links.push(m[1]);
  }
  return links;
}

function rxSingle(hay, rx, asNumber = false) {
  const m = hay.match(rx);
  if (!m) return null;
  return asNumber ? Number(m[1]) : m[1];
}

// يحاول استخراج الحقول الأساسية بواسطة regex متعددة
function buildDataFromText(hay, links) {
  const data = {
    id: rxSingle(hay, /"id"\s*:\s*"([^"]+)"/) || rxSingle(hay, /id\s*:\s*"([^"]+)"/) || null,
    region: rxSingle(hay, /"region"\s*:\s*"([^"]+)"/) || null,
    title:
      rxSingle(hay, /"title"\s*:\s*"([^"]*)"/) ||
      rxSingle(hay, /<meta property="og:title" content="([^"]*)"/i) ||
      null,
    cover:
      rxSingle(hay, /"cover"\s*:\s*"([^"]+)"/) ||
      rxSingle(hay, /"origin_cover"\s*:\s*"([^"]+)"/) ||
      rxSingle(hay, /https?:\/\/[^\s"'<>]+?(?:image|cover|avatar)[^\s"'<>]*/i) ||
      null,
    ai_dynamic_cover: rxSingle(hay, /"ai_dynamic_cover"\s*:\s*"([^"]+)"/) || null,
    origin_cover: rxSingle(hay, /"origin_cover"\s*:\s*"([^"]+)"/) || null,
    duration: rxSingle(hay, /"duration"\s*:\s*([0-9]+)/, true) || null,
    play: links[0] || null,
    wmplay: links[1] || null,
    size: rxSingle(hay, /"size"\s*:\s*([0-9]+)/, true) || null,
    wm_size: rxSingle(hay, /"wm_size"\s*:\s*([0-9]+)/, true) || null,
    music: rxSingle(hay, /"music"\s*:\s*"([^"]+)"/) || null,
    music_info: null,
    play_count: rxSingle(hay, /"play_count"\s*:\s*([0-9]+)/, true) || null,
    digg_count: rxSingle(hay, /"digg_count"\s*:\s*([0-9]+)/, true) || null,
    comment_count: rxSingle(hay, /"comment_count"\s*:\s*([0-9]+)/, true) || null,
    share_count: rxSingle(hay, /"share_count"\s*:\s*([0-9]+)/, true) || null,
    download_count: rxSingle(hay, /"download_count"\s*:\s*([0-9]+)/, true) || null,
    collect_count: rxSingle(hay, /"collect_count"\s*:\s*([0-9]+)/, true) || null,
    create_time: rxSingle(hay, /"create_time"\s*:\s*([0-9]+)/, true) || null,
    anchors: null,
    anchors_extras: "",
    is_ad: /"is_ad"\s*:\s*true/.test(hay) || false,
    commerce_info: {
      adv_promotable: false,
      auction_ad_invited: false,
      branded_content_type: 0,
      organic_log_extra: null,
      with_comment_filter_words: false
    },
    commercial_video_info: "",
    item_comment_settings: rxSingle(hay, /"item_comment_settings"\s*:\s*([0-9]+)/, true) || 0,
    mentioned_users: "",
    author: {
      id: rxSingle(hay, /"author"\s*:\s*\{\s*"id"\s*:\s*"([^"]+)"/) ||
         rxSingle(hay, /"authorId"\s*:\s*"([^"]+)"/) || null,
      unique_id:
        rxSingle(hay, /"unique_id"\s*:\s*"([^"]+)"/) ||
        rxSingle(hay, /"uniqueId"\s*:\s*"([^"]+)"/) ||
        null,
      nickname:
        rxSingle(hay, /"nickname"\s*:\s*"([^"]*)"/) || rxSingle(hay, /<meta name="author" content="([^"]*)"/i) || null,
      avatar:
        rxSingle(hay, /"avatar"\s*:\s*"([^"]+)"/) ||
        rxSingle(hay, /https?:\/\/[^\s"'<>]+?(?:avatar|avt|profile)[^\s"'<>]*/i) ||
        null
    }
  };

  // حاول بناء music_info إن وجد
  const musicInfoTitle = rxSingle(hay, /"music_info"\s*:\s*\{[^}]*"title"\s*:\s*"([^"]+)"/);
  if (musicInfoTitle) {
    data.music_info = {
      id: rxSingle(hay, /"music_info"\s*:\s*\{[^}]*"id"\s*:\s*"([^"]+)"/) || null,
      title: musicInfoTitle || null,
      play: rxSingle(hay, /"music_info"\s*:\s*\{[^}]*"play"\s*:\s*"([^"]+)"/) || null,
      cover: rxSingle(hay, /"music_info"\s*:\s*\{[^}]*"cover"\s*:\s*"([^"]+)"/) || null,
      author: rxSingle(hay, /"music_info"\s*:\s*\{[^}]*"author"\s*:\s*"([^"]+)"/) || null,
      original: /"music_info"\s*:\s*\{[^}]*"original"\s*:\s*true/.test(hay) || false,
      duration: rxSingle(hay, /"music_info"\s*:\s*\{[^}]*"duration"\s*:\s*([0-9]+)/, true) || null,
      album: rxSingle(hay, /"music_info"\s*:\s*\{[^}]*"album"\s*:\s*"([^"]+)"/) || null
    };
  }

  return data;
}

export async function GET(req) {
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    if (!url) {
      return Response.json({ code: 400, msg: "missing url", processed_time: 0, data: {} }, { status: 400 });
    }

    // body المستخدم من قبل
    const body = `------WebKitFormBoundaryJS7G2eJPBusA2onQ
Content-Disposition: form-data; name="url"

${url}
------WebKitFormBoundaryJS7G2eJPBusA2onQ
Content-Disposition: form-data; name="lang"

ar2
------WebKitFormBoundaryJS7G2eJPBusA2onQ
Content-Disposition: form-data; name="token"

eyMTc1NzkxNjA1Nw==c
------WebKitFormBoundaryJS7G2eJPBusA2onQ--`;

    const resp = await fetch("https://snaptik.app/abc2.php", {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data; boundary=----WebKitFormBoundaryJS7G2eJPBusA2onQ",
        "User-Agent": "Mozilla/5.0",
        Referer: "https://snaptik.app/ar2"
      },
      body
    });

    const text = await resp.text();

    // محاولة خاصة للتعامل مع الحالات اللي فيها eval(f) أو eval(...) كما في أمثلتك
    let unpacked = null;
    try {
      const evalFRegex = /eval\s*\(\s*f\s*\)/;
      if (evalFRegex.test(text)) {
        const wrapped = `(function(){\n${text.replace(evalFRegex, "return f")}\n})()`;
        const sandbox = Object.create(null);
        const script = new vm.Script(wrapped);
        const context = vm.createContext(sandbox);
        const result = script.runInContext(context, { timeout: 2000 });
        if (typeof result === "string") unpacked = result;
        else if (result && typeof result.toString === "function") unpacked = String(result);
      } else {
        // محاولة تعميمية أكثر: إذا الكود ينتهي بـ eval(...) نرجع الوسيط
        const genericEvalRegex = /eval\s*\(\s*([^\)]+)\s*\)\s*;?\s*$/m;
        const match = text.match(genericEvalRegex);
        if (match && match[1]) {
          const argExpr = match[1];
          const wrapped2 = `(function(){\n${text.replace(genericEvalRegex, `return ${argExpr}`)}\n})()`;
          const sandbox2 = Object.create(null);
          const script2 = new vm.Script(wrapped2);
          const context2 = vm.createContext(sandbox2);
          const res2 = script2.runInContext(context2, { timeout: 2000 });
          if (typeof res2 === "string") unpacked = res2;
          else if (res2 && typeof res2.toString === "function") unpacked = String(res2);
        }
      }
    } catch {
      // تجاهل أخطاء فكّ الشيفرة
    }

    const hay = unpacked || text;
    const links = extractLinksFromText(hay);
    const data = buildDataFromText(hay, links);

    // لو ما لاقيناش id نحاول استنتاجه من روابط play أو من url المرسل
    if (!data.id) {
      if (links[0]) {
        const idFromPlay = links[0].match(/\/(\d{6,})\//);
        if (idFromPlay) data.id = idFromPlay[1];
      }
      if (!data.id) {
        try {
          const u = new URL(url);
          const p = u.pathname.split("/").filter(Boolean);
          const last = p[p.length - 1];
          if (/\d{6,}/.test(last)) data.id = last;
        } catch {
          /* ignore */
        }
      }
    }

    // fill commerce_info organic_log_extra if possible
    if (data.commerce_info && !data.commerce_info.organic_log_extra) {
      const olog = rxSingle(hay, /"organic_log_extra"\s*:\s*"([^"]+)"/) || rxSingle(hay, /"organic_log_extra"\s*:\s*({[^}]+})/);
      if (olog) data.commerce_info.organic_log_extra = olog;
    }

    // ensure author object exists
    if (!data.author) {
      data.author = { id: null, unique_id: null, nickname: null, avatar: null };
    }

    const processed_time = Number(((Date.now() - startTime) / 1000).toFixed(4));

    return Response.json({
      code: 0,
      msg: "success",
      processed_time,
      data
    });
  } catch (err) {
    const processed_time = Number(((Date.now() - startTime) / 1000).toFixed(4));
    return Response.json({
      code: -1,
      msg: String(err),
      processed_time,
      data: {}
    }, { status: 500 });
  }
}
