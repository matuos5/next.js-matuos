import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("https://api-kora12.com/matches/today", {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    // التحقق من حالة الرد قبل قراءة البيانات
    if (!response.ok) {
      throw new Error(`Failed with status ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
      code: 0,
      msg: "success",
      data,
    });
  } catch (err) {
    return NextResponse.json(
      {
        owner: "𝙈𝙤𝙝𝙖𝙢𝙚𝙙-𝘼𝙧𝙚𝙣𝙚",
        code: 500,
        msg: "Internal error",
        data: { error: err.message },
      },
      { status: 500 }
    );
  }
}
