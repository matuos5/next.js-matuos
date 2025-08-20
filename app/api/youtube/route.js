import ytdl from "ytdl-core";
import yts from "yt-search";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q) {
      return new Response(
        JSON.stringify({ error: "Missing query parameter ?q=" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // جلب الفيديو
    let videoId;
    if (ytdl.validateURL(q)) {
      videoId = ytdl.getURLVideoID(q);
    } else {
      const search = await yts(q);
      if (!search || !search.videos.length) {
        return new Response(
          JSON.stringify({ error: "No results found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      videoId = search.videos[0].videoId;
    }

    const info = await ytdl.getInfo(videoId);
    const title = info.videoDetails.title;
    const thumbnail = info.videoDetails.thumbnails.pop().url;
    const author = info.videoDetails.author.name;
    const views = info.videoDetails.viewCount;
    const ago = info.videoDetails.uploadDate;
    const time = info.videoDetails.lengthSeconds;
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    // روابط التحميل
    const audio = ytdl.chooseFormat(info.formats, { quality: "highestaudio" }).url;
    const video = ytdl.chooseFormat(info.formats, { quality: "highestvideo" }).url;

    return new Response(
      JSON.stringify({
        status: true,
        data: { title, thumbnail, author, views, ago, time, url, audio, video },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
