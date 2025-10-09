import { NextResponse } from "next/server";
import axios from "axios";
import * as xml2js from "xml2js";

export async function GET() {
  try {
    const rssUrl = "https://www.yallakora.com/RSS/News/1";
    const { data: xml } = await axios.get(rssUrl, { responseType: "text" });

    // تنظيف الـ XML من أي سمات غير صالحة (Attributes بدون قيمة)
    const cleanXml = xml
      .replace(/[\x00-\x1F\x7F]/g, "") // إزالة الرموز غير المرئية
      .replace(/(\s+[a-zA-Z0-9:-]+)(?=\s|>)/g, ''); // إصلاح السمات بدون قيم

    // تحويل الـ XML إلى JSON
    const parsed = await xml2js.parseStringPromise(cleanXml, {
      trim: true,
      explicitArray: false,
      ignoreAttrs: false,
      strict: false, // 👈 مهم لتجاوز الأخطاء الشكلية
      mergeAttrs: true,
    });

    const items = parsed?.rss?.channel?.item || [];
    const news = Array.isArray(items)
      ? items.map((item) => ({
          title: item.title,
          description: item.description,
          url: item.link,
          pubDate: item.pubDate,
        }))
      : [items];

    return NextResponse.json({
      code: 0,
      msg: "success",
      data: news.slice(0, 10),
    });
  } catch (err) {
    console.error("RSS Error:", err.message);
    return NextResponse.json(
      { code: 500, msg: "Failed to fetch RSS", error: err.message },
      { status: 500 }
    );
  }
}
