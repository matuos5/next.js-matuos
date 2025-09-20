import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json(
        { owner: "MATUOS3MK", code: 400, msg: "يرجى إضافة اسم الأغنية أو كلمة منها" },
        { status: 400 }
      );
    }

    const response = await axios.get(
      "https://www.chosic.com/ar/%D8%A5%D9%8A%D8%AC%D8%A7%D8%AF-%D8%A7%D9%84%D8%A3%D8%BA%D8%A7%D9%86%D9%8A-%D9%85%D9%86-%D8%AE%D9%84%D8%A7%D9%84-%D8%A7%D9%84%D9%83%D9%84%D9%85%D8%A7%D8%AA/",
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; MAR-LX1A Build/HUAWEIMAR-L21MEB) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.51 Mobile Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
        }
      }
    );

    const html = response.data;
    const $ = cheerio.load(html);

    // البحث عن الأغاني التي تحتوي على الكلمة أو الاسم
    const results = [];
    $("a[href]").each((_, el) => {
      const text = $(el).text();
      const href = $(el).attr("href");
      if (text && href && text.toLowerCase().includes(query.toLowerCase())) {
        results.push({ title: text.trim(), link: href });
      }
    });

    if (!results.length) {
      return NextResponse.json(
        { owner: "MATUOS3MK", code: 404, msg: "لم يتم العثور على نتائج" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "MATUOS3MK",
      code: 0,
      msg: "success",
      data: { query, results },
    });
  } catch (err) {
    return NextResponse.json(
      { owner: "MATUOS3MK", code: 500, msg: "Internal error", error: err.message },
      { status: 500 }
    );
  }
    }
