// app/api/anime/route.js
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function safeFetchText(url, opts = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), opts.timeout || 20000);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        ...(opts.headers || {}),
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(id);
    const text = await res.text();
    return { status: res.status, headers: res.headers, text, ok: res.ok };
  } catch (err) {
    clearTimeout(id);
    return { error: err.message || String(err) };
  }
}

function extractCandidatesFromHtml(html, baseUrl) {
  const $ = cheerio.load(html || "");
  const set = new Set();

  // a[href]
  $("a[href]").each((i, el) => {
    let href = $(el).attr("href");
    if (!href) return;
    try {
      href = new URL(href, baseUrl).toString();
    } catch (e) {
      // leave as-is
    }
    set.add(href);
  });

  // data attributes
  $("[data-href],[data-url],[data-download]").each((i, el) => {
    const a = $(el).attr("data-href") || $(el).attr("data-url") || $(el).attr("data-download");
    if (!a) return;
    try {
      set.add(new URL(a, baseUrl).toString());
    } catch (e) {
      set.add(a);
    }
  });

  // search inside scripts for URLs
  const scripts = $("script").map((i, s) => $(s).html()).get().join("\n");
  const re = /(https?:\/\/[^\s'"]{20,400})/g;
  let m;
  while ((m = re.exec(scripts)) !== null) {
    set.add(m[1]);
  }

  return Array.from(set);
}

/** Check if link is MP4 by HEAD (content-type) or by Range (ftyp) */
async function verifyLinkIsMp4(url) {
  try {
    // HEAD
    const headRes = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
      redirect: "follow",
    });
    const ctype = headRes.headers.get("content-type") || "";
    if (/video\/|application\/octet-stream|audio\//i.test(ctype) && /mp4|video/i.test(ctype)) {
      return { ok: true, method: "head-content-type", info: { status: headRes.status, contentType: ctype } };
    }
  } catch (e) {
    // ignore HEAD errors
  }

  // Range GET: read first bytes and look for 'ftyp'
  try {
    const rangeRes = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT, Range: "bytes=0-8191", Accept: "*/*" },
      redirect: "follow",
    });

    if (!rangeRes.ok && rangeRes.status !== 206 && rangeRes.status !== 200) {
      return { ok: false, method: "range-error-status", info: { status: rangeRes.status } };
    }

    const ab = await rangeRes.arrayBuffer();
    const buf = new Uint8Array(ab);
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const headText = decoder.decode(buf.subarray(0, Math.min(1024, buf.length)));
    if (headText.includes("ftyp")) {
      return { ok: true, method: "range-ftyp", info: { status: rangeRes.status } };
    }

    const ctype2 = rangeRes.headers.get("content-type") || "";
    if (/video\/|mp4/i.test(ctype2)) {
      return { ok: true, method: "range-content-type", info: { status: rangeRes.status, contentType: ctype2 } };
    }

    return { ok: false, method: "no-evidence", info: { status: rangeRes.status, snippet: headText.slice(0, 300) } };
  } catch (err) {
    return { ok: false, method: "error", message: err.message || String(err) };
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    const episode = searchParams.get("episode");

    if (!name || !episode) {
      return NextResponse.json(
        {
          owner: "matuos",
          code: 400,
          msg: "الرجاء ادخال اسم الانمي ورقم الحلقة",
        },
        { status: 400 }
      );
    }

    // ابحث في anime3rb كمثال
    const searchUrl = `https://anime3rb.com/?s=${encodeURIComponent(`${name} ${episode}`)}`;
    const searchRes = await safeFetchText(searchUrl);
    if (!searchRes || searchRes.error) {
      return NextResponse.json(
        { owner: "matuos", code: 500, msg: "فشل جلب نتائج البحث", error: searchRes && searchRes.error },
        { status: 500 }
      );
    }

    const $search = cheerio.load(searchRes.text);
    const firstLink = $search("a").attr("href");

    if (!firstLink) {
      return NextResponse.json(
        { owner: "matuos", code: 404, msg: "لم يتم العثور على الحلقة" },
        { status: 404 }
      );
    }

    const epRes = await safeFetchText(firstLink);
    if (!epRes || epRes.error) {
      return NextResponse.json(
        { owner: "matuos", code: 500, msg: "فشل جلب صفحة الحلقة", error: epRes && epRes.error },
        { status: 500 }
      );
    }

    const $ep = cheerio.load(epRes.text);
    const downloadLinks = $ep("a.btn-success")
      .map((i, el) => $ep(el).attr("href"))
      .get();

    if (!downloadLinks.length) {
      return NextResponse.json(
        { owner: "matuos", code: 404, msg: "لم يتم العثور على روابط تحميل" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "matuos",
      code: 0,
      msg: "success",
      data: downloadLinks,
    });
  } catch (err) {
    return NextResponse.json(
      { owner: "matuos", code: 500, msg: "Internal error", error: err.message },
      { status: 500 }
    );
  }
                }  }
}

