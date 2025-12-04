// app/api/animerrift/search/route.js

import { NextResponse } from "next/server";
import axios from "axios";

export async function GET(req) {
  try {
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

    const deviceTimezone = new Date().toISOString();
    const deviceId = "eJ1Ou9KbTmy1ohBFa4XzNu:APA91bGd3t2lyXGK0YjR2wkr_rvqcME8kvhO6tlj22q8HFMG2BcVUyfeQX6z9RJIWct4bDv3ulO8t0AQHFLCcAa_o1_DdwRNR7-NacCTIyRb46yt0prWV5k";

    const response = await axios.post(
      "https://gateway.anime-rift.com/api/v3/library/search",
      {
        query: query
      },
      {
        params: {
          page,
          sort_by: sortBy,
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
