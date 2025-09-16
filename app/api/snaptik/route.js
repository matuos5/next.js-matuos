// app/api/snaptik/route.js
import vm from "vm";

/**
 * Next.js App Router route handler (GET)
 * Accepts: /api/snaptik?url=<tiktok url>
 * Returns JSON in the same shape you provided:
 * { code: 0, msg: "success", processed_time: <sec>, data: { ... } }
 */

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

function rx(hay, re, asNumber = false) {
  const m = hay.match(re);
  if (!m) return null;
  return asNumber ? Number(m[1]) : m[1];
}

function buildDataFromText(hay, links) {
  const data = {
    id: rx(hay, /"id"\s*:\s*"([^"]+)"/) || rx(hay, /id\s*:\s*"([^"]+)"/) || null,
    region: rx(hay, /"region"\s*:\s*"([^"]+)"/) || null,
    title:
      rx(hay, /"title"\s*:\s*"([^"]*)"/) ||
      rx(hay, /<meta property="og:title" content="([^"]*)"/i) ||
      null,
    cover: rx(hay, /"cover"\s*:\s*"([^"]+)"/) || null,
    ai_dynamic_cover: rx(hay, /"ai_dynamic_cover"\s*:\s*"([^"]+)"/) || null,
    origin_cover: rx(hay, /"origin_cover"\s*:\s*"([^"]+)"/) || null,
    duration: rx(hay, /"duration"\s*:\s*([0-9]+)/, true) || null,
    play: links[0] || null,
    wmplay: links[1] || null,
    size: rx(hay, /"size"\s*:\s*([0-9]+)/, true) || null,
    wm_size: rx(hay, /"wm_size"\s*:\s*([0-9]+)/, true) || null,
    music: rx(hay, /"music"\s*:\s*"([^"]+)"/) || null,
    music_info: null,
    play_count: rx(hay, /"play_count"\s*:\s*([0-9]+)/, true) || null,
    digg_count: rx(hay, /"digg_count"\s*:\s*([0-9]+)/, true) || null,
    comment_count: rx(hay, /"comment_count"\s*:\s*([0-9]+)/, true) || null,
    share_count: rx(hay, /"share_count"\s*:\s*([0-9]+)/, true) || null,
    download_count: rx(hay, /"download_count"\s*:\s*([0-9]+)/, true) || null,
    collect_count: rx(hay, /"collect_count"\s*:\s*([0-9]+)/, true) || null,
    create_time: rx(hay, /"create_time"\s*:\s*([0-9]+)/, true) || null,
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
    item_comment_settings: rx(hay, /"item_comment_settings"\s*:\s*([0-9]+)/, true) || 0,
    mentioned_users: "",
    author: {
      id: rx(hay, /"author"\s*:\s*\{\s*"id"\s*:\s*"([^"]+)"/) || null,
      unique_id: rx(hay, /"unique_id"\s*:\s*"([^"]+)"/) || rx(hay, /"uniqueId"\s*:\s*"([^"]+)"/) || null,
      nickname: rx(hay, /"nickname"\s*:\s*"([^"]*)"/) || null,
      avatar: rx(hay, /"avatar"\s*:\s*"([^"]+)"/) || null
    }
  };

  // build music_info if present
  const musicTitle = rx(hay, /"music_info"\s*:\s*\{[^}]*"title"\s*:\s*"([^"]+)"/);
  if (musicTitle) {
    data.music_info = {
      id: rx(hay, /"music_info"\s*:\s*\{[^}]*"id"\s*:\s*"([^"]+)"/) || null,
      title: musicTitle,
      play: rx(hay, /"music_info"\s*:\s*\{[^}]*"play"\s*:\s*"([^"]+)"/) || null,
      cover: rx(hay, /"music_info"\s*:\s*\{[^}]*"cover"\s*:\s*"([^"]+)"/) || null,
      author: rx(hay, /"music_info"\s*:\s*\{[^}]*"author"\s*:\s*"([^"]+)"/) || null,
      original: /"music_info"\s*:\s*\{[^}]*"original"\s*:\s*true/.test(hay) || false,
      duration: rx(hay, /"music_info"\s*:\s*\{[^}]*"duration"\s*:\s*([0-9]+)/, true) || null,
      album: rx(hay, /"music_info"\s*:\s*\{[^}]*"album"\s*:\s*"([^"]+)"/) || null
    };
  }

  return data;
}

