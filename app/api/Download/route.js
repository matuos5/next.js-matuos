// app/api/getindevice/route.js
import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userUrl = searchParams.get("url"); // (اختياري)

    // الهيدرز العامة
    const commonHeaders = {
      Host: "getindevice.com",
      Connection: "keep-alive",
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
      "sec-ch-ua":
        '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": '"Android"',
      "Accept-Language":
        "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6,fr;q=0.5",
    };

    // تجميع الكوكيز
    let cookieJar = "";

    const storeSetCookie = (headers) => {
      if (!headers) return;
      const setCookie = headers["set-cookie"] || headers["Set-Cookie"];
      if (setCookie) {
        const cookies = Array.isArray(setCookie)
          ? setCookie.map((s) => s.split(";")[0]).join("; ")
          : setCookie.split(";")[0];
        cookieJar = cookieJar ? `${cookieJar}; ${cookies}` : cookies;
      }
    };

    const headersWithCookies = (extra = {}) => ({
      ...commonHeaders,
      ...extra,
      ...(cookieJar ? { Cookie: cookieJar } : {}),
    });

    // 1️⃣ GET /ar/
    const res1 = await axios.get("https://getindevice.com/ar/", {
      headers: headersWithCookies({
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        Purpose: "prefetch",
        "Sec-Purpose": "prefetch",
        "Upgrade-Insecure-Requests": "1",
        Referer: "https://getindevice.com/ar/",
        "Accept-Encoding": "gzip, deflate, br, zstd",
      }),
      responseType: "text",
      validateStatus: () => true,
    });
    storeSetCookie(res1.headers);

    // 2️⃣ GET superpwa-sw.js
    try {
      const res2 = await axios.get(
        "https://getindevice.com/superpwa-sw.js?2.2.37",
        {
          headers: headersWithCookies({
            Accept: "*/*",
            "Service-Worker": "script",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "same-origin",
            "Sec-Fetch-Dest": "serviceworker",
            Referer: "https://getindevice.com/ar/",
            "Accept-Encoding": "gzip, deflate, br, zstd",
          }),
          responseType: "text",
          validateStatus: () => true,
        }
      );
      storeSetCookie(res2.headers);
    } catch {
      // غير مهم
    }

    // 3️⃣ POST measurement/conversion
    const measurementUrl =
      "https://getindevice.com/ye00/g/measurement/conversion/?random=1760304488173&cv=11&tid=G-0EPP8F0FWT&fst=1760304488173&fmt=6&en=download_request&gtm=45g92e5a80h1v893377390z89109244673za204zb9109244673zd9109244673xec&gcd=13l3l3l3l1l1&dma=0";
    const res3 = await axios.post(measurementUrl, null, {
      headers: headersWithCookies({
        "Content-Length": "0",
        Accept: "*/*",
        Origin: "https://getindevice.com",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Dest": "empty",
        Referer: "https://getindevice.com/ar/",
        "Accept-Encoding": "gzip, deflate, br, zstd",
      }),
      responseType: "text",
      validateStatus: () => true,
    });
    storeSetCookie(res3.headers);

    // 4️⃣ POST video_result
    const videoResultUrl =
      "https://getindevice.com/ye00/ag/g/c?v=2&tid=G-0EPP8F0FWT&en=video_result";
    const res4 = await axios.post(videoResultUrl, null, {
      headers: headersWithCookies({
        "Content-Length": "0",
        Accept: "*/*",
        Origin: "https://getindevice.com",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Dest": "empty",
        Referer: "https://getindevice.com/ar/",
        "Accept-Encoding": "gzip, deflate, br, zstd",
      }),
      responseType: "text",
      validateStatus: () => true,
    });
    storeSetCookie(res4.headers);

    // تحليل المحتوى النهائي
    const html =
      typeof res4.data === "string"
        ? res4.data
        : JSON.stringify(res4.data, null, 2);

    const $ = cheerio.load(html);
    let videoLink = null;

    videoLink = $("video source").first().attr("src") || $("video").first().attr("src");
    if (!videoLink)
      videoLink =
        $('meta[property="og:video"]').attr("content") ||
        $('meta[name="twitter:player:stream"]').attr("content");
    if (!videoLink)
      videoLink = $('a[href$=".mp4"]').first().attr("href") || null;
    if (!videoLink) {
      $("a").each((_, el) => {
        const href = $(el).attr("href");
        if (!videoLink && href?.includes(".mp4")) videoLink = href;
      });
    }
    if (!videoLink) {
      const match = html.match(
        /https?:\/\/[^'"\s>]+\.(mp4|m3u8)(\?[^'"\s>]*)?/i
      );
      if (match) videoLink = match[0];
    }

    if (!videoLink) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على رابط الفيديو.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: { link: videoLink },
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "Internal error",
        error: err.message,
      },
      { status: 500 }
    );
  }
      }        } else {
          const v = setCookie.split(";")[0];
          cookieJar = cookieJar ? cookieJar + "; " + v : v;
        }
      }
    };

    // helper لبناء هيدرز مع الكوكيز
    const headersWithCookies = (extra = {}) => ({
      ...commonHeaders,
      ...extra,
      ...(cookieJar ? { Cookie: cookieJar } : {}),
    });

    // 1) GET /ar/
    const getArUrl = "https://getindevice.com/ar/";
    const res1 = await axios.get(getArUrl, {
      headers: headersWithCookies({
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        Purpose: "prefetch",
        "Sec-Purpose": "prefetch",
        "Upgrade-Insecure-Requests": "1",
        Referer: "https://getindevice.com/ar/",
        "Accept-Encoding": "gzip, deflate, br, zstd",
      }),
      // نسمح بقبول response مضغوط
      responseType: "text",
      validateStatus: () => true,
    });
    storeSetCookie(res1.headers);

    // 2) GET superpwa-sw.js (قد يكون مطلوب من الموقع)
    try {
      const res2 = await axios.get(
        "https://getindevice.com/superpwa-sw.js?2.2.37",
        {
          headers: headersWithCookies({
            Accept: "*/*",
            "Service-Worker": "script",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "same-origin",
            "Sec-Fetch-Dest": "serviceworker",
            Referer: "https://getindevice.com/ar/",
            "Accept-Encoding": "gzip, deflate, br, zstd",
          }),
          responseType: "text",
          validateStatus: () => true,
        }
      );
      storeSetCookie(res2.headers);
    } catch (e) {
      // ليست fatal — نستمر
    }

    // 3) POST measurement/conversion/... (نفس باراميترات curl)
    const measurementUrl =
      "https://getindevice.com/ye00/g/measurement/conversion/?random=1760304488173&cv=11&tid=G-0EPP8F0FWT&fst=1760304488173&fmt=6&en=download_request&gtm=45g92e5a80h1v893377390z89109244673za204zb9109244673zd9109244673xec&gcd=13l3l3l3l1l1&dma=0&tag_exp=101509157~103116026~103200004~103233427~104527907~104528501~104684208~104684211~104948813~105322304~115480710~115616986~115834636~115834638~115868792~115868794&u_w=360&u_h=771&url=https%3A%2F%2Fgetindevice.com%2Far%2F&ref=https%3A%2F%2Fgetindevice.com%2Far%2F&gacid=339191716.1760304455&frm=0&tiba=GetInDevice%20-%20%D8%AA%D9%86%D8%B2%D9%8A%D9%84%20%D8%A7%D9%84%D9%81%D9%8A%D8%AF%D9%8A%D9%88%20%D9%85%D9%86%20%D9%88%D8%B3%D8%A7%D8%A6%D9%84%20%D8%A7%D9%84%D8%AA%D9%88%D8%A7%D8%B5%D9%84%20%D8%A7%D9%84%D8%A7%D8%AC%D8%AA%D9%85%D8%A7%D8%B9%D9%8A&gdid=dYzg1YT&npa=0&pscdl=noapi&auid=1342134661.1760304454&uaa=&uab=&uafvl=Google%2520Chrome%3B137.0.7151.117%7CChromium%3B137.0.7151.117%7CNot%252FA)Brand%3B24.0.0.0&uamb=1&uam=MAR-LX1A&uap=Android&uapv=10.0.0&uaw=0&_tu=CA";

    const res3 = await axios.post(measurementUrl, null, {
      headers: headersWithCookies({
        "Content-Length": "0",
        Accept: "*/*",
        Origin: "https://getindevice.com",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Dest": "empty",
        Referer: "https://getindevice.com/ar/",
        "Accept-Encoding": "gzip, deflate, br, zstd",
      }),
      responseType: "text",
      validateStatus: () => true,
    });
    storeSetCookie(res3.headers);

    // 4) POST ال endpoint اللي فعلاً يطلب video_result (نفس curl الأخير)
    const videoResultUrl =
      "https://getindevice.com/ye00/ag/g/c?v=2&tid=G-0EPP8F0FWT&gtm=45g92e5a80h1v893377390z89109244673za204zb9109244673zd9109244673&_p=1760304479162&gcd=13l3l3l3l1l1&npa=0&dma=0&gdid=dYzg1YT&cid=339191716.1760304455&ul=ar-sy&sr=360x771&ur=SY-DI&_uip=%3A%3A&fp=1&uaa=&uab=&uafvl=Google%2520Chrome%3B137.0.7151.117%7CChromium%3B137.0.7151.117%7CNot%252FA)Brand%3B24.0.0.0&uamb=1&uam=MAR-LX1A&uap=Android&uapv=10.0.0&uaw=0&are=1&frm=0&pscdl=noapi&_prs=ok&_eu=AAAAAAQ&_gsid=E4SE2wq-RDlJy6H0i7uOYyVkyZMFxWRglA&_s=3&tag_exp=101509157~103116026~103200004~103233427~104527907~104528501~104684208~104684211~104948813~105322304~115480710~115616986~115834636~115834638~115868792~115868794&sid=1760304455&sct=1&seg=1&dl=https%3A%2F%2Fgetindevice.com%2Far%2F&dr=https%3A%2F%2Fgetindevice.com%2Far%2F&dt=GetInDevice%20-%20%D8%AA%D9%86%D8%B2%D9%8A%D9%84%20%D8%A7%D9%84%D9%81%D9%8A%D8%AF%D9%8A%D9%88%20%D9%85%D9%86%20%D9%88%D8%B3%D8%A7%D8%A6%D9%84%20%D8%A7%D9%84%D8%AA%D9%88%D8%A7%D8%B5%D9%84%20%D8%A7%D9%84%D8%A7%D8%AC%D8%AA%D9%85%D8%A7%D8%B9%D9%8A&_tu=CA&en=video_result&_c=1&_et=2185&tfd=23607";

    const res4 = await axios.post(videoResultUrl, null, {
      headers: headersWithCookies({
        "Content-Length": "0",
        Accept: "*/*",
        Origin: "https://getindevice.com",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Dest": "empty",
        Referer: "https://getindevice.com/ar/",
        "Accept-Encoding": "gzip, deflate, br, zstd",
      }),
      responseType: "text",
      validateStatus: () => true,
    });
    storeSetCookie(res4.headers);

    // الآن نملك محتوى HTML أو JSON في res4.data
    const html = typeof res4.data === "string" ? res4.data : JSON.stringify(res4.data);

    // تحليل المحتوى
    const $ = cheerio.load(html);

    // محاولات متعددة لاستخراج رابط الفيديو
    let videoLink = null;

    // 1) <video><source src=...>
    videoLink = $("video source").first().attr("src") || videoLink;
    // 2) <video src="...">
    if (!videoLink) videoLink = $("video").first().attr("src") || videoLink;
    // 3) meta property og:video
    if (!videoLink) videoLink = $('meta[property="og:video"]').attr("content") || videoLink;
    // 4) meta name=twitter:player:stream
    if (!videoLink) videoLink = $('meta[name="twitter:player:stream"]').attr("content") || videoLink;
    // 5) أي رابط ينتهي بـ .mp4 في الروابط
    if (!videoLink) {
      const aMp4 = $('a[href$=".mp4"]').first();
      if (aMp4 && aMp4.attr("href")) videoLink = aMp4.attr("href");
    }
    // 6) أي رابط يحتوي mp4
    if (!videoLink) {
      $("a").each((i, el) => {
        const href = $(el).attr("href");
        if (!videoLink && href && href.includes(".mp4")) videoLink = href;
      });
    }

    // 7) حاول البحث في السكربتات عن رابط بصيغة https://... .mp4
    if (!videoLink) {
      const scriptsText = $("script")
        .map((i, el) => $(el).html())
        .get()
        .join("\n");
      const mp4Match = scriptsText.match(/https?:\/\/[^'"\s>]+\.(mp4|m3u8)(\?[^'"\s>]*)?/i);
      if (mp4Match) videoLink = mp4Match[0];
    }

    if (!videoLink) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم أتمكن من إيجاد رابط الفيديو تلقائياً. قد تحتاج تحليل مخصص للموقع أو تغيير الباراميتر.",
          debug: {
            snippet: html.slice(0, 1000), // لإعطاء لمحة مصغرة (يمكن إزالة لاحقًا)
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
        link: videoLink,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "Internal error",
        error: err.message,
      },
      { status: 500 }
    );
  }
        }        "Sec-Fetch-Dest": "empty",
        Referer: "https://getindevice.com/ar/",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language":
          "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6,fr;q=0.5",
        Cookie:
          "pll_language=ar; _gcl_au=1.1.1342134661.1760304454; _ga=GA1.1.339191716.1760304455; PHPSESSID=9162de92e55c5e515437c39ca9e81351; _ga_0EPP8F0FWT=GS2.1.s1760304455$o1$g1$t1760304488$j27$l0$h0$dE4SE2wq-RDlJy6H0i7uOYyVkyZMFxWRglA",
      },
    });

    return NextResponse.json({
      owner: "MATUOS-3MK",
      code: 0,
      msg: "success",
      data: response.data || "تم تنفيذ الطلب بنجاح",
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "Internal error",
        error: err.message,
      },
      { status: 500 }
    );
  }
          } 
