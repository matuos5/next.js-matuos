import axios from "axios";
import * as cheerio from "cheerio";

// ✨ بيانات المطور
const API_OWNER = {
  developer: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚"
};

// ✨ User-Agent و Cookie ثابتين
const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 12; M2007J20CG Build/SKQ1.211019.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.143 Mobile Safari/537.36",
  "Cookie":
    "ukey=xu5s72nnz76gzh28wd3j2yduf75ajbj4; __cf_bm=VdII9NFyROJCH98R1DgRUlmK91cuHcUbhOjFUnIdp1A-1756536655-1.0.1.1-NeWyx0DZsd8Ub_nWGWvzKyua.1Czl6qmppRVtH7iPKfDpHODYTIshSO6Sf6m1Cx.tUPSiNJ43NVraPnT8YGv0vt1MdYGu5m3921RCGbWQrU; amp_28916b=SC6q42s_f6HRkZ-n3nJVJx...1j3srsotj.1j3srsotv.0.1.1"
};

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res
      .status(400)
      .json({ error: "❌ لازم تبعت باراميتر ?url=" });
  }

  try {
    // جلب الصفحة
    const response = await axios.get(url, {
      headers: DEFAULT_HEADERS
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // استخراج بيانات أساسية
    const title = $("title").text() || null;
    const description =
      $('meta[name="description"]').attr("content") || null;

    // ✅ JSON النهائي
    res.status(200).json({
      api_owner: API_OWNER,
      scraped_from: url,
      data: {
        title,
        description,
        length: html.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: "🚨 حصل خطأ: " + err.message });
  }
}
