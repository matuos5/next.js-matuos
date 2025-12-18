// app/api/olympustaff/manga/route.js (الجزء المعدل)

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const mangaId = searchParams.get("id");
    const getAllChapters = searchParams.get("all") === "true"; // معلمة جديدة

    if (!mangaId) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى اضافة معرف المانجا في باراميتر id",
          examples: [
            "/api/olympustaff/manga?id=SL",
            "/api/olympustaff/manga?id=SL&all=true" // لجلب جميع الفصول
          ]
        },
        { status: 400 }
      );
    }

    // الروابط المحتملة لصفحة الفصول الكاملة
    const possibleChapterUrls = [
      `https://olympustaff.com/series/${mangaId}/chapters`,
      `https://olympustaff.com/series/${mangaId}/all-chapters`,
      `https://olympustaff.com/series/${mangaId}?view=all`,
      `https://olympustaff.com/series/${mangaId}?page=all`,
      `https://olympustaff.com/series/${mangaId}` // الصفحة الرئيسية (للفصول المحدودة)
    ];

    let allChapters = [];
    let chaptersSource = 'main-page';

    // إذا طلب المستخدم جميع الفصول
    if (getAllChapters) {
      console.log(`🔍 محاولة جلب جميع الفصول للمانجا: ${mangaId}`);
      
      // تجربة جميع الروابط المحتملة
      for (const chapterUrl of possibleChapterUrls) {
        try {
          const chapters = await fetchChaptersFromUrl(chapterUrl, mangaId);
          if (chapters.length > allChapters.length) {
            allChapters = chapters;
            chaptersSource = chapterUrl;
            console.log(`✅ تم العثور على ${chapters.length} فصل من: ${chapterUrl}`);
            
            // إذا وجدنا أكثر من 20 فصل، نتوقف (على الأرجح وجدنا الصفحة الكاملة)
            if (chapters.length > 20) {
              break;
            }
          }
        } catch (error) {
          console.log(`❌ فشل جلب الفصول من: ${chapterUrl}`);
          continue;
        }
      }
      
      // إذا لم نجد فصولاً كافية، نستخدم الطريقة التقليدية
      if (allChapters.length <= 5) {
        console.log(`⚠️ لم نجد صفحة الفصول الكاملة، نستخدم الصفحة الرئيسية`);
        allChapters = await fetchChaptersFromUrl(possibleChapterUrls[4], mangaId);
      }
    } else {
      // جلب الفصول المحدودة فقط (السلوك الافتراضي)
      allChapters = await fetchChaptersFromUrl(possibleChapterUrls[4], mangaId);
    }

    // ... باقي الكود الموجود سابقاً ...

    // إضافة معلومات الفصول إلى البيانات
    const mangaData = extractMangaDetails($, mangaId, html);
    mangaData.chapters = allChapters;
    mangaData.chaptersInfo = {
      total: allChapters.length,
      source: chaptersSource,
      hasMore: allChapters.length > 50, // افتراضياً إذا كان أكثر من 50 فصل فهناك المزيد
      limitedView: !getAllChapters && allChapters.length <= 10
    };

    // إذا كانت الفصول محدودة، نضيف نصيحة للمستخدم
    if (!getAllChapters && allChapters.length <= 10) {
      mangaData.note = `⚠️ يتم عرض ${allChapters.length} فصل فقط. استخدم &all=true لجلب جميع الفصول`;
    }

    // ... باقي الكود ...

  } catch (err) {
    // ... معالجة الأخطاء ...
  }
}

// دالة جديدة لجلب الفصول من رابط محدد
async function fetchChaptersFromUrl(url, mangaId) {
  const proxyServices = [
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    // ... باقي خدمات البروكسي
  ];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
    // ... باقي الهيدرات
  };

  let chapters = [];

  for (const getProxyUrl of proxyServices) {
    try {
      const proxyUrl = getProxyUrl(url);
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: headers,
        cache: 'no-store'
      });

      if (!response.ok) continue;

      const html = await response.text();
      
      // تخطي صفحات Cloudflare
      if (html.includes('Just a moment') || html.includes('Enable JavaScript')) {
        continue;
      }

      const $ = cheerio.load(html);
      chapters = extractChaptersData($, mangaId);
      
      if (chapters.length > 0) {
        break;
      }
    } catch (error) {
      continue;
    }
  }

  return chapters;
}

