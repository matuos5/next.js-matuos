import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get("prompt");
    const model = searchParams.get("model") || "gemini-2.0-flash";
    const type = searchParams.get("type") || "text";

    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          error: "يرجى إضافة prompt كمعامل في الرابط",
          example: "/api/gemini?prompt=اشرح كيف يعمل الذكاء الاصطناعي&model=gemini-2.0-flash&type=text"
        },
        { status: 400 }
      );
    }

    // تحديد endpoint بناءً على النوع
    let endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
    // بناء payload حسب نوع الطلب
    let payload = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    };

    // إذا كان طلب صورة نضيف instructions خاصة
    if (type === "image") {
      payload.contents[0].parts[0].text = `أنت فنان ومصمم محترف. ${prompt} - أبدع في وصف الصورة بتفاصيل فنية جميلة`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": process.env.GEMINI_API_KEY || "AIzaSyC-TRC7NPOeFZ5gv802ZZtxmBnuFcUwfaY"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        {
          success: false,
          error: errorData.error?.message || "حدث خطأ في الاتصال بـ Gemini API",
          status: response.status
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // استخراج النتيجة
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: "لم يتم الحصول على نتيجة من النموذج",
          rawResponse: data
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      prompt: prompt,
      model: model,
      type: type,
      response: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Gemini API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "حدث خطأ داخلي في الخادم",
        details: error.message
      },
      { status: 500 }
    );
  }
       } 
