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
          example: "/api/anime4up?query=Boruto",
          popular_searches: ["Naruto", "One Piece", "Attack on Titan", "Demon Slayer"]
        },
        { status: 400 }
      );
    }

    const searchQuery = query.trim();
    const targetUrl = `https://w1.anime4up.rest/?s=${encodeURIComponent(searchQuery)}`;
    const bypassApi = `https://dark-v2-api.vercel.app/api/v1/tools/bypass?url=${encodeURIComponent(targetUrl)}`;

    console.log(`🔍 البحث عن: "${searchQuery}"`);
    console.log(`🔗 Bypass API: ${bypassApi}`);

    // جلب البيانات من bypass API
    const response = await fetch(bypassApi, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json, text/html, */*',
        'Cache-Control': 'no-cache'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`❌ فشل في جلب البيانات من bypass API: ${response.status}`);
    }

    const data = await response.json();
    
    let htmlContent = '';
    
    if (data && data.status) {
      if (data.data && data.data.fullHtml) {
        htmlContent = data.data.fullHtml;
      } else if (data.data && data.data.htmlPreview) {
        htmlContent = data.data.htmlPreview;
      } else if (data.html) {
        htmlContent = data.html;
      }
    }
    
    if (!htmlContent) {
      throw new Error('❌ لم يتم العثور على محتوى HTML في الاستجابة');
    }
    
    console.log(`📏 طول HTML: ${htmlContent.length} حرف`);
    
    // استيراد cheerio ديناميكياً
    const cheerio = await import('cheerio');
    const $ = cheerio.default.load(htmlContent);
    
    const results = [];
    
    // استخراج النتائج بنفس طريقة Node.js
    $('.anime-card-themex').each((i, el) => {
      const $el = $(el);
      
      const title = $el.find('.anime-card-title h3 a').text().trim();
      const link = $el.find('a.overlay').attr('href');
      const image = $el.find('img').attr('src') || $el.find('img').attr('data-src');
      const status = $el.find('.anime-card-status').text().trim();
      const type = $el.find('.anime-card-type').text().trim();
      const views = $el.find('.anime-card-views').text().trim();
      const description = $el.find('.anime-card-title').attr('data-content') || '';
      const year = $el.find('.anime-card-year').text().trim();
      
      if (title) {
        results.push({
          id: i + 1,
          title: title,
          url: link || null,
          image: image || null,
          status: status || null,
          type: type || null,
          views: views || null,
          year: year || null,
          description: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
          search_query: searchQuery
        });
        
        console.log(`✅ ${i + 1}. ${title}`);
      }
    });
    
    const finalResult = {
      site: 'Anime4up',
      search_query: searchQuery,
      total_results: results.length,
      results: results,
      success: true,
      timestamp: new Date().toISOString(),
      api_version: "1.0",
      documentation: "استخدم query معلمة للبحث عن الأنمي"
    };
    
    console.log(`🎉 تم العثور على ${results.length} نتيجة`);
    
    return NextResponse.json(finalResult, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200'
      }
    });
    
  } catch (error) {
    console.error('❌ خطأ في Anime4up API:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || "حدث خطأ غير متوقع",
        timestamp: new Date().toISOString(),
        help: "استخدم /api/anime4up?query=كلمة_البحث"
      },
      { status: 500 }
    );
  }
      } 
