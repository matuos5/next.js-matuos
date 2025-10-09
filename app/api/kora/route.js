import { NextResponse } from "next/server";
import axios from "axios";
import * as xml2js from "xml2js";

export async function GET() {
  try {
    const rssUrl = "https://www.yallakora.com/RSS/News/1";
    const { data: xml } = await axios.get(rssUrl);
    const parsed = await xml2js.parseStringPromise(xml, { trim: true, explicitArray: false });

    const items = parsed?.rss?.channel?.item || [];
    const news = Array.isArray(items) ? items.map((item) => ({
      title: item.title,
      description: item.description,
      url: item.link,
      pubDate: item.pubDate,
    })) : [items];

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
}    return NextResponse.json(
      { code: 500, msg: "Scraping error", error: err.message },
      { status: 500 }
    );
  }
}
