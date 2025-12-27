// app/api/anime4up/route.js
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    
    // التحقق من وجود معامل البحث
    if (!query || query.trim() === "") {
      return NextResponse.json(
        {
          success: false,
          error: "❌ يرجى إضافة معامل query للبحث",
          example: "/api/anime4up?query=One Piece",
          available_parameters: {
            query: "كلمة البحث (مطلوبة)"
          },
          popular_searches: [
            "Naruto",
            "One Piece",
            "Attack on Titan",
            "Demon Slayer",
            "Jujutsu Kaisen"
          ]
        },
        { status: 400 }
      );
    }

    const targetUrl = `https://w1.anime4up.rest/?s=${encodeURIComponent(query.trim())}`;
    const bypassApi = `https://dark-v2-api.vercel.app/api/v1/tools/bypass?url=${encodeURIComponent(targetUrl)}`;

    console.log(`🔍 البحث عن: ${query}`);
    console.log(`🔗 URL الهدف: ${targetUrl}`);

    // جلب البيانات من الـ bypass API
    const response = await fetch(bypassApi, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`❌ فشل في جلب البيانات: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // استخراج محتوى HTML من الاستجابة
    let htmlContent = '';
    
    if (data && data.status) {
      if (data.data && data.data.fullHtml) {
        htmlContent = data.data.fullHtml;
      } else if (data.data && data.data.htmlPreview) {
        htmlContent = data.data.htmlPreview;
      } else if (data.html) {
        htmlContent = data.html;
      } else if (data.data && data.data.content) {
        htmlContent = data.data.content;
      }
    }
    
    if (!htmlContent || htmlContent.length < 100) {
      return NextResponse.json({
        success: false,
        error: "لم يتم العثور على محتوى HTML صالح في الاستجابة",
        query: query,
        data_structure: Object.keys(data || {}),
        html_length: htmlContent?.length || 0
      }, { status: 500 });
    }
    
    console.log(`📏 طول HTML: ${htmlContent.length} حرف`);
    
    // استخدام regex لاستخراج البيانات
    const results = [];
    
    // البحث عن عناصر anime-card-themex
    const animeCardRegex = /<div\s+class="anime-card-themex"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
    let animeCardMatch;
    
    while ((animeCardMatch = animeCardRegex.exec(htmlContent)) !== null) {
      const cardHtml = animeCardMatch[0];
      
      // استخراج العنوان
      let title = '';
      const titleRegex = /<h3>\s*<a[^>]*>(.*?)<\/a>\s*<\/h3>/;
      const titleMatch = cardHtml.match(titleRegex);
      if (titleMatch) {
        title = titleMatch[1].replace(/&nbsp;/g, ' ').trim();
      }
      
      // استخراج الرابط
      let link = '';
      const linkRegex = /<a[^>]*class="overlay"[^>]*href="([^"]*)"/;
      const linkMatch = cardHtml.match(linkRegex);
      if (linkMatch) {
        link = linkMatch[1];
      }
      
      // استخراج الصورة
      let image = '';
      const imgRegex = /<img[^>]*src="([^"]*)"[^>]*>/;
      const imgMatch = cardHtml.match(imgRegex);
      if (imgMatch) {
        image = imgMatch[1];
      }
      
      // استخراج الحالة
      let status = '';
      const statusRegex = /<div\s+class="anime-card-status"[^>]*>([^<]*)</;
      const statusMatch = cardHtml.match(statusRegex);
      if (statusMatch) {
        status = statusMatch[1].trim();
      }
      
      // استخراج النوع
      let type = '';
      const typeRegex = /<div\s+class="anime-card-type"[^>]*>([^<]*)</;
      const typeMatch = cardHtml.match(typeRegex);
      if (typeMatch) {
        type = typeMatch[1].trim();
      }
      
      if (title) {
        results.push({
          id: results.length + 1,
          title: title,
          url: link || null,
          image: image || null,
          status: status || null,
          type: type || null,
          search_query: query
        });
      }
    }
    
    // إذا لم نجد بطريقة regex، نجرب طريقة البحث المباشر في HTML
    if (results.length === 0) {
      console.log("⚠️ لم يتم العثور على نتائج بطريقة regex، جرب طريقة البحث المباشر...");
      
      // بحث عن أي ذكر للعنوان في HTML
      if (htmlContent.includes(query)) {
        results.push({
          id: 1,
          title: `نتائج لـ "${query}"`,
          url: targetUrl,
          image: null,
          status: "تم العثور على مطابقات في المحتوى",
          type: "مباشر",
          search_query: query,
          note: "تم العثور على مطابقات في HTML ولكن لم يتم استخراج البطاقات"
        });
      }
    }
    
    // إعداد النتيجة النهائية
    const finalResult = {
      success: true,
      site: 'Anime4up',
      search_query: query,
      search_url: targetUrl,
      total_results: results.length,
      results: results,
      timestamp: new Date().toISOString(),
      api_info: {
        endpoint: "/api/anime4up",
        version: "1.0",
        parameters: {
          query: "كلمة البحث (مطلوبة)"
        }
      }
    };
    
    console.log(`✅ تم العثور على ${results.length} نتيجة`);
    
    return NextResponse.json(finalResult, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200'
      }
    });
    
  } catch (error) {
    console.error('❌ Anime4up API Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || "حدث خطأ غير متوقع",
        timestamp: new Date().toISOString(),
        endpoint_usage: "GET /api/anime4up?query=كلمة_البحث",
        example: "/api/anime4up?query=One%20Piece"
      },
      { status: 500 }
    );
  }
}
