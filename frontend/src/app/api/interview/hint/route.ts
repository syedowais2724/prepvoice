import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { transcript, resume_text, current_question } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        hint: "Consider discussing the architectural trade-offs between latency, throughput, and database selection.",
      });
    }

    const recentTurns = Array.isArray(transcript)
      ? transcript
          .slice(-4)
          .map((t: any) => `${t.speaker}: ${t.text}`)
          .join("\n")
      : "";

    const prompt = `
You are an expert Senior Engineering Interview Coach offering a discreet, 1-sentence real-time rescue hint to a candidate who is stuck or hesitating during their live technical viva.

INTERVIEW QUESTION / TOPIC:
${current_question || "Current technical interview question"}

RECENT CONVERSATION TURNS:
${recentTurns || "Candidate is preparing to answer."}

CANDIDATE RESUME HIGHLIGHTS:
${(resume_text || "").slice(0, 2000)}

Provide ONE concise, tactical hint (maximum 22 words) that gently reminds them of a relevant architectural trade-off, tool, metric, or project detail to mention.
Do NOT give away the complete code; provide a memory-jogging steer.

Respond strictly in valid JSON:
{
  "hint": "Crisp 1-sentence tactical lifeline hint"
}
`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.6,
          },
        }),
      }
    );

    if (geminiRes.ok) {
      const data = await geminiRes.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(rawText);
      return NextResponse.json(parsed);
    }

    return NextResponse.json({
      hint: "Explain how you evaluated consistency vs. availability for this specific architectural choice.",
    });
  } catch (err) {
    return NextResponse.json({
      hint: "Highlight your key system bottlenecks and how you monitored them under production load.",
    });
  }
}
