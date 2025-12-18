// app/api/olympustaff/manga/route.js (الجزء المعدل)

// دالة محسنة لاستخراج عنوان الفصل
function extractChapterTitle(text, chapterNumber) {
  if (!text) return `الفصل ${chapterNumber}`;
  
  // الاحتفاظ بالنص العربي الأساسي
  let cleanTitle = text.trim();
  
  // إزالة أرقام المشاهدات (مثل "1,950" أو "2,350")
  cleanTitle = cleanTitle.replace(/^\d{1,3}(?:,\d{3})*\s*/g, '');
  
  // إزالة "الفصل X" من البداية فقط (ليس من المنتصف)
  cleanTitle = cleanTitle.replace(new RegExp(`^الفصل\\s*${chapterNumber}\\s*[:-]?\\s*`, 'i'), '');
  
  // الاحتفاظ بالتواريخ وعدم إزالتها
  const dateMatch = cleanTitle.match(/(\d+\s*(?:years?|months?|days?|سنة|شهر|يوم)\s*(?:ago|قبل)?)/i);
  const dateText = dateMatch ? dateMatch[1] : null;
  
  // إزالة العلامات HTML المتبقية
  cleanTitle = cleanTitle
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // إزالة المسافات غير المرئية
    .trim();
  
  // إذا كان العنوان قصيراً جداً، نبحث عن نص أفضل
  if (cleanTitle.length < 3 || cleanTitle === 'الفصل') {
    // البحث عن نمط "الفصل X: العنوان"
    const pattern = new RegExp(`الفصل\\s*${chapterNumber}\\s*[:-]?\\s*(.+?)(?:\\s*\\d|$)`);
    const match = text.match(pattern);
    if (match && match[1]) {
      cleanTitle = match[1].trim();
    }
  }
  
  // إضافة التاريخ إذا كان موجوداً
  if (dateText && !cleanTitle.includes(dateText)) {
    cleanTitle = `${cleanTitle} (${dateText})`;
  }
  
  return cleanTitle || `الفصل ${chapterNumber}`;
}

