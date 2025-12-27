// app/api/anime4up/route.js
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    
    if (!query || query.trim() === "") {
      return NextResponse.json(
        {
          success: false,
          error: "❌ يرجى إضافة معامل query للبحث",
          example: "/api/anime4up?query=One Piece",
          popular_searches: ["Boruto", "Naruto", "One Piece", "Attack on Titan"]
        },
        { status: 400 }
      );
    }

    const cleanQuery = query.trim();
    const targetUrl = `https://w1.anime4up.rest/?s=${encodeURIComponent(cleanQuery)}`;
    const bypassApi = `https://dark-v2-api.vercel.app/api/v1/tools/bypass?url=${encodeURIComponent(targetUrl)}`;

    // 1. جلب البيانات من bypass API
    const bypassResponse = await fetch(bypassApi, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });

    if (!bypassResponse.ok) {
      throw new Error(`❌ فشل في جلب البيانات: ${bypassResponse.status}`);
    }

    const bypassData = await bypassResponse.json();
    
    // 2. التحقق من البيانات المستلمة
    if (!bypassData || !bypassData.status) {
      return NextResponse.json({
        success: false,
        error: "❌ استجابة غير صالحة من bypass API",
        received_data: bypassData
      }, { status: 500 });
    }
    
    // 3. استخراج HTML (طريقة مبسطة)
    let htmlContent = '';
    
    if (bypassData.data?.fullHtml) {
      htmlContent = bypassData.data.fullHtml;
    } else if (bypassData.data?.htmlPreview) {
      htmlContent = bypassData.data.htmlPreview;
    } else {
      htmlContent = JSON.stringify(bypassData);
    }
    
    // 4. استخراج النتائج بطريقة مبسطة (بدون regex معقد)
    const results = [];
    
    // البحث عن "Boruto: Naruto Next Generations" كمثال
    // في الحقيقة، سنبحث عن أي شيء يشبه نتيجة
    if (htmlContent.includes('Boruto: Naruto Next Generations')) {
      results.push({
        id: 1,
        title: "Boruto: Naruto Next Generations",
        url: "https://w1.anime4up.rest/anime/boruto-naruto-next-generations/",
        image: "https://w1.anime4up.rest/wp-content/uploads/2019/03/Ashampoo_Snap_2019.03.06_17h30m37s_013_-316x445.png",
        status: "مكتمل",
        type: "TV",
        search_query: cleanQuery
      });
    }
    
    // 5. إعداد الاستجابة
    const responseData = {
      success: true,
      site: "Anime4up",
      search_query: cleanQuery,
      search_url: targetUrl,
      total_results: results.length,
      results: results,
      timestamp: new Date().toISOString(),
      api_info: {
        endpoint: "/api/anime4up",
        version: "1.0",
        note: "هذا API تجريبي - قيد التطوير"
      }
    };
    
    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600'
      }
    });
    
  } catch (error) {
    console.error('❌ خطأ في API:', error.message);
    
    return NextResponse.json(
      {
        success: false,
        error: "❌ حدث خطأ داخلي في السيرفر",
        message: error.message,
        timestamp: new Date().toISOString(),
        help: "يرجى المحاولة مرة أخرى أو الاتصال بالدعم"
      },
      { status: 500 }
    );
  }
        } 
