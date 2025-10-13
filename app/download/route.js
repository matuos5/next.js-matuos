// app/api/download/route.js
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url"); // رابط الفيديو من query

    if (!url) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى اضافة رابط صالح للفيديو",
        },
        { status: 400 }
      );
    }

    // تكوين البارامترات تماماً مثل السكراب الأصلي
    const params = {
      v: "2",
      tid: "G-0EPP8F0FWT",
      gtm: "45g92e5a80h1v893377390z89109244673za204zb9109244673zd9109244673",
      _p: "1760337588349",
      gcd: "13l3l3l3l1l1",
      npa: "0",
      dma: "0",
      gdid: "dYzg1YT",
      cid: "1564099097.1760337594",
      ul: "ar-sy",
      sr: "360x771",
      lps: "1",
      ur: "SY-DI",
      _uip: "::",
      fp: "1",
      uaa: "",
      uab: "",
      uafvl: "",
      uamb: "1",
      uam: "",
      uap: "Android",
      uapv: "",
      uaw: "0",
      are: "1",
      frm: "0",
      pscdl: "noapi",
      _prs: "ok",
      _eu: "AAAAAAQ",
      _gsid: "BJ8reo48NPMrtPazh8dH0gWlAPWLVcCi5A",
      _s: "3",
      tag_exp:
        "101509157~103116026~103200004~103233427~104527907~104528501~104684208~104684211~104948813~115480710~115616985~115834636~115834638~115868795~115868797",
      sid: "1760337593",
      sct: "1",
      seg: "1",
      dl: url, // الرابط الذي يرسله المستخدم
      dr: "https://www.google.com/",
      dt: "GetInDevice - تنزيل الفيديو من وسائل التواصل الاجتماعي",
      _tu: "CA",
      en: "video_result",
      _c: "1",
      _et: "4650",
      tfd: "22045",
    };

    const headers = {
      Host: "getindevice.com",
      Connection: "keep-alive",
      "Content-Length": "0",
      "sec-ch-ua-platform": '"Android"',
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10; MAR-LX1A Build/HUAWEIMAR-L21MEB) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.208 Mobile Safari/537.36",
      "sec-ch-ua":
        '"Chromium";v="140", "Not=A?Brand";v="24", "Android WebView";v="140"',
      "sec-ch-ua-mobile": "?1",
      Accept: "*/*",
      Origin: "https://getindevice.com",
      "X-Requested-With": "mark.via.gp",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "no-cors",
      "Sec-Fetch-Dest": "empty",
      Referer: "https://getindevice.com/ar/",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "ar-SY,ar;q=0.9,en-SY;q=0.8,en-US;q=0.7,en;q=0.6",
      Cookie:
        "pll_language=ar; _gcl_au=1.1.1458166921.1760337593; PHPSESSID=fa0a1c657322cbbb331ba6837c1d159e; _ga=GA1.1.1564099097.1760337594; _ga_0EPP8F0FWT=GS2.1.s1760337593$o1$g1$t1760337607$j46$l0$h0$dBJ8reo48NPMrtPazh8dH0gWlAPWLVcCi5A",
    };

    // تنفيذ الطلب بنفس السكراب ولكن باستخدام fetch (متوافق مع Next.js)
    const formParams = new URLSearchParams(params);

    const response = await fetch("https://getindevice.com/ye00/ag/g/c", {
      method: "POST",
      headers,
      body: formParams,
    });

    const data = await response.text(); // الموقع غالباً يرجع HTML أو JSON

    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 200,
        data: data,
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        owner: "MATUOS-3MK",
        code: 500,
        msg: "حدث خطأ داخلي",
        error: err.message,
      },
      { status: 500 }
    );
  }
      }