async function postToSnaptik(targetUrl) {
  // same boundary + token body you used
  const body = `------WebKitFormBoundaryJS7G2eJPBusA2onQ
Content-Disposition: form-data; name="url"

${targetUrl}
------WebKitFormBoundaryJS7G2eJPBusA2onQ
Content-Disposition: form-data; name="lang"

ar2
------WebKitFormBoundaryJS7G2eJPBusA2onQ
Content-Disposition: form-data; name="token"

eyMTc1NzkxNjA1Nw==c
------WebKitFormBoundaryJS7G2eJPBusA2onQ--\n`;

  const resp = await fetch("https://snaptik.app/abc2.php", {
    method: "POST",
    headers: {
      "Content-Type": "multipart/form-data; boundary=----WebKitFormBoundaryJS7G2eJPBusA2onQ",
      "User-Agent": "Mozilla/5.0 (Mozilla/5.0)",
      Referer: "https://snaptik.app/ar2",
      Accept: "*/*",
    },
    body
  });

  const text = await resp.text();
  return text;
}

function tryUnpackPackedPacker(text) {
  // try simple detection & safe evaluation via vm to return unpacked string
  try {
    // if it contains eval(f) pattern (common in packer), replace eval(f) with return f
    const evalFRegex = /eval\s*\(\s*f\s*\)/;
    if (evalFRegex.test(text)) {
      const wrapped = `(function(){\n${text.replace(evalFRegex, "return f")}\n})()`;
      const sandbox = Object.create(null);
      const script = new vm.Script(wrapped);
      const ctx = vm.createContext(sandbox);
      const result = script.runInContext(ctx, { timeout: 2000 });
      if (typeof result === "string") return result;
      if (result && typeof result.toString === "function") return String(result);
    }

    // generic: if ends with eval(<expr>) try returning the expr
    const genericEvalRegex = /eval\s*\(\s*([^\)]+)\s*\)\s*;?\s*$/m;
    const match = text.match(genericEvalRegex);
    if (match && match[1]) {
      const argExpr = match[1];
      const wrapped2 = `(function(){\n${text.replace(genericEvalRegex, `return ${argExpr}`)}\n})()`;
      const sandbox2 = Object.create(null);
      const script2 = new vm.Script(wrapped2);
      const ctx2 = vm.createContext(sandbox2);
      const res2 = script2.runInContext(ctx2, { timeout: 2000 });
      if (typeof res2 === "string") return res2;
      if (res2 && typeof res2.toString === "function") return String(res2);
    }
  } catch (e) {
    // use console.error so eslint sees the error var used
    console.error("unpack error:", e && e.message ? e.message : String(e));
  }
  return null;
}

export async function GET(req) {
  const start = Date.now();
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    if (!url) {
      const body400 = { code: 400, msg: "missing url", processed_time: 0, data: {} };
      return new Response(JSON.stringify(body400), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const raw = await postToSnaptik(url);
    // attempt to unpack obfuscated JS
    const unpacked = tryUnpackPackedPacker(raw);
    const hay = unpacked || raw;

    // extract links
    const links = extractLinksFromText(hay);
    const data = buildDataFromText(hay, links);

    // fallback: try to infer id from play link or url path
    if (!data.id) {
      if (links[0]) {
        const idMatch = links[0].match(/\/(\d{6,})\//);
        if (idMatch) data.id = idMatch[1];
      }
      if (!data.id) {
        try {
          const u = new URL(url);
          const parts = u.pathname.split("/").filter(Boolean);
          const last = parts[parts.length - 1] || "";
          if (/\d{6,}/.test(last)) data.id = last;
        } catch (e) {
          console.error("id-parse-url:", e && e.message ? e.message : String(e));
        }
      }
    }

    // ensure author exists
    if (!data.author) data.author = { id: null, unique_id: null, nickname: null, avatar: null };

    const processed_time = Number(((Date.now() - start) / 1000).toFixed(4));
    const out = { code: 0, msg: "success", processed_time, data };
    return new Response(JSON.stringify(out), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const processed_time = Number(((Date.now() - start) / 1000).toFixed(4));
    const bodyErr = { code: -1, msg: String(err), processed_time, data: {} };
    // console.error to use err variable so linters won't complain
    console.error("route-error:", err && err.message ? err.message : String(err));
    return new Response(JSON.stringify(bodyErr), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
