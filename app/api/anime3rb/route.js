// app/api/search/route.js
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "كلمة البحث مطلوبة",
        },
        { status: 400 }
      );
    }

    const searchUrl = `https://anime3rb.com/search?q=${encodeURIComponent(query)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
        'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-arch': '""',
        'sec-ch-ua-full-version': '"139.0.7339.0"',
        'sec-ch-ua-platform-version': '"10.0.0"',
        'sec-ch-ua-full-version-list': '"Chromium";v="139.0.7339.0", "Not;A=Brand";v="99.0.0.0"',
        'sec-ch-ua-bitness': '""',
        'sec-ch-ua-model': '"MAR-LX1A"',
        'sec-ch-ua-platform': '"Android"',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        'referer': 'https://anime3rb.com/',
        'accept-language': 'ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];

    // تعديل هذا الجزء حسب هيكل HTML لموقع anime3rb.com
    $('.anime-item, .search-result-item, .movie').each((index, element) => {
      const $element = $(element);
      
      // استخراج العنوان
      const title = $element.find('.title, h3, a').first().text().trim();
      
      // استخراج الرابط
      const url = $element.find('a').first().attr('href');
      const fullUrl = url.startsWith('http') ? url : `https://anime3rb.com${url}`;
      
      // استخراج الصورة
      const image = $element.find('img').first().attr('src');
      const fullImage = image.startsWith('http') ? image : `https://anime3rb.com${image}`;
      
      // استخراج التفاصيل الإضافية (التصنيف، الحلقات، etc.)
      const details = $element.find('.details, .info, .meta').text().trim();
      
      // استخراج الحالة (مكتمل، مستمر، etc.)
      const status = $element.find('.status, .state').text().trim();

      if (title && url) {
        results.push({
          id: `anime_${index}`,
          title: title,
          slug: url.split('/').pop() || '',
          url: fullUrl,
          image: fullImage,
          details: details,
          status: status,
          type: 'anime' // أو استخراجه من البيانات إذا متوفر
        });
      }
    });

    // إذا لم نجد نتائج بالطريقة الأولى، نجرب طريقة بديلة
    if (!results.length) {
      $('a[href*="/anime/"]').each((index, element) => {
        const $element = $(element);
        const title = $element.text().trim();
        const url = $element.attr('href');
        
        if (title && url && title.toLowerCase().includes(query.toLowerCase())) {
          const fullUrl = url.startsWith('http') ? url : `https://anime3rb.com${url}`;
          
          results.push({
            id: `anime_alt_${index}`,
            title: title,
            slug: url.split('/').pop() || '',
            url: fullUrl,
            image: '',
            details: '',
            status: '',
            type: 'anime'
          });
        }
      });
    }

    if (!results.length) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على أي انمي مطابق لنتيجة البحث",
          data: {
            query,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: {
        query,
        count: results.length,
        results,
      },
    });
  } catch (err) {
    console.error('Search error:', err);
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "حدث خطأ داخلي في السيرفر",
        error: err.message,
      },
      { status: 500 }
    );
  }
} 
