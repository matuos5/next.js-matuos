import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 400,
          msg: "يرجى اضافة رابط صالح",
        },
        { status: 400 }
      );
    }

    // 1- نجيب HTML الخاص بالصفحة
    const res = await fetch(url);
    const html = await res.text();

    // 2- نبحث عن رابط الفيديو داخل الكود
    const regex = /player\.src\(\{[^}]*src:\s*"([^"]*\.mp4)"/;
    const match = html.match(regex);

    if (!match || match.length < 2) {
      return NextResponse.json(
        {
          owner: "MATUOS-3MK",
          code: 404,
          msg: "لم يتم العثور على رابط فيديو",
        },
        { status: 404 }
      );
    }

    const videoLink = match[1];

    // 3- نرجع الرابط المباشر للفيديو
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
}
    const videoLink = match[1];

    // 3- نرجع الرابط المباشر للفيديو
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
} 
