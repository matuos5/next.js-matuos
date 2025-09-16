// app/api/snaptik/route.js
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return Response.json(
        { success: false, error: "يرجى إرسال بارامتر url" },
        { status: 400 }
      );
    }

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

    const response = await fetch("https://snaptik.app/abc2.php", {
      method: "POST",
      headers: {
        "Content-Type":
          "multipart/form-data; boundary=----WebKitFormBoundaryJS7G2eJPBusA2onQ",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 12; M2007J20CG) AppleWebKit/537.36 Chrome/139.0.0.0 Mobile Safari/537.36",
        Referer: "https://snaptik.app/ar2",
      },
      body,
    });

    const text = await response.text();

    // ---------- محاولة 1: تشغيل تعبير دالة الفك فقط (آمن نسبياً) ----------
    let unpacked = null;
    try {
      const evalStart = text.indexOf("eval(function");
      if (evalStart !== -1) {
        const idx = text.indexOf("))", evalStart);
        const evalEnd = idx !== -1 ? idx + 2 : text.length;
        const evalSnippet = text.slice(evalStart, evalEnd);
        const safeSnippet = evalSnippet.replace(/^eval\s*\(/, "").replace(/;?\s*$/, "");
        const fn = new Function(`return ${safeSnippet}`);
        const result = fn();
        if (typeof result === "string" && result.length > 0) unpacked = result;
      }
    } catch (_err) {
      // استخدمنا _err ليُعتبر المُتغيّر مستخدماً ولا يثير lint
      console.warn("first unpack attempt failed:", _err);
      unpacked = null;
    }

    // ---------- محاولة 2: فكّ packer يدوياً ----------
    function unpackPacker(p, a, c, k) {
      try {
        const lookup = Array.isArray(k) ? k : (typeof k === "string" ? k.split("|") : []);
        const wordRegex = new RegExp("\\b[0-9a-zA-Z]+\\b", "g");
        return p.replace(wordRegex, function (m) {
          const idx = parseInt(m, a);
          return lookup[idx] !== undefined ? lookup[idx] : m;
        });
      } catch (_err) {
        console.warn("unpackPacker error:", _err);
        return null;
      }
    }

    if (!unpacked) {
      try {
        const callRegex = /eval\(function\([^\)]*\)\s*\{[\s\S]*?\}\s*\(\s*(['"`])([\s\S]*?)\1\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*(['"`])([\s\S]*?)\5/;
        const m = callRegex.exec(text);
        if (m) {
          const packedP = m[2];
          const radix = parseInt(m[3], 10);
          const count = parseInt(m[4], 10);
          const kstring = m[6];
          const attempt = unpackPacker(packedP, radix, count, kstring);
          if (attempt && attempt.length > 0) unpacked = attempt;
        }
      } catch (_err) {
        console.warn("manual packer attempt failed:", _err);
      }
    }

    // ---------- استخراج الروابط من النص المفكوك أو الأصلي ----------
    const haystack = unpacked || text;

    // روابط ملفات وسائط شائعة
    const urlRegex = /(https?:\/\/[^\s"'<>]+?\.(?:mp4|m4a|webm|m3u8|mp3|mov)(?:\?[^"'<>\s]*)?)/g;
    const links = [];
    let match;
    while ((match = urlRegex.exec(haystack)) !== null) {
      if (!links.includes(match[1])) links.push(match[1]);
    }

    // محاولة إضافية لاستخراج روابط CDN / download (إذا ما لقيش امتدادات)
    if (links.length === 0) {
      try {
        const extraRegex = /(https?:\/\/[^\s"'<>]{30,300}(?:cdn|download|media|video|cdnv|cdn-cgi)[^\s"'<>]*)/gi;
        while ((match = extraRegex.exec(haystack)) !== null) {
          const candidate = match[1];
          if (!links.includes(candidate)) links.push(candidate);
        }
      } catch (_err) {
        console.warn("extraRegex failed:", _err);
      }
    }

    return Response.json({
      success: true,
      unpacked: !!unpacked,
      count: links.length,
      links,
    });
  } catch (_err) {
    // الخطأ النهائي — نستخدم _err هنا أيضاً
    console.error("snaptik route final error:", _err);
    return Response.json({ success: false, error: String(_err) }, { status: 500 });
  }
}
