// app/api/snaptik/route.js

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const url = searchParams.get("url")

    if (!url) {
      return Response.json(
        { success: false, error: "يرجى إرسال بارامتر url" },
        { status: 400 }
      )
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

    return Response.json({
      success: true,
      data: text,
    })
  } catch (err) {
    return Response.json(
      { success: false, error: err.message },
      { status: 500 }
    )
  }
}
