import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

    if (!query) {
      return NextResponse.json(
        {
          success: false,
          error: "يرجى إضافة query كمعامل في الرابط",
          example: "/api/search-anime?query=boruto"
        },
        { status: 400 }
      );
    }

    // بناء رابط البحث
    const searchUrl = `https://witanime.you/?search_param=animes&s=${encodeURIComponent(query)}`;
    
    // استخدام API لتجاوز حماية Cloudflare
    const bypassApi = `https://dark-v2-api.vercel.app/api/v1/tools/bypass?url=${encodeURIComponent(searchUrl)}`;

    const response = await axios.get(
      bypassApi,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6'
        },
        responseType: 'json'
      }
    );

    if (!response.data?.status) {
      return NextResponse.json(
        {
          success: false,
          error: "فشل في تجاوز حماية الموقع",
          message: response.data?.message || "Unknown error"
        },
        { status: 500 }
      );
    }

    const htmlContent = response.data.data?.fullHtml || response.data.data?.htmlPreview;
    
    if (!htmlContent) {
      return NextResponse.json(
        {
          success: false,
          error: "لم يتم الحصول على محتوى HTML",
          query
        },
        { status: 500 }
      );
    }

    // تحليل HTML باستخدام cheerio
    const $ = cheerio.load(htmlContent);
    const animeResults = [];
    
    // استخراج جميع نتائج الأنمي
    $('.anime-card-container').each((index, element) => {
      const $card = $(element);
      
      const animeData = {
        title: $card.find('.anime-card-title h3 a').text().trim(),
        url: $card.find('.anime-card-title h3 a').attr('href') || '',
        image: $card.find('.anime-card-poster img').attr('src') || '',
        status: $card.find('.anime-card-status a').text().trim(),
        type: $card.find('.anime-card-type a').text().trim(),
        description: $card.find('.anime-card-title').attr('data-content') || '',
        order: index + 1
      };
      
      // إضافة فقط إذا كان هناك عنوان
      if (animeData.title) {
        animeResults.push(animeData);
      }
    });

    return NextResponse.json({
      success: true,
      query,
      count: animeResults.length,
      results: animeResults,
      searchUrl,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error in anime search:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: "حدث خطأ أثناء البحث",
        message: error.message,
        query: searchParams.get("query")
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query) {
      return NextResponse.json(
        {
          success: false,
          error: "يرجى إرسال query في body"
        },
        { status: 400 }
      );
    }

    // إعادة استخدام نفس منطق GET
    const { searchParams } = new URL(request.url);
    const newUrl = new URL(`/api/search-anime?query=${encodeURIComponent(query)}`, request.url);
    
    // نقوم بإنشاء طلب GET جديد
    const getRequest = new Request(newUrl.toString(), {
      method: 'GET',
      headers: request.headers
    });

    return await GET(getRequest);

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "حدث خطأ في معالجة الطلب POST",
        message: error.message
      },
      { status: 500 }
    );
  }
  }
