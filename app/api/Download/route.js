import { NextResponse } from "next/server";
import axios from "axios";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى اضافة رابط صالح في باراميتر (url)",
        },
        { status: 400 }
      );
    }

    const targetUrl =
      "https://getindevice.com/ye00/ag/g/c?v=2&tid=G-0EPP8F0FWT&gtm=45g92e5a80h1v893377390z89109244673za204zb9109244673zd9109244673&_p=1760304479162&gcd=13l3l3l3l1l1&npa=0&dma=0&gdid=dYzg1YT&cid=339191716.1760304455&ul=ar-sy&sr=360x771&ur=SY-DI&_uip=%3A%3A&fp=1&uaa=&uab=&uafvl=Google%2520Chrome%3B137.0.7151.117%7CChromium%3B137.0.7151.117%7CNot%252FA)Brand%3B24.0.0.0&uamb=1&uam=MAR-LX1A&uap=Android&uapv=10.0.0&uaw=0&are=1&frm=0&pscdl=noapi&_prs=ok&_eu=AAAAAAQ&_gsid=E4SE2wq-RDlJy6H0i7uOYyVkyZMFxWRglA&_s=2&tag_exp=101509157~103116026~103200004~103233427~104527907~104528501~104684208~104684211~104948813~105322304~115480710~115616986~115834636~115834638~115868792~115868794&sid=1760304455&sct=1&seg=1&dl=https%3A%2F%2Fgetindevice.com%2Far%2F&dr=https%3A%2F%2Fgetindevice.com%2Far%2F&dt=GetInDevice%20-%20%D8%AA%D9%86%D8%B2%D9%8A%D9%84%20%D8%A7%D9%84%D9%81%D9%8A%D8%AF%D9%8A%D9%88%20%D9%85%D9%86%20%D9%88%D8%B3%D8%A7%D8%A6%D9%84%20%D8%A7%D9%84%D8%AA%D9%88%D8%A7%D8%B5%D9%84%20%D8%A7%D9%84%D8%A7%D8%AC%D8%AA%D9%85%D8%A7%D8%B9%D9%8A&_tu=CA&en=download_request&_c=1&_et=8615&tfd=9908";

    const response = await axios.get(targetUrl, {
      headers: {
        Host: "getindevice.com",
        Connection: "keep-alive",
        "sec-ch-ua-platform": '"Android"',
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
        "sec-ch-ua":
          '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
        "sec-ch-ua-mobile": "?1",
        Accept: "*/*",
        Origin: "https://getindevice.com",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Dest": "empty",
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