function extractCandidatesFromHtml(html, baseUrl) {
  const $ = cheerio.load(html || "");
  const set = new Set();

  // a[href]
  $("a[href]").each((i, el) => {
    let href = $(el).attr("href");
    if (!href) return;
    try {
      href = new URL(href, baseUrl).toString();
    } catch (e) {
      // leave as-is
    }
    set.add(href);
  });

  // data attributes
  $("[data-href],[data-url],[data-download]").each((i, el) => {
    const a = $(el).attr("data-href") || $(el).attr("data-url") || $(el).attr("data-download");
    if (!a) return;
    try {
      set.add(new URL(a, baseUrl).toString());
    } catch (e) {
      set.add(a);
    }
  });

  // search inside scripts for URLs
  const scripts = $("script").map((i, s) => $(s).html()).get().join("\n");
  const re = /(https?:\/\/[^\s'"]{20,400})/g;
  let m;
  while ((m = re.exec(scripts)) !== null) {
    set.add(m[1]);
  }

  return Array.from(set);
}

/** Check if link is MP4 by HEAD (content-type) or by Range (ftyp) */
async function verifyLinkIsMp4(url) {
  // HEAD
  try {
    const headRes = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
      redirect: "follow",
    });
    const ctype = headRes.headers.get("content-type") || "";
    if (/video\/|application\/octet-stream|audio\//i.test(ctype) && /mp4|video/i.test(ctype)) {
      return { ok: true, method: "head-content-type", info: { status: headRes.status, contentType: ctype } };
    }
    // If HEAD gives 200 but content-type not clear, we'll try range below.
  } catch (e) {
    // ignore HEAD errors and fallback to range GET
  }

  // Range GET: read first bytes and look for 'ftyp'
  try {
    const rangeRes = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Range: "bytes=0-8191",
        Accept: "*/*",
      },
      redirect: "follow",
    });

    // ensure we got some bytes
    if (!rangeRes.ok && rangeRes.status !== 206 && rangeRes.status !== 200) {
      return { ok: false, method: "range-error-status", info: { status: rangeRes.status } };
    }

    const ab = await rangeRes.arrayBuffer();
    const buf = new Uint8Array(ab);
    // decode first chunk safely
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const headText = decoder.decode(buf.subarray(0, Math.min(1024, buf.length)));
    if (headText.includes("ftyp")) {
      return { ok: true, method: "range-ftyp", info: { status: rangeRes.status } };
    }

    const ctype2 = rangeRes.headers.get("content-type") || "";
    if (/video\/|mp4/i.test(ctype2)) {
      return { ok: true, method: "range-content-type", info: { status: rangeRes.status, contentType: ctype2 } };
    }

    return { ok: false, method: "no-evidence", info: { status: rangeRes.status, snippet: headText.slice(0, 300) } };
  } catch (err) {
    return { ok: false, method: "error", message: err.message || String(err) };
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const urlParam = searchParams.get("url"); // full page URL to scrape
    const source = searchParams.get("source"); // e.g. 'koramaup'
    const pt = searchParams.get("pt"); // optional token for sources like koramaup
    const name = searchParams.get("name"); // optional name search (not implemented for every site)

    if (!urlParam && !(source && pt) && !name) {
      return NextResponse.json(
        { owner: "matuos", code: 400, msg: "أرسل 'url' أو 'source' مع 'pt' أو 'name' parameter" },
        { status: 400 }
      );
    }

    // Build target URL
    let targetUrl = urlParam;
    if (!targetUrl && source === "koramaup" && pt) {
      targetUrl = `https://koramaup.com/mg6X?pt=${encodeURIComponent(pt)}`;
    }

    // Fetch page HTML
    const page = await safeFetchText(targetUrl, { timeout: 20000 });
    if (!page || page.error) {
      return NextResponse.json(
        { owner: "matuos", code: 500, msg: "فشل جلب الصفحة", error: page && page.error },
        { status: 500 }
      );
    }

    // Extract candidates
    const candidates = extractCandidatesFromHtml(page.text || page.html || page, targetUrl);

    // limit candidates for speed / resource control
    const MAX_CHECK = 30;
    const toCheck = candidates.slice(0, MAX_CHECK);

    const verified = [];
    for (const c of toCheck) {
      try {
        const v = await verifyLinkIsMp4(c);
        if (v && v.ok) {
          verified.push({ url: c, method: v.method, info: v.info || {} });
        }
      } catch (e) {
        // continue on error
      }
    }

    return NextResponse.json(
      { owner: "matuos", code: 0, msg: "success", data: { candidates: toCheck, verified } },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { owner: "matuos", code: 500, msg: "Internal error", error: err.message },
      { status: 500 }
    );
  }
      }        { owner: "matuos", code: 404, msg: "لم يتم العثور على الحلقة" },
        { status: 404 }
      );
    }

    const epRes = await fetch(firstLink, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const epHtml = await epRes.text();
    const $ep = cheerio.load(epHtml);
    const downloadLinks = $ep("a.btn-success")
      .map((i, el) => $ep(el).attr("href"))
      .get();

    if (!downloadLinks.length) {
      return NextResponse.json(
        { owner: "matuos", code: 404, msg: "لم يتم العثور على روابط تحميل" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "matuos",
      code: 0,
      msg: "success",
      data: downloadLinks,
    });
  } catch (err) {
    return NextResponse.json(
      { owner: "matuos", code: 500, msg: "Internal error", error: err.message },
      { status: 500 }
    );
  }
}