// دالة محسنة لاستخراج التواريخ
function extractPublishDate(element) {
  // البحث في السمة data أو النص
  const dateElement = element.find('[data-date], [data-time], .date, .time, .published-date');
  if (dateElement.length) {
    const dateText = dateElement.text().trim();
    if (dateText) return dateText;
  }
  
  // البحث في النص الكامل للعنصر
  const text = element.text();
  const datePatterns = [
    /\d+\s*(?:years?|months?|days?|سنة|شهر|يوم)\s*(?:ago|قبل)/i,
    /\d{1,2}\/\d{1,2}\/\d{4}/,
    /\d{4}-\d{2}-\d{2}/,
    /(?:منذ|قبل)\s+\d+\s+(?:سنة|شهر|يوم|أسبوع)/,
    /\d+\s+(?:سنة|شهر|يوم|أسبوع)\s+(?:مضت|سابقة)/
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}

// دالة محسنة لاستخراج التصنيفات
function extractCategories(keywords, title, $) {
  const categories = new Set();
  
  // تنظيف وتقسيم الكلمات المفتاحية
  if (keywords) {
    // تقسيم بالنقاط الفاصلة والفواصل
    const keywordParts = keywords.split(/[،,.\n]/);
    
    keywordParts.forEach(part => {
      const cleanPart = part.trim();
      // أخذ الكلمات المفردة فقط (ليست جمل طويلة)
      if (cleanPart && cleanPart.length > 2 && cleanPart.length < 30) {
        // إزالة كلمات عامة
        const excludedWords = ['مانجا', 'مانهوا', 'مترجمة', 'موقع', 'مشاهدة', 'الفصول', 'اخر', 'best'];
        const isExcluded = excludedWords.some(word => 
          cleanPart.toLowerCase().includes(word.toLowerCase())
        );
        
        if (!isExcluded) {
          categories.add(cleanPart);
        }
      }
    });
  }
  
  // استخراج التصنيفات من عناصر HTML
  $('.tags a, .genres a, .categories a, [class*="tag"], [class*="genre"]').each((_, el) => {
    const category = $(el).text().trim();
    if (category && category.length > 1 && category.length < 30) {
      categories.add(category);
    }
  });
  
  // إضافة تصنيفات من كلمات العنوان
  const titleWords = title.toLowerCase().match(/[a-zA-Zء-ي]+/g) || [];
  const commonGenres = {
    'action': 'أكشن',
    'adventure': 'مغامرة',
    'fantasy': 'فانتازيا',
    'romance': 'رومانسي',
    'comedy': 'كوميدي',
    'drama': 'دراما',
    'supernatural': 'خارق',
    'leveling': 'مستويات',
    'tower': 'برج',
    'farming': 'زراعة',
    'solo': 'فردي',
    'rpg': 'لعبة أدوار'
  };
  
  titleWords.forEach(word => {
    Object.entries(commonGenres).forEach(([en, ar]) => {
      if (word === en || word === ar) {
        categories.add(ar);
      }
    });
  });
  
  // إضافة تصنيفات بناءً على الكلمات في الوصف
  const description = $('meta[name="description"]').attr('content') || '';
  const descWords = description.toLowerCase().match(/[a-zA-Zء-ي]+/g) || [];
  
  descWords.forEach(word => {
    Object.entries(commonGenres).forEach(([en, ar]) => {
      if (word.includes(en) || word.includes(ar)) {
        categories.add(ar);
      }
    });
  });
  
  return Array.from(categories).slice(0, 10); // الحد الأقصى 10 تصنيفات
}

// دالة محسنة لتنظيف الوصف
function cleanDescription(desc) {
  if (!desc) return '';
  
  // إزالة التكرارات مثل "Solo Farming In The TowerSolo Farming In The Tower"
  let cleanDesc = desc.replace(/(.+?)\1+/g, '$1');
  
  // إزالة علامات HTML
  cleanDesc = cleanDesc.replace(/<[^>]*>/g, '');
  
  // استبدال المسافات البيضاء
  cleanDesc = cleanDesc
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // أخذ أول جملة أو جملتين
  const sentences = cleanDesc.split(/[.!?،]/);
  if (sentences.length > 1) {
    cleanDesc = sentences.slice(0, 2).join('. ') + '.';
  }
  
  return cleanDesc;
}

// دالة محسنة لاستخراج الفصول (للحصول على بيانات كاملة)
function extractChaptersData($, mangaId) {
  const chapters = [];
  
  // أولاً: البحث في هيكل محدد للفصول (إذا كان موجوداً)
  const chapterSelectors = [
    '.chapter-item',
    '.chapter-list-item',
    '.episode-item',
    '[data-chapter]',
    'tr[data-chapter-id]',
    'li[data-chapter-number]'
  ];
  
  chapterSelectors.forEach(selector => {
    $(selector).each((_, el) => {
      const element = $(el);
      extractCompleteChapterData(element, mangaId, chapters);
    });
  });
  
  // ثانياً: إذا لم نجد، نبحث في جميع الروابط
  if (chapters.length === 0) {
    $('a').each((_, link) => {
      const element = $(link);
      const href = element.attr('href') || '';
      
      // التحقق مما إذا كان الرابط لفصل
      if (href.includes(`/series/${mangaId}/`) && 
          (href.match(/\/(\d+)$/) || href.includes('/chapter'))) {
        
        const chapterMatch = href.match(/\/(\d+)$/) || href.match(/\/chapter-?(\d+)/);
        if (chapterMatch) {
          const chapterNumber = parseInt(chapterMatch[1]);
          const text = element.text().trim();
          
          // الحصول على النص الكامل (بما في ذلك العناصر الفرعية)
          const fullText = element.find('*').addBack().contents()
            .filter(function() {
              return this.nodeType === 3; // نوع النص فقط
            })
            .map(function() {
              return $(this).text().trim();
            })
            .get()
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (!chapters.find(ch => ch.number === chapterNumber)) {
            const chapterData = {
              number: chapterNumber,
              title: extractChapterTitle(fullText || text, chapterNumber),
              url: ensureAbsoluteUrl(href),
              views: extractViewsCount(fullText || text),
              date: extractPublishDate(element),
              source: 'link-extraction'
            };
            
            // إذا كان العنوان فارغاً، نحاول الحصول على نص من العناصر المجاورة
            if (!chapterData.title || chapterData.title === `الفصل ${chapterNumber}`) {
              const parentText = element.parent().text().trim();
              if (parentText && parentText.length > text.length) {
                chapterData.title = extractChapterTitle(parentText, chapterNumber);
              }
            }
            
            chapters.push(chapterData);
          }
        }
      }
    });
  }
  
  // إزالة التكرارات والترتيب
  return removeDuplicates(chapters.sort((a, b) => b.number - a.number));
}

// دالة جديدة لاستخراج بيانات فصل كاملة
function extractCompleteChapterData(element, mangaId, chaptersArray) {
  const text = element.text().trim();
  if (!text) return;
  
  // استخراج رقم الفصل من data attribute أولاً
  let chapterNumber = element.attr('data-chapter') || 
                     element.attr('data-chapter-number') ||
                     element.attr('data-episode');
  
  if (!chapterNumber) {
    // استخراج من النص أو الرابط
    const link = element.find('a').first();
    const href = link.attr('href') || '';
    chapterNumber = extractChapterNumber(text, href, mangaId);
  } else {
    chapterNumber = parseInt(chapterNumber);
  }
  
  if (!chapterNumber) return;
  
  // استخراج الرابط
  const link = element.find('a').first();
  const href = link.attr('href') || '';
  
  // استخراج البيانات من data attributes
  const views = element.attr('data-views') || extractViewsCount(text);
  const date = element.attr('data-date') || element.attr('data-published') || extractPublishDate(element);
  
  // استخراج العنوان من data attribute أو النص
  let title = element.attr('data-title') || 
              element.find('.chapter-title, .episode-title').text().trim();
  
  if (!title || title.length < 2) {
    title = extractChapterTitle(text, chapterNumber);
  }
  
  if (!chaptersArray.find(ch => ch.number === chapterNumber)) {
    chaptersArray.push({
      number: chapterNumber,
      title: title,
      url: ensureAbsoluteUrl(href) || `https://olympustaff.com/series/${mangaId}/chapter-${chapterNumber}`,
      views: views ? parseInt(views) : null,
      date: date,
      rawText: text.replace(/\s+/g, ' ').trim(),
      source: 'structured-data'
    });
  }
    } 
