// app/api/snaptik/route.js
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const url = searchParams.get("url")

    if (!url) {
      return Response.json({ success: false, error: "يرجى إرسال بارامتر url" }, { status: 400 })
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
------WebKitFormBoundaryJS7G2eJPBusA2onQ--`

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
    })

    const text = await response.text()

    // --- 1) اكتشاف إذا النص عبارة عن packer (eval(function(...)(...)) )
    const packerRegex = /eval\(function\s*\([^\)]*\)\s*\{[\s\S]*?\}\s*\(\s*(['"`])([\s\S]*?)\1\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*(['"`])([\s\S]*?)\5\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*\)\s*\)/m

    let unpacked = null

    if (packerRegex.test(text)) {
      // إذا اكتشفنا شكل الـ eval(function(...)(...)) نعمل محاولة لفكه بدون تنفيذ المحتوى النهائي
      try {
        // نستخرج كامل التعبير الـ eval(...) من النص
        const evalStart = text.indexOf("eval(function")
        const evalEnd = (function findMatchingParenIndex(s, startIndex) {
          // نبحث الموضع الأخير للعلامة ) المقابلة لنهاية الاستدعاء eval(...)(...)
          // طريقة بسيطة: نأخذ من evalStart حتى نهاية النص ونحأخذ أول ");" يليها أو آخر ");"
          // لكن هنا سنأخذ كل التعبير من eval(function ... )( ... ) عن طريق إيجاد أول ")(\"" بعد نهاية جسم الفنكشن
          // لأغلب حالاتها استخراج حتى نهاية `))` الأولى كافي.
          // بدلاً من التعقيد، نستخدم indexOf لـ '))' بعد evalStart. إذا فشل، نأخذ نهاية النص.
          const idx = s.indexOf("))", startIndex)
          return idx !== -1 ? idx + 2 : s.length
        })(text, evalStart)

        const evalSnippet = text.slice(evalStart, evalEnd)

        // نحول eval(...) إلى تعبير يرجع (return) النتيجة بدلاً من eval لتنفيذ فقط دالة الفك.
        // مثال: eval(function(p,a,c,k,e,d){...}('...',62,62,'...'.split('|'),0,{}))
        // نبدله بـ: (function(p,a,c,k,e,d){...}('...',62,62,'...'.split('|'),0,{}))
        // ثم نستدعيه داخل Function عشان نأخذ القيمة المرجعة كنص.
        const safeSnippet = evalSnippet.replace(/^eval\s*\(/, "")
          // لو كان ينتهي بـ `);` أو `)` نبقيه كما هو (نزيل أي ; زائدة)
          .replace(/;?\s*$/, "")

        // الآن ننفّذ التعبير الآمن داخل Function للحصول على النص المفكوك (نحاول فقط تشغيل دالة الفكّ)
        // ملاحظة: هذا ينفّذ أثناء الإنشاء الدالة الموجودة داخل النص (والتي عادةً هي دالة فكّ فقط).
        // لن ننفّذ أي شيء من الناتج المفكوك.
        const fn = new Function(`return ${safeSnippet}`)
        const result = fn() // هذا عادةً يعيد النص المفكوك (HTML أو JS) وليس تنفيذ هذا النص
        if (typeof result === "string") {
          unpacked = result
        } else {
          // في بعض الحالات قد يرجع undefined أو شيء آخر — نحاول قراءته كـ text داخل result إذا كان buffer-like
          unpacked = String(result)
        }
      } catch (e) {
        // فشل فك التعبير بهذه الطريقة — نكمل بمحاولات استخراج روابط مباشرة من النص الأصلي
        unpacked = null
      }
    }

    // إذا ما تفككش، نستخدم النص الأصلي كـ fallback
    const haystack = unpacked || text

    // --- 2) استخراج روابط mp4 / m4a / download links عامة
    const urlRegex = /(https?:\/\/[^\s"']+\.(mp4|m4a|webm|m3u8|mp3|mov)(\?[^"'\s]*)?)/g
    const links = []
    let match
    while ((match = urlRegex.exec(haystack)) !== null) {
      links.push(match[1])
    }

    // كمان نحاول استخراج روابط ممكنة داخل JSON-like أو داخل strings بدون امتداد واضح
    // مثال: روابط CDN بدون امتداد قد تكون داخل "https://.../video/12345"
    // هذا اختياري ومحدود لأن شروط False positives ممكن تكون عالية.
    // هنا نضيف استخراج أي رابط يحتوي كلمات معروفة مثل 'cdn' و 'download' و 'media' وينتهي بـ query أو رقم
    const extraRegex = /(https?:\/\/[^\s"'<>]{20,200}(?:cdn|download|media|video|cdnv|cdn-cgi)[^\s"'<>]*)/gi
    while ((match = extraRegex.exec(haystack)) !== null) {
      const candidate = match[1]
      if (!links.includes(candidate)) links.push(candidate)
    }

    return Response.json({
      success: true,
      unpacked: !!unpacked, // هل قدرنا نفك الكود فعلاً
      count: links.length,
      links,
    })
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 })
  }
}
