import axios from "axios";

export default async function handler(req, res) {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        code: 400,
        msg: "No URL provided",
      });
    }

    // طلب للـ API الأصلي
    const response = await axios.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}`);
    const result = response.data;

    if (!result || !result.data) {
      return res.status(500).json({
        code: 500,
        msg: "Failed to fetch video data",
      });
    }

    // تنسيق الرد ليكون زي الـ API اللي وريتهولي
    const video = result.data;

    return res.status(200).json({
      code: 0,
      msg: "success",
      processed_time: video.duration || 0,
      data: {
        id: video.id,
        region: video.region || "unknown",
        title: video.title,
        cover: video.cover,
        ai_dynamic_cover: video.ai_dynamic_cover,
        origin_cover: video.origin_cover,
        duration: video.duration,
        play: video.play,
        wmplay: video.wmplay,
        size: video.size,
        wm_size: video.wm_size,
        music: video.music,
        music_info: video.music_info,
        play_count: video.play_count,
        digg_count: video.digg_count,
        comment_count: video.comment_count,
        share_count: video.share_count,
        download_count: video.download_count,
        collect_count: video.collect_count,
        create_time: video.create_time,
        anchors: video.anchors,
        anchors_extras: video.anchors_extras,
        is_ad: video.is_ad,
        commerce_info: video.commerce_info,
        commercial_video_info: video.commercial_video_info,
        item_comment_settings: video.item_comment_settings,
        mentioned_users: video.mentioned_users,
        author: video.author,
      },
    });
  } catch (error) {
    return res.status(500).json({
      code: 500,
      msg: "Internal Server Error",
      error: error.message,
    });
  }
}
