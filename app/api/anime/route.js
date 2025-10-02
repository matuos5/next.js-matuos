// app/api/anime/route.js
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى إضافة رابط الحلقة من animezid.cam",
        },
        { status: 400 }
      );
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const html = await res.text();
    const $ = cheerio.load(html);

    // استخراج روابط التحميل من الأزرار
    const downloadLinks = $("a.btn-success")
      .map((i, el) => $(el).attr("href"))
      .get();

    if (!downloadLinks.length) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على روابط تحميل",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: downloadLinks,
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "Internal error",
        error: err.message,
      },
      { status: 500 }
    );
  }
}        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على الحلقة",
        },
        { status: 404 }
      );
    }

    // جلب صفحة الحلقة
    const epRes = await fetch(firstLink, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const epHtml = await epRes.text();
    const $ep = cheerio.load(epHtml);

    // استخراج روابط التحميل من الأزرار
    const downloadLinks = $ep("a.btn-success")
      .map((i, el) => $ep(el).attr("href"))
      .get();

    if (!downloadLinks.length) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على روابط تحميل",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: downloadLinks,
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "Internal error",
        error: err.message,
      },
      { status: 500 }
    );
  }
} ok: false, method: "no-evidence", info: { status: rangeRes.status, snippet: headText.slice(0, 300) } };
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
