// app/api/anime/route.js
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("https://www.onma.top/topManga", {
      method: "GET",
      headers: {
        "Host": "www.onma.top",
        "Connection": "keep-alive",
        "sec-ch-ua-platform": "\"Android\"",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
        "Accept": "*/*",
        "sec-ch-ua":
          "\"Google Chrome\";v=\"137\", \"Chromium\";v=\"137\", \"Not/A)Brand\";v=\"24\"",
        "sec-ch-ua-mobile": "?1",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
        "Referer": "https://www.onma.top/",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6,fr;q=0.5",
        "Cookie":
          "XSRF-TOKEN=eyJpdiI6InMxUjUxS3RlTEd4REs2ZEVjT29ZRmc9PSIsInZhbHVlIjoiektaWDk0NzNUVUliMXRoUE1QNlBcLzFzdmlGV0JWa2ZaWlIwbWpqUnlWeDllYjNQMHNndm04NzZyR0k5OW9UckJDRE9EXC83TzJYekVNOEc0Ukl0QUtVdz09IiwibWFjIjoiYjYxMTA3MDYzYzQ3YjE3ZTE2ZjA5NWZmZTIyNDc2NjViNmUxYTg3YjljNTQ0ZjJiYjY4OGZkNjY5ZjU3NGI1NSJ9; laravel_session=eyJpdiI6Ikd0OVpEZlNZM3pwZk5hQ1dwcHg2Q1E9PSIsInZhbHVlIjoiQzNhb043TFwvZ3Q3aGl5V0QrRzlPR0ZcL01NcWx1Wm1WMHBER1AzeUVuN1BralwvajFwY1cwM2tad2ZHQzIrXC9Id1l6RmJlTWNXV0JRTlwvQlY2V0NXa0xQQT09IiwibWFjIjoiZjliNTdiYTIwNjBiYmY5MTdiNzA4NTlmMTEzNTdhY2RiZDVjZDI1YTVhOTFhNGM4NDE2ZjRjZTAyNjI5ZmRmMCJ9"
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: response.status,
          msg: "فشل في جلب البيانات من onma.top",
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data,
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "Internal Server Error",
        error: err.message,
      },
      { status: 500 }
    );
  }
}        },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data,
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "Internal Server Error",
        error: err.message,
      },
      { status: 500 }
    );
  }
        }
