// app/api/search-anime/route.js
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "Boruto";
    const apiKey = process.env.API_KEY || "free";

    if (!query) {
      return NextResponse.json(
        {
          success: false,
          error: "يرجى إضافة query كمعامل في الرابط",
          example: "/api/search-anime?query=Boruto"
        },
        { status: 400 }
      );
    }

    const targetUrl = `https://w1.anime4up.rest/?s=${encodeURIComponent(query)}`;
    const bypassApi = `https://dark-v2-api.vercel.app/api/v1/tools/bypass?url=${encodeURIComponent(targetUrl)}`;

    const response = await fetch(bypassApi, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json, text/html, */*',
        'x-api-key': apiKey
      },
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      throw new Error(`فشل في جلب البيانات: ${response.status}`);
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
      return NextResponse.json({
        success: false,
        error: "لم يتم العثور على محتوى HTML في الاستجابة",
        raw_data: data
      }, { status: 500 });
    }
    
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM(htmlContent);
    const { document } = dom.window;
    
    const results = [];
    
    const animeCards = document.querySelectorAll('.anime-card-themex');
    
    animeCards.forEach((el, i) => {
      const titleEl = el.querySelector('.anime-card-title h3 a');
      const title = titleEl ? titleEl.textContent.trim() : '';
      
      const linkEl = el.querySelector('a.overlay');
      const link = linkEl ? linkEl.getAttribute('href') : null;
      
      const imgEl = el.querySelector('img');
      const image = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src')) : null;
      
      const statusEl = el.querySelector('.anime-card-status');
      const status = statusEl ? statusEl.textContent.trim() : null;
      
      const typeEl = el.querySelector('.anime-card-type');
      const type = typeEl ? typeEl.textContent.trim() : null;
      
      const viewsEl = el.querySelector('.anime-card-views');
      const views = viewsEl ? viewsEl.textContent.trim() : null;
      
      const descEl = el.querySelector('.anime-card-title');
      const description = descEl ? (descEl.getAttribute('data-content') || '') : '';
      
      const yearEl = el.querySelector('.anime-card-year');
      const year = yearEl ? yearEl.textContent.trim() : null;
      
      if (title) {
        results.push({
          id: i + 1,
          title: title,
          url: link,
          image: image,
          status: status,
          type: type,
          views: views,
          year: year,
          description: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
          search_query: query
        });
      }
    });
    
    const finalResult = {
      site: 'Anime4up',
      search_query: query,
      total_results: results.length,
      results: results,
      success: true,
      timestamp: new Date().toISOString(),
      api_version: "1.0",
      documentation: "استخدم query معلمة للبحث عن الأنمي"
    };
    
    return NextResponse.json(finalResult, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200'
      }
    });
    
  } catch (error) {
    console.error('Search API Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || "حدث خطأ غير متوقع",
        timestamp: new Date().toISOString(),
        endpoint: "/api/search-anime?query=YOUR_SEARCH_QUERY"
      },
      { status: 500 }
    );
  }
        }