// دالة محسنة لاستخراج الفصول مع دعم الترحيم (Pagination)
function extractChaptersData($, mangaId) {
  const chapters = [];
  
  // البحث في جداول الفصول (شائع في صفحات الفصول الكاملة)
  $('table tbody tr, .table tbody tr, .chapters-table tr').each((_, row) => {
    const element = $(row);
    extractChapterFromRow(element, mangaId, chapters);
  });
  
  // إذا لم نجد في الجداول، نبحث في القوائم
  if (chapters.length === 0) {
    $('.chapter-list li, .chapters-list li, [class*="chapter-item"]').each((_, li) => {
      const element = $(li);
      extractChapterFromRow(element, mangaId, chapters);
    });
  }
  
  // البحث في جميع الروابط
  if (chapters.length === 0) {
    $('a').each((_, link) => {
      const element = $(link);
      const href = element.attr('href') || '';
      const text = element.text().trim();
      
      // البحث عن روابط الفصول
      if (href.includes('/chapter') || href.includes(`/series/${mangaId}/`)) {
        const chapterMatch = href.match(/\/chapter-?(\d+)/) || 
                            href.match(/\/(\d+)(?:\/|$)/);
        
        if (chapterMatch) {
          const chapterNumber = parseInt(chapterMatch[1]);
          
          if (!chapters.find(ch => ch.number === chapterNumber)) {
            const cleanTitle = text
              .replace(/\d{1,3}(?:,\d{3})*/g, '')
              .replace(/الفصل\s*\d+\s*[:-]?\s*/i, '')
              .trim();
            
            chapters.push({
              number: chapterNumber,
              title: cleanTitle || `الفصل ${chapterNumber}`,
              url: ensureAbsoluteUrl(href),
              source: 'link-extraction'
            });
          }
        }
      }
    });
  }
  
  // البحث في محتوى الصفحة النصي (آخر محاولة)
  if (chapters.length === 0) {
    const pageText = $('body').text();
    const chapterRegex = /الفصل\s*(\d+)(?:\s*[:-]?\s*(.*?))?(?=\s|$|الفصل|\n)/gi;
    
    let match;
    while ((match = chapterRegex.exec(pageText)) !== null) {
      const chapterNumber = parseInt(match[1]);
      const chapterTitle = (match[2] || '').trim();
      
      if (!chapters.find(ch => ch.number === chapterNumber)) {
        chapters.push({
          number: chapterNumber,
          title: chapterTitle || `الفصل ${chapterNumber}`,
          url: `https://olympustaff.com/series/${mangaId}/chapter-${chapterNumber}`,
          source: 'text-regex'
        });
      }
    }
  }
  
  // ترتيب الفصول تنازلياً وإزالة التكرارات
  return removeDuplicates(chapters.sort((a, b) => b.number - a.number));
}

// دالة مساعدة لاستخراج فصل من صف
function extractChapterFromRow(element, mangaId, chaptersArray) {
  const text = element.text().trim();
  if (!text || text.length < 3) return;
  
  const link = element.find('a').first();
  const href = link.attr('href') || '';
  
  // استخراج رقم الفصل
  const chapterNumber = extractChapterNumber(text, href, mangaId);
  if (!chapterNumber) return;
  
  // تنظيف العنوان
  const chapterTitle = extractChapterTitle(text, chapterNumber);
  
  // استخراج البيانات الإضافية
  const views = extractViewsCount(text);
  const date = extractPublishDate(element);
  
  // تجنب التكرار
  if (!chaptersArray.find(ch => ch.number === chapterNumber)) {
    chaptersArray.push({
      number: chapterNumber,
      title: chapterTitle,
      url: ensureAbsoluteUrl(href) || `https://olympustaff.com/series/${mangaId}/chapter-${chapterNumber}`,
      views: views,
      date: date,
      rawText: text.replace(/\s+/g, ' ').trim()
    });
  }
}

// دالة لإزالة الفصول المكررة
function removeDuplicates(chapters) {
  const unique = [];
  const seen = new Set();
  
  for (const chapter of chapters) {
    if (!seen.has(chapter.number)) {
      seen.add(chapter.number);
      unique.push(chapter);
    }
  }
  
  return unique;
                                          } 
