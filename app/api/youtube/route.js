export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q) {
      return new Response(
        JSON.stringify({ status: false, message: "Missing query parameter ?q=" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // هنا بس نرجع JSON خفيف بشكل ثابت
    // البوت هو اللي هيجيب الروابط الفعلية من YouTube
    return new Response(
      JSON.stringify({
        status: true,
        data: {
          title: q,
          description: "YouTube Downloader Lite API",
          thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
          author: "Unknown",
          channel: "Unknown",
          views: "0",
          ago: "N/A",
          time: "0",
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
          audio: null,
          video: null
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ status: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
