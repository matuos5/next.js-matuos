// app/api/snaptik/route.js
export async function GET(req) {
  const start = Date.now();
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    if (!url) {
      return new Response(
        JSON.stringify({ code: 400, msg: "missing url", processed_time: 0, data: {} }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // هنا بنبعت الطلب لموقع snaptik
    const raw = await postToSnaptik(url);

    // دلوقتي بنرجع raw + بيانات افتراضية
    const processed_time = Number(((Date.now() - start) / 1000).toFixed(4));
    const out = {
      code: 0,
      msg: "success",
      processed_time,
      data: {}, // لحد ما نفك الرد
      raw: raw.slice(0, 5000) // أول 5000 حرف علشان نشوف المحتوى
    };
    return new Response(JSON.stringify(out), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const processed_time = Number(((Date.now() - start) / 1000).toFixed(4));
    return new Response(
      JSON.stringify({ code: -1, msg: String(err), processed_time, data: {} }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ===== Helper functions =====

// يبعث POST لموقع snaptik
async function postToSnaptik(videoUrl) {
  const form = new URLSearchParams();
  form.append("url", videoUrl);

  const res = await fetch("https://snaptik.app/abc2.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest"
    },
    body: form.toString()
  });

  if (!res.ok) throw new Error(`snaptik error: ${res.status}`);
  return await res.text();
}
