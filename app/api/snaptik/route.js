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
      try {
        const evalStart = text.indexOf("eval(function")
        const evalEnd = (function findMatchingParenIndex(s, startIndex) {
          const idx = s.indexOf("))", startIndex)
          return idx !== -1 ? idx + 2 : s.length
        })(text, evalStart)

        const evalSnippet = text.slice(evalStart, evalEnd)

        const safeSnippet = evalSnippet.replace(/^eval\s*\(/, "").replace(/;?\s*$/, "")

        const fn = new Function(`return ${safeSnippet}`)
        const result = fn()
        if (typeof result === "string") {
          unpacked = result
        } else {
          unpacked = String(result)
        }
      } catch (err) {
        // استخدمنا err هنا عشان ESLint ما يشكي، وكمان لتتبع السبب لو فشل الفك
        console.warn("unpack attempt failed:", err)
        unpacked = null
      }
    }

    const haystack = unpacked || text

    const urlRegex = /(https?:\/\/[^\s"']+\.(mp4|m4a|webm|m3u8|mp3|mov)(\?[^"'\s]*)?)/g
    const links = []
    let match
    while ((match = urlRegex.exec(haystack)) !== null) {
      links.push(match[1])
    }

    const extraRegex = /(https?:\/\/[^\s"'<>]{20,200}(?:cdn|download|media|video|cdnv|cdn-cgi)[^\s"'<>]*)/gi
    while ((match = extraRegex.exec(haystack)) !== null) {
      const candidate = match[1]
      if (!links.includes(candidate)) links.push(candidate)
    }

    return Response.json({
      success: true,
      unpacked: !!unpacked,
      count: links.length,
      links,
    })
  } catch (err) {
    // هنا نستخدم err فعليًا في الـ catch النهائي
    console.error("snaptik route error:", err)
    return Response.json({ success: false, error: String(err) }, { status: 500 })
  }
}
