import { NextResponse } from "next/server";

// GET request
export async function GET() {
  return NextResponse.json({ message: "Hello from Next.js API 👋" });
}

// POST request
export async function POST(request) {
  try {
    const body = await request.json();
    return NextResponse.json({
      message: "POST request received!",
      data: body,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
}
