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

    const raw = await postToSnaptik(url);

    // هنا لسه ما نفكّكناش، هنرجّع الـ raw كمان
    const processed_time = Number(((Date.now() - start) / 1000).toFixed(4));
    const out = {
      code: 0,
      msg: "success",
      processed_time,
      data: buildDataFromText(raw, extractLinksFromText(raw)),
      raw: raw.slice(0, 5000) // نرجع أول 5000 حرف علشان ما يفجرش الرد
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
