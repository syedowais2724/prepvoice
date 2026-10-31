import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrepVoice AI — Autonomous Technical Viva & Spoken English Coach",
  description:
    "Real-time voice mock interview simulator with browser-side resume parsing, Gemini 2.5 Flash technical rubric generation, and LiveKit audio WebRTC.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="min-h-full flex flex-col bg-[#080b11] text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
