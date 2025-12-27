// app/api/anime4up/route.js
import { NextResponse } from "next/server";

// دالة لاستخراج البيانات من HTML بدون مكتبات
function extractAnimeData(html, query) {
  const results = [];
  
  // إزالة الأسطر الجديدة والمسافات الزائدة لتسهيل البحث
  const cleanHtml = html.replace(/\s+/g, ' ').replace(/>\s+</g, '><');
  
  // البحث عن جميع بطاقات الأنمي
  const animeCardStart = '<div class="anime-card-themex"';
  let startIndex = 0;
  let cardCount = 0;
  
  while ((startIndex = cleanHtml.indexOf(animeCardStart, startIndex)) !== -1) {
    cardCount++;
    
    // إيجاد نهاية البطاقة
    let depth = 0;
    let endIndex = startIndex;
    let inTag = false;
    
    for (let i = startIndex; i < cleanHtml.length; i++) {
      if (cleanHtml[i] === '<') {
        if (cleanHtml[i + 1] === '/') {
          depth--;
        } else if (cleanHtml[i + 1] !== '!' && cleanHtml[i + 1] !== '?') {
          depth++;
        }
        inTag = true;
      } else if (cleanHtml[i] === '>') {
        inTag = false;
      }
      
      // عندما نعود للمستوى 0 ونكون خارج tag، هذه نهاية البطاقة
      if (depth === 0 && !inTag) {
        endIndex = i;
        break;
      }
    }
    
    const cardHtml = cleanHtml.substring(startIndex, endIndex + 1);
    startIndex = endIndex + 1;
    
    // استخراج البيانات من البطاقة
    const anime = extractFromCard(cardHtml);
    if (anime.title) {
      anime.id = results.length + 1;
      anime.search_query = query;
      results.push(anime);
    }
  }
  
  console.log(`🔍 تم العثور على ${cardCount} بطاقة أنمي`);
  
  return results;
}

// دالة لاستخراج البيانات من بطاقة واحدة
function extractFromCard(cardHtml) {
  const anime = {
    title: '',
    url: null,
    image: null,
    status: null,
    type: null,
    views: null
  };
  
  // استخراج العنوان
  const titleMatch = cardHtml.match(/<h3><a[^>]*>([^<]+)<\/a><\/h3>/);
  if (titleMatch) {
    anime.title = titleMatch[1].trim();
  }
  
  // استخراج الرابط
  const linkMatch = cardHtml.match(/<a[^>]*class="[^"]*overlay[^"]*"[^>]*href="([^"]*)"/);
  if (linkMatch) {
    anime.url = linkMatch[1];
  }
  
  // استخراج الصورة
  const imgMatch = cardHtml.match(/<img[^>]*src="([^"]*)"[^>]*>/);
  if (imgMatch) {
    anime.image = imgMatch[1];
  } else {
    // محاولة الحصول من data-src
    const dataSrcMatch = cardHtml.match(/<img[^>]*data-src="([^"]*)"[^>]*>/);
    if (dataSrcMatch) {
      anime.image = dataSrcMatch[1];
    }
  }
  
  // استخراج الحالة
  const statusMatch = cardHtml.match(/<div[^>]*class="[^"]*anime-card-status[^"]*"[^>]*>([^<]*)</);
  if (statusMatch) {
    anime.status = statusMatch[1].trim();
  }
  
  // استخراج النوع
  const typeMatch = cardHtml.match(/<div[^>]*class="[^"]*anime-card-type[^"]*"[^>]*>([^<]*)</);
  if (typeMatch) {
    anime.type = typeMatch[1].trim();
  }
  
  // استخراج المشاهدات
  const viewsMatch = cardHtml.match(/<div[^>]*class="[^"]*anime-card-views[^"]*"[^>]*>([^<]*)</);
  if (viewsMatch) {
    anime.views = viewsMatch[1].trim();
  }
  
  return anime;
}

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
          popular_searches: [
            "Boruto",
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

    const cleanQuery = query.trim();
    const targetUrl = `https://w1.anime4up.rest/?s=${encodeURIComponent(cleanQuery)}`;
    const bypassApi = `https://dark-v2-api.vercel.app/api/v1/tools/bypass?url=${encodeURIComponent(targetUrl)}`;
    
    console.log(`🔍 بدء البحث عن: "${cleanQuery}"`);

    // جلب البيانات
    const fetchResponse = await fetch(bypassApi, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json'
      },
      next: { revalidate: 3600 }
    });

    if (!fetchResponse.ok) {
      throw new Error(`❌ فشل في جلب البيانات: ${fetchResponse.status}`);
    }

    const data = await fetchResponse.json();
    
    // التحقق من البيانات
    if (!data || typeof data !== 'object') {
      throw new Error('❌ استجابة غير صالحة من الـ API');
    }
    
    // الحصول على HTML
    let htmlContent = '';
    
    if (data.data?.fullHtml) {
      htmlContent = data.data.fullHtml;
    } else if (data.data?.htmlPreview) {
      htmlContent = data.data.htmlPreview;
    } else if (data.html) {
      htmlContent = data.html;
    } else if (data.data?.content) {
      htmlContent = data.data.content;
    } else {
      // البحث عن HTML في أي مكان في الكائن
      const jsonStr = JSON.stringify(data);
      const htmlMatch = jsonStr.match(/<!DOCTYPE[^>]*>[\s\S]*<\/html>/);
      if (htmlMatch) {
        htmlContent = htmlMatch[0];
      }
    }
    
    if (!htmlContent || htmlContent.length < 100) {
      console.log('❌ HTML قصير جداً:', htmlContent?.substring(0, 200));
      throw new Error('❌ لم يتم العثور على محتوى HTML كافي');
    }
    
    console.log(`📏 طول HTML المستلم: ${htmlContent.length} حرف`);
    
    // استخراج البيانات
    const results = extractAnimeData(htmlContent, cleanQuery);
    
    // التحقق إذا كان هناك نتائج
    if (results.length === 0) {
      // طريقة بديلة: البحث عن أي رابط أنمي
      const animeUrlRegex = /https:\/\/w1\.anime4up\.rest\/anime\/[^"'\s]+/g;
      const animeUrls = htmlContent.match(animeUrlRegex) || [];
      
      const uniqueUrls = [...new Set(animeUrls)];
      uniqueUrls.forEach((url, index) => {
        const nameFromUrl = url.split('/').filter(Boolean).pop().replace(/-/g, ' ');
        const formattedName = nameFromUrl.replace(/\b\w/g, l => l.toUpperCase());
        
        results.push({
          id: index + 1,
          title: formattedName,
          url: url,
          image: null,
          status: 'من الرابط',
          type: 'رابط',
          search_query: cleanQuery,
          note: 'تم استخراج من الروابط'
        });
      });
    }
    
    // إعداد النتيجة
    const responseData = {
      success: true,
      site: 'Anime4up',
      search_query: cleanQuery,
      search_url: targetUrl,
      total_results: results.length,
      results: results,
      timestamp: new Date().toISOString(),
      api_info: {
        endpoint: "/api/anime4up",
        version: "1.2",
        method: "GET",
        parameter: "query",
        example: "/api/anime4up?query=Boruto"
      }
    };
    
    console.log(`✅ تم العثور على ${results.length} نتيجة`);
    
    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200'
      }
    });
    
  } catch (error) {
    console.error('❌ خطأ في API:', error.message);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        query: query || 'غير محدد',
        timestamp: new Date().toISOString(),
        help: "استخدم /api/anime4up?query=كلمة_البحث"
      },
      { status: 500 }
    );
  }
    } 
