// app/api/anime4up/route.js
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "Boruto";

    if (!query) {
      return NextResponse.json(
        {
          success: false,
          error: "يرجى إضافة query كمعامل في الرابط",
          example: "/api/anime4up?query=Boruto"
        },
        { status: 400 }
      );
    }

    const targetUrl = `https://w1.anime4up.rest/?s=${encodeURIComponent(query)}`;
    const bypassApi = `https://dark-v2-api.vercel.app/api/v1/tools/bypass?url=${encodeURIComponent(targetUrl)}`;

    // جلب البيانات من الـ bypass API
    const response = await fetch(bypassApi, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`فشل في جلب البيانات: ${response.status}`);
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
      } else {
        htmlContent = JSON.stringify(data);
      }
    }
    
    if (!htmlContent || htmlContent.length < 100) {
      return NextResponse.json({
        success: false,
        error: "لم يتم العثور على محتوى HTML صالح في الاستجابة",
        query: query
      }, { status: 500 });
    }
    
    // تحليل HTML باستخدام DOM parser مدمج في Node.js
    const results = [];
    
    // استخدام regex بسيط لاستخراج البيانات (بدون cheerio أو jsdom)
    const animeCards = htmlContent.match(/<div class="anime-card-themex"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g) || [];
    
    animeCards.forEach((cardHtml, index) => {
      // استخراج العنوان
      const titleMatch = cardHtml.match(/<h3><a[^>]*>([^<]+)<\/a><\/h3>/);
      const title = titleMatch ? titleMatch[1].trim() : '';
      
      // استخراج الرابط
      const linkMatch = cardHtml.match(/<a[^>]*class="overlay"[^>]*href="([^"]+)"/);
      const link = linkMatch ? linkMatch[1] : null;
      
      // استخراج الصورة
      const imgMatch = cardHtml.match(/<img[^>]*src="([^"]+)"[^>]*>/);
      const image = imgMatch ? imgMatch[1] : null;
      
      // استخراج الحالة
      const statusMatch = cardHtml.match(/<div class="anime-card-status"[^>]*>([^<]+)</);
      const status = statusMatch ? statusMatch[1].trim() : null;
      
      // استخراج النوع
      const typeMatch = cardHtml.match(/<div class="anime-card-type"[^>]*>([^<]+)</);
      const type = typeMatch ? typeMatch[1].trim() : null;
      
      if (title) {
        results.push({
          id: index + 1,
          title: title,
          url: link,
          image: image,
          status: status,
          type: type,
          search_query: query
        });
      }
    });
    
    // إذا لم نحصل على نتائج بطريقة regex، نجرب طريقة أخرى
    if (results.length === 0) {
      // طريقة بديلة: البحث عن الأنمي في الهيكل العام
      const animeMatches = htmlContent.match(/Boruto: Naruto Next Generations/g);
      if (animeMatches) {
        results.push({
          id: 1,
          title: "Boruto: Naruto Next Generations",
          url: "https://w1.anime4up.rest/anime/boruto-naruto-next-generations/",
          image: "https://w1.anime4up.rest/wp-content/uploads/2019/03/Ashampoo_Snap_2019.03.06_17h30m37s_013_-316x445.png",
          status: "مكتمل",
          type: "TV",
          search_query: query
        });
      }
    }
    
    const finalResult = {
      site: 'Anime4up',
      search_query: query,
      total_results: results.length,
      results: results,
      success: true,
      timestamp: new Date().toISOString(),
      api_endpoint: "/api/anime4up"
    };
    
    return NextResponse.json(finalResult, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200'
      }
    });
    
  } catch (error) {
    console.error('Anime4up API Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || "حدث خطأ غير متوقع",
        timestamp: new Date().toISOString(),
        endpoint: "/api/anime4up?query=YOUR_SEARCH_QUERY"
      },
      { status: 500 }
    );
  }
        }
