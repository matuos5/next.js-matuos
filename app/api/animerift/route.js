// app/api/animerrift/search/route.js

import { NextResponse } from "next/server";
import axios from "axios";

// تثبيت axios إذا لم يكن مثبتاً: npm install axios

export async function GET(req) {
  try {
    // استخراج المعلمات من URL
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");
    const page = searchParams.get("page") || "0";
    const sortBy = searchParams.get("sort_by") || "release_year";
    const sortDirection = searchParams.get("sort_direction") || "1";
    const textDirection = searchParams.get("text_direction") || "jp";

    if (!query) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى إضافة اسم أنمي في باراميتر q",
        },
        { status: 400 }
      );
    }

    // إعداد الطلب كما هو بالضبط من الـ CURL
    const config = {
      method: 'POST',
      url: `https://gateway.anime-rift.com/api/v3/library/search?page=${page}&sort_by=${sortBy}&sort_direction=${sortDirection}&text_direction=${textDirection}`,
      headers: {
        'User-Agent': 'Dart/3.8 (dart:io)',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
        'content-type': 'application/json; charset=UTF-8',
        'x-device-release-version': '3.7.3',
        'integrity': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzY29wZSI6IkFOSU1FLkxJQlJBUlkuU0VBUkNIIiwiZXhwIjoxNzY0ODM5NTQ5LCJpYXQiOjE3NjQ4Mzk1Mzl9.ZmAkx9UIisvTC4WKtkjTK0SxXQ5KRFVqMErmPBDzOcU',
        'x-device-timezone': '2025-12-04T12:12:19.344833',
        'x-device-id': 'eJ1Ou9KbTmy1ohBFa4XzNu:APA91bGd3t2lyXGK0YjR2wkr_rvqcME8kvhO6tlj22q8HFMG2BcVUyfeQX6z9RJIWct4bDv3ulO8t0AQHFLCcAa_o1_DdwRNR7-NacCTIyRb46yt0prWV5k',
        'x-device-language': 'ar',
        'x-platform': 'Mobile'
      },
      data: {
        query: query
      },
      // إعدادات إضافية لـ axios
      timeout: 30000,
      maxRedirects: 5,
      decompress: true // لتفكيك gzip
    };

    console.log("Sending request with config:", {
      url: config.url,
      method: config.method,
      headers: config.headers,
      data: config.data
    });

    const response = await axios(config);
    const data = response.data;

    console.log("Response received:", {
      status: response.status,
      headers: response.headers,
      dataStructure: {
        hasItems: Array.isArray(data?.items),
        itemsCount: data?.items?.length,
        keys: Object.keys(data || {})
      }
    });

    // معالجة البيانات
    let results = [];
    let paginationInfo = {};
    
    if (data && data.items && Array.isArray(data.items)) {
      results = data.items.map((item) => ({
        id: item._id || null,
        title: item.title || null,
        alternativeTitle: item.alternative_title || null,
        releaseStatus: item.release_status || null,
        contentType: item.content_type || null,
        genres: item.static_genres || [],
        ageRating: item.ageRating || null,
        availableEpisodes: item.available_episodes || null,
        releaseYear: item.release_year || null,
        releaseSeason: item.realease_season || null,
        image: item.medium_picture || null,
        malVotes: item.myAnimeList_votes || null,
        malRating: item.myAnimeList_rating || null,
        latestEpisode: item.latest_episode_released?.episode_number || null,
        malFavorites: item.mal_favorites || null,
      }));
      
      paginationInfo = {
        totalSize: data.size || 0,
        currentPage: data.page || 0,
        limit: data.limit || 30,
        hasNext: data.hasNext || false,
        doYouMean: data.doYouMean || null
      };
    }

    if (results.length === 0) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على أي أنمي مطابق لنتيجة البحث",
          data: {
            query,
            searchParams: {
              page,
              sortBy,
              sortDirection,
              textDirection,
            },
            apiResponse: {
              structure: Object.keys(data || {}),
              sample: data?.items?.[0] || data?.[0] || data
            }
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
        searchParams: {
          page,
          sortBy,
          sortDirection,
          textDirection,
        },
        count: results.length,
        pagination: paginationInfo,
        results,
      },
    });

  } catch (error) {
    console.error("Axios error details:", {
      message: error.message,
      code: error.code,
      response: {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers
      },
      request: {
        method: error.request?.method,
        url: error.request?.url,
        headers: error.request?.headers
      }
    });

    if (error.response) {
      // الخادم رد برسالة خطأ
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: error.response.status,
          msg: `خطأ من خادم Anime Rift (${error.response.status})`,
          error: error.response.data,
        },
        { status: error.response.status }
      );
    } else if (error.request) {
      // تم إرسال الطلب ولكن لم تصل استجابة
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 504,
          msg: "انتهت مهلة الاتصال بخادم Anime Rift",
          error: error.message,
        },
        { status: 504 }
      );
    } else {
      // خطأ في إعداد الطلب
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 500,
          msg: "خطأ في إعداد الطلب",
          error: error.message,
        },
        { status: 500 }
      );
    }
  }
            }          sort_by: sortBy,
          sort_direction: sortDirection,
          text_direction: textDirection
        },
        headers: {
          "User-Agent": "Dart/3.8 (dart:io)",
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json; charset=UTF-8",
          "x-device-release-version": "3.7.3",
          "integrity": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzY29wZSI6IkFOSU1FLkxJQlJBUlkuU0VBUkNIIiwiZXhwIjoxNzY0ODM5NTQ5LCJpاذن}:jأوإلى{دةك",
          "x-device-timezone": deviceTimezone,
          "x-device-id": deviceId,
          "x-device-language": "ar",
          "x-platform": "Mobile"
        }
      }
    );

    const data = response.data;
    
    // تنسيق النتائج بناءً على الهيكل الجديد
    let results = [];
    let paginationInfo = {};

    if (data && Array.isArray(data.items)) {
      results = data.items.map((item) => ({
        id: item._id || null,
        title: item.title || null,
        alternativeTitle: item.alternative_title || null,
        releaseStatus: item.release_status || null,
        contentType: item.content_type || null,
        genres: item.static_genres || [],
        ageRating: item.ageRating || null,
        availableEpisodes: item.available_episodes || null,
        releaseYear: item.release_year || null,
        releaseSeason: item.realease_season || null,
        image: item.medium_picture || null,
        malVotes: item.myAnimeList_votes || null,
        malRating: item.myAnimeList_rating || null,
        latestEpisode: item.latest_episode_released?.episode_number || null,
        malFavorites: item.mal_favorites || null,
      }));
      
      // معلومات التقسيم
      paginationInfo = {
        totalSize: data.size || 0,
        currentPage: data.page || 0,
        limit: data.limit || 30,
        hasNext: data.hasNext || false,
        doYouMean: data.doYouMean || null
      };
    }

    if (results.length === 0) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على أي أنمي مطابق لنتيجة البحث",
          data: {
            query,
            searchParams: {
              page,
              sortBy,
              sortDirection,
              textDirection,
            },
            apiResponse: data
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
        searchParams: {
          page,
          sortBy,
          sortDirection,
          textDirection,
        },
        count: results.length,
        pagination: paginationInfo,
        results,
      },
    });
  } catch (err) {
    console.error("Server error:", err.response?.data || err.message);
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "حدث خطأ داخلي في السيرفر",
        error: err.message,
        apiError: err.response?.data
      },
      { status: 500 }
    );
  }
}        "x-device-timezone": deviceTimezone,
        "x-device-id": deviceId,
        "x-device-language": "ar",
        "x-platform": "Mobile",
      },
      body: JSON.stringify({
        query: query
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error from Anime Rift API:", errorText);
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: response.status,
          msg: "فشل في الاتصال بخادم Anime Rift",
          error: errorText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("Raw API Response:", JSON.stringify(data, null, 2));

    // تنسيق النتائج بناءً على الهيكل الجديد
    let results = [];
    let paginationInfo = {};

    if (data && Array.isArray(data.items)) {
      results = data.items.map((item) => ({
        id: item._id || null,
        title: item.title || null,
        alternativeTitle: item.alternative_title || null,
        releaseStatus: item.release_status || null,
        contentType: item.content_type || null,
        genres: item.static_genres || [],
        ageRating: item.ageRating || null,
        availableEpisodes: item.available_episodes || null,
        releaseYear: item.release_year || null,
        releaseSeason: item.realease_season || null,
        image: item.medium_picture || null,
        malVotes: item.myAnimeList_votes || null,
        malRating: item.myAnimeList_rating || null,
        latestEpisode: item.latest_episode_released?.episode_number || null,
        malFavorites: item.mal_favorites || null,
      }));
      
      // معلومات التقسيم
      paginationInfo = {
        totalSize: data.size || 0,
        currentPage: data.page || 0,
        limit: data.limit || 30,
        hasNext: data.hasNext || false,
        doYouMean: data.doYouMean || null
      };
    } else if (data && data.data && Array.isArray(data.data)) {
      // نسخة احتياطية للهيكل القديم
      results = data.data.map((item) => ({
        id: item.id || null,
        title: item.title || null,
        englishTitle: item.english_title || null,
        romanjiTitle: item.romanji_title || null,
        description: item.description || null,
        coverImage: item.cover_image || null,
        bannerImage: item.banner_image || null,
        releaseYear: item.release_year || null,
        type: item.type || null,
        status: item.status || null,
        genres: item.genres || [],
        totalEpisodes: item.total_episodes || null,
        duration: item.duration || null,
        rating: item.rating || null,
        popularity: item.popularity || null,
      }));
    }

    if (results.length === 0) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على أي أنمي مطابق لنتيجة البحث",
          data: {
            query,
            searchParams: {
              page,
              sortBy,
              sortDirection,
              textDirection,
            },
            apiResponse: data // إرجاع الرد الخام للمساعدة في التصحيح
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
        searchParams: {
          page,
          sortBy,
          sortDirection,
          textDirection,
        },
        count: results.length,
        pagination: paginationInfo,
        results,
      },
    });
  } catch (err) {
    console.error("Server error:", err);
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "حدث خطأ داخلي في السيرفر",
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      },
      { status: 500 }
    );
  }
}          sort_by: sortBy,
          sort_direction: sortDirection,
          text_direction: textDirection
        },
        headers: {
          "User-Agent": "Dart/3.8 (dart:io)",
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json; charset=UTF-8",
          "x-device-release-version": "3.7.3",
          "integrity": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzY29wZSI6IkFOSU1FLkxJQlJBUlkuU0VBUkNIIiwiZXhwIjoxNzY0ODM5NTQ5LCJpYXQiOjE3NjQ4Mzk1Mzl9.ZmAkx9UIisvTC4WKtkjTK0SxXQ5KRFVqMErmPBDzOcU",
          "x-device-timezone": deviceTimezone,
          "x-device-id": deviceId,
          "x-device-language": "ar",
          "x-platform": "Mobile"
        }
      }
    );

    // تنسيق النتائج
    let results = [];
    if (response.data && response.data.data) {
      results = response.data.data.map((item) => ({
        id: item.id || null,
        title: item.title || null,
        englishTitle: item.english_title || null,
        romanjiTitle: item.romanji_title || null,
        description: item.description || null,
        coverImage: item.cover_image || null,
        bannerImage: item.banner_image || null,
        releaseYear: item.release_year || null,
        type: item.type || null,
        status: item.status || null,
        genres: item.genres || [],
        totalEpisodes: item.total_episodes || null,
        duration: item.duration || null,
        rating: item.rating || null,
        popularity: item.popularity || null,
      }));
    }

    if (results.length === 0) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على أي أنمي مطابق لنتيجة البحث",
          data: {
            query,
            searchParams: {
              page,
              sortBy,
              sortDirection,
              textDirection,
            }
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
        searchParams: {
          page,
          sortBy,
          sortDirection,
          textDirection,
        },
        count: results.length,
        results,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "حدث خطأ داخلي في السيرفر",
        error: err.message || err.toString(),
      },
      { status: 500 }
    );
  }
          }
