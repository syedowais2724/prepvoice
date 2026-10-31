import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { transcript, interview_plan, mode } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { detail: "GEMINI_API_KEY is not configured on Vercel." },
        { status: 500 }
      );
    }

    const turns = Array.isArray(transcript) ? transcript : [];
    const convo = turns.map((t: any) => `${t.speaker}: ${t.text}`).join("\n");

    // Count filler words in candidate speech
    const candidateSpeech = turns
      .filter((t: any) => (t.speaker || "").toLowerCase() === "candidate")
      .map((t: any) => t.text || "")
      .join(" ")
      .toLowerCase();

    const fillerMatches = candidateSpeech.match(
      /\b(um|uh|like|basically|actually|you know|sort of|kind of|i mean)\b/gi
    );
    const detectedFillers = fillerMatches ? fillerMatches.length : 0;

    const prompt = `
You are a Principal Engineering Interviewer and Corporate Spoken English Coach evaluating an engineering graduate's mock viva.

INTERVIEW MODE: ${mode || "Project Viva"}
PLANNED RUBRIC & QUESTIONS:
${JSON.stringify(interview_plan || {})}

INTERVIEW TRANSCRIPT:
${convo || "Interviewer: Welcome! Walk me through your best project.\nCandidate: (Minimal spoken response recorded)."}

Provide an objective, highly constructive evaluation:
1. Score Technical Depth (0-100), Spoken Clarity (0-100), and Confidence (0-100).
2. Count filler words (um, uh, basically, like, you know).
3. Provide question-by-question feedback for each question in the rubric:
   - question
   - user_answer_summary
   - what_went_well
   - ideal_improved_answer
4. English Refactoring: Pick 3 to 4 awkward, overly informal, grammatically clumsy, or literal-translation phrases used by the candidate (or typical Indian graduate patterns if minimal turns were spoken).
   Provide:
   - original_spoken
   - professional_version
   - why_it_works
5. Provide overall_summary highlighting key strengths and top 2 action items.

Respond strictly in valid JSON matching this exact structure:
{
  "technical_depth_score": 75,
  "communication_clarity_score": 80,
  "confidence_score": 70,
  "filler_words_count": ${detectedFillers},
  "overall_summary": "Summary text here",
  "question_feedback": [
    {
      "question": "Question text",
      "user_answer_summary": "Summary of candidate answer",
      "what_went_well": "Positive aspects",
      "ideal_improved_answer": "Model answer for top tech MNCs"
    }
  ],
  "english_refactoring": [
    {
      "original_spoken": "What you said",
      "professional_version": "Executive tech phrasing",
      "why_it_works": "Communication impact explanation"
    }
  ]
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
            temperature: 0.5,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return NextResponse.json(
        { detail: `Gemini evaluation failed: ${errText}` },
        { status: 500 }
      );
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    const result = JSON.parse(rawText);

    if ((result.filler_words_count || 0) < detectedFillers) {
      result.filler_words_count = detectedFillers;
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Evaluation error:", err);
    return NextResponse.json(
      { detail: err.message || "Failed to evaluate interview." },
      { status: 500 }
    );
  }
}
