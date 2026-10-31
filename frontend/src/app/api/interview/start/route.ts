import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export async function POST(req: NextRequest) {
  try {
    const { resume_text, job_description, mode } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { detail: "GEMINI_API_KEY is not configured on Vercel." },
        { status: 500 }
      );
    }

    const modeGuidelines: Record<string, string> = {
      "Project Viva":
        "Focus on system architecture, database choices, why specific frameworks were chosen, bottlenecks, scalability, and handling production edge cases in their listed projects.",
      "DSA & Core CS":
        "Focus on verbal algorithmic problem-solving, time & space complexity analysis, OS concepts (threads, memory, locks), DBMS (indexing, transactions, ACID), and networking fundamentals.",
      "HR & Behavioural":
        "Focus on STAR method scenarios: technical disagreements, handling deadlines, learning from failure, teamwork, and cross-functional ownership.",
    };
    const guideline = modeGuidelines[mode] || modeGuidelines["Project Viva"];

    const prompt = `
You are a Senior Indian Engineering Interviewer designing a 10-minute '${mode || "Project Viva"}' mock interview plan.
Target Guidelines: ${guideline}

Analyze the Candidate's Resume and the Target Job Description below.
Generate exactly 5 sharp, specific technical questions that directly reference their listed technologies,
specific projects, and the job requirements.

CANDIDATE RESUME:
${(resume_text || "").slice(0, 6000)}

TARGET JOB DESCRIPTION:
${(job_description || "").slice(0, 3000)}

Respond strictly in valid JSON matching this exact structure:
{
  "candidate_name": "Inferred Name or Candidate",
  "opening_greeting": "Natural 1-2 sentence spoken greeting inviting them to discuss their best project",
  "key_projects_detected": ["Project 1", "Project 2"],
  "questions": [
    "Question 1",
    "Question 2",
    "Question 3",
    "Question 4",
    "Question 5"
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
            temperature: 0.7,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return NextResponse.json(
        { detail: `Gemini API error: ${errText}` },
        { status: 500 }
      );
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    const planDict = JSON.parse(rawText);

    const roomName = `viva-${Math.random().toString(36).substring(2, 10)}`;
    const livekitKey = process.env.LIVEKIT_API_KEY || "APISpXBuaMKLH4L";
    const livekitSecret = process.env.LIVEKIT_API_SECRET || "uLi4nfbl35mf2WBmverV4GgNVqWolBAYPgnhPyAMeVvA";

    const at = new AccessToken(livekitKey, livekitSecret, {
      identity: "candidate",
      name: planDict.candidate_name || "Candidate",
      metadata: JSON.stringify(planDict),
    });
    at.addGrant({ roomJoin: true, room: roomName });
    const token = await at.toJwt();

    return NextResponse.json({
      token,
      room_name: roomName,
      interview_plan: planDict,
    });
  } catch (err: any) {
    console.error("Start interview error:", err);
    return NextResponse.json(
      { detail: err.message || "Failed to start interview." },
      { status: 500 }
    );
  }
}
