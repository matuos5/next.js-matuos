// app/api/snaptik/route.js
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return Response.json({ success: false, error: "يرجى إرسال بارامتر url" }, { status: 400 });
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
        "Content-Type": "multipart/form-data; boundary=----WebKitFormBoundaryJS7G2eJPBusA2onQ",
        "User-Agent": "Mozilla/5.0 (Linux; Android 12; M2007J20CG) AppleWebKit/537.36 Chrome/139.0.0.0 Mobile Safari/537.36",
        Referer: "https://snaptik.app/ar2",
      },
      body,
    });

    const text = await response.text();

    // ---------- محاولة 1: محاولة آمنة بتشغيل دالة الفك فقط ----------
    let unpacked = null;
    try {
      const evalStart = text.indexOf("eval(function");
      if (evalStart !== -1) {
        // نأخذ التعبير من eval(function ... ) إلى أول '))' بعدها (غالباً يكفي)
        const idx = text.indexOf("))", evalStart);
        const evalEnd = idx !== -1 ? idx + 2 : text.length;
        const evalSnippet = text.slice(evalStart, evalEnd);
        // نحوّل eval(...) إلى تعبير يرجع النتيجة
        const safeSnippet = evalSnippet.replace(/^eval\s*\(/, "").replace(/;?\s*$/, "");
        // ننفّذ التعبير الآمن (عادةً يعيد النص المفكوك) باستخدام Function
        const fn = new Function(`return ${safeSnippet}`);
        const result = fn();
        if (typeof result === "string" && result.length > 0) unpacked = result;
      }
    } catch (err) {
      // نفشل بهدوء — سنحاول طرق أخرى
      console.warn("first unpack attempt failed:", String(err));
      unpacked = null;
    }

    // ---------- محاولة 2: محاولة فكّ Packer يدوياً ----------
    // دالة بسيطة لفك packer (تعوّض الرموز بالأقسام من الـ lookup array)
    function unpackPacker(p, a, c, k) {
      try {
        // إذا k عبارة عن string مفصولة بـ '|' أو بالفعل array
        const lookup = Array.isArray(k) ? k : (typeof k === "string" ? k.split("|") : []);
        // regex يطابق الكلمات/الأرقام الثابتة المستخدمة في p
        const wordRegex = new RegExp("\\b[0-9a-zA-Z]+\\b", "g");
        return p.replace(wordRegex, function(m) {
          const idx = parseInt(m, a);
          return lookup[idx] !== undefined ? lookup[idx] : m;
        });
      } catch (err) {
        return null;
      }
    }

    if (!unpacked) {
      // نحاول استخراج الوسائط من نص الـ eval(function(...)(p,a,c,k,...) )
      // هذا regex يحاول التقاط p, a, c, k من الاستدعاء الشائع
      const callRegex = /eval\(function\([^\)]*\)\s*\{[\s\S]*?\}\s*\(\s*(['"`])([\s\S]*?)\1\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*(['"`])([\s\S]*?)\5/;
      const m = callRegex.exec(text);
      if (m) {
        try {
          const packedP = m[2];      // النص المشفّر p
          const radix = parseInt(m[3], 10); // a
          const count = parseInt(m[4], 10); // c (أحيانا غير مستخدم)
          const kstring = m[6];     // سلسلة k المفصولة بـ '|'
          const attempt = unpackPacker(packedP, radix, count, kstring);
          if (attempt && attempt.length > 0) unpacked = attempt;
        } catch (err) {
          console.warn("packer manual unpack failed:", String(err));
        }
      }
    }

    // ---------- الآن نحاول استخراج الروابط من النص المفكوك أو الأصلي ----------
    const haystack = unpacked || text;

    // روابط ملفات وسائط مع امتدادات شائعة
    const urlRegex = /(https?:\/\/[^\s"'<>]+?\.(?:mp4|m4a|webm|m3u8|mp3|mov)(?:\?[^"'<>\s]*)?)/g;
    const links = [];
    let match;
    while ((match = urlRegex.exec(haystack)) !== null) {
      if (!links.includes(match[1])) links.push(match[1]);
    }

    // محاولة إضافية لاستخراج مرشّحات CDN / download التي قد لا تنتهي بامتداد واضح
    if (links.length === 0) {
      const extraRegex = /(https?:\/\/[^\s"'<>]{30,300}(?:cdn|download|media|video|cdnv|cdn-cgi)[^\s"'<>]*)/gi;
      while ((match = extraRegex.exec(haystack)) !== null) {
        const candidate = match[1];
        if (!links.includes(candidate)) links.push(candidate);
      }
    }

    return Response.json({
      success: true,
      unpacked: !!unpacked,
      count: links.length,
      links,
    });
  } catch (err) {
    console.error("snaptik route final error:", err);
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
}
