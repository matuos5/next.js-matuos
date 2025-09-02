import yts from "yt-search";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: "برجاء إدخال اسم أو رابط للبحث" });
    }

    // نعمل بحث عن الفيديو
    const searchResult = await yts(q);
    if (!searchResult || !searchResult.videos.length) {
      return res.status(404).json({ error: "لم يتم العثور على أي نتائج" });
    }

    const video = searchResult.videos[0];
    const videoUrl = video.url;

    // نجيب صفحة الفيديو عشان نطلع منها الروابط
    const page = await fetch(videoUrl).then(r => r.text());
    const $ = cheerio.load(page);

    // هنا مجرد placeholder للروابط (محتاج طريقة تكمّل استخراج مباشر)
    const downloadLinks = {
      audio: videoUrl,
      video: videoUrl,
    };

    return res.status(200).json({
      title: video.title,
      description: video.description,
      thumbnail: video.thumbnail,
      time: video.timestamp,
      ago: video.ago,
      views: video.views,
      url: video.url,
      author: video.author.name,
      channel: video.author.url,
      video: downloadLinks.video,
      audio: downloadLinks.audio,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
