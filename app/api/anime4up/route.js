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
          example: "/api/anime4up?query=Boruto"
        },
        { status: 400 }
      );
    }

    const cleanQuery = query.trim();
    
    // استخدم API مباشر يعمل بثبات
    const apiUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://w1.anime4up.rest/?s=${cleanQuery}`)}`;
    
    console.log(`🔍 البحث عن: "${cleanQuery}"`);
    console.log(`🔗 API URL: ${apiUrl}`);

    // جلب البيانات من API موثوق
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      // إذا فشل، جرب طريقة أخرى
      console.log('🔄 تجربة طريقة احتياطية...');
      return await tryAlternativeMethod(cleanQuery);
    }

    const data = await response.json();
    
    if (!data || !data.contents) {
      throw new Error('لم يتم استلام محتوى HTML');
    }
    
    const htmlContent = data.contents;
    
    // استخراج البيانات بطريقة موثوقة
    const results = extractAnimeData(htmlContent, cleanQuery);
    
    const responseData = {
      success: true,
      site: 'Anime4up',
      search_query: cleanQuery,
      total_results: results.length,
      results: results,
      timestamp: new Date().toISOString(),
      api: 'Direct Fetch + Manual Parsing'
    };
    
    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600'
      }
    });
    
  } catch (error) {
    console.error('❌ خطأ في API:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: "فشل في جلب النتائج",
        message: error.message,
        query: query || 'غير محدد',
        timestamp: new Date().toISOString(),
        help: "جرب كلمات بحث مختلفة أو حاول لاحقاً"
      },
      { status: 500 }
    );
  }
}

// طريقة احتياطية
async function tryAlternativeMethod(query) {
  try {
    // محاكاة طلب متصفح كامل
    const url = `https://w1.anime4up.rest/?s=${encodeURIComponent(query)}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`الطريقة الاحتياطية فشلت: ${response.status}`);
    }

    const htmlContent = await response.text();
    
    if (!htmlContent || htmlContent.length < 1000) {
      throw new Error('محتوى HTML غير كافٍ');
    }
    
    const results = extractAnimeData(htmlContent, query);
    
    return NextResponse.json({
      success: true,
      site: 'Anime4up',
      search_query: query,
      total_results: results.length,
      results: results,
      timestamp: new Date().toISOString(),
      method: 'Alternative Direct Fetch'
    });
    
  } catch (error) {
    throw new Error(`الطريقة الاحتياطية: ${error.message}`);
  }
}

// دالة استخراج البيانات - مبسطة وموثوقة
function extractAnimeData(html, query) {
  const results = [];
  
  // تحليل HTML يدوياً بطريقة بسيطة
  const lines = html.split('\n');
  let currentAnime = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // البحث عن عناوين الأنمي
    if (line.includes('anime-card-title') && line.includes('h3')) {
      const titleMatch = line.match(/<h3[^>]*><a[^>]*>([^<]+)<\/a><\/h3>/);
      if (titleMatch) {
        currentAnime = {
          title: titleMatch[1].trim(),
          url: null,
          image: null,
          status: null,
          type: null
        };
      }
    }
    
    // البحث عن روابط
    if (currentAnime && !currentAnime.url && line.includes('href="https://w1.anime4up.rest/anime/')) {
      const urlMatch = line.match(/href="(https:\/\/w1\.anime4up\.rest\/anime\/[^"]+)"/);
      if (urlMatch) {
        currentAnime.url = urlMatch[1];
      }
    }
    
    // البحث عن صور
    if (currentAnime && !currentAnime.image && line.includes('src="https://w1.anime4up.rest/wp-content/')) {
      const imgMatch = line.match(/src="(https:\/\/w1\.anime4up\.rest\/wp-content\/[^"]+\.(?:png|jpg|jpeg|webp))"/i);
      if (imgMatch) {
        currentAnime.image = imgMatch[1];
      }
    }
    
    // البحث عن حالة الأنمي
    if (currentAnime && !currentAnime.status && line.includes('anime-card-status')) {
      const statusMatch = line.match(/<div[^>]*class="[^"]*anime-card-status[^"]*"[^>]*>([^<]+)</);
      if (statusMatch) {
        currentAnime.status = statusMatch[1].trim();
      }
    }
    
    // البحث عن نوع الأنمي
    if (currentAnime && !currentAnime.type && line.includes('anime-card-type')) {
      const typeMatch = line.match(/<div[^>]*class="[^"]*anime-card-type[^"]*"[^>]*>([^<]+)</);
      if (typeMatch) {
        currentAnime.type = typeMatch[1].trim();
      }
    }
    
    // إذا اكتملت البيانات، أضف إلى النتائج
    if (currentAnime && currentAnime.title && currentAnime.url) {
      results.push({
        id: results.length + 1,
        ...currentAnime,
        search_query: query
      });
      currentAnime = null;
    }
  }
  
  // إذا لم نجد نتائج، نبحث بشكل أوسع
  if (results.length === 0) {
    return searchAnimeFallback(html, query);
  }
  
  return results;
}

// طريقة احتياطية للبحث
function searchAnimeFallback(html, query) {
  const results = [];
  
  // البحث عن جميع روابط الأنمي في الصفحة
  const animeLinks = [...html.matchAll(/https:\/\/w1\.anime4up\.rest\/anime\/[^"']+/g)];
  const uniqueLinks = [...new Set(animeLinks.map(match => match[0]))];
  
  uniqueLinks.forEach((link, index) => {
    const nameFromUrl = link.split('/').filter(Boolean).pop();
    if (nameFromUrl) {
      const title = nameFromUrl
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
      
      results.push({
        id: index + 1,
        title: title,
        url: link,
        image: null,
        status: 'غير معروف',
        type: 'تم العثور من الرابط',
        search_query: query
      });
    }
  });
  
  // إذا لم نجد أي شيء، نعود بنتيجة افتراضية
  if (results.length === 0) {
    results.push({
      id: 1,
      title: `"${query}" - بحث على Anime4up`,
      url: `https://w1.anime4up.rest/?s=${encodeURIComponent(query)}`,
      image: null,
      status: 'ابحث في الموقع',
      type: 'رابط البحث',
      search_query: query
    });
  }
  
  return results;
        } 
