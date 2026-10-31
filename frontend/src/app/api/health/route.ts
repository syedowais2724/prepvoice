import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    service: "PrepVoice Vercel Serverless Backend",
    gemini_configured: Boolean(process.env.GEMINI_API_KEY),
    livekit_configured: Boolean(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET),
  });
}
