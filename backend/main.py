import os
import json
import uuid
import re
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from google import genai
from google.genai import types
from livekit import api

load_dotenv()

app = FastAPI(title="PrepVoice AI API", version="1.0.0")

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_gemini_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_free_google_ai_studio_key":
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not configured in backend/.env. Please add your Google AI Studio API key.",
        )
    return genai.Client(api_key=api_key)

# ----------------- Models -----------------

class StartRequest(BaseModel):
    resume_text: str = Field(..., description="Extracted resume text from client-side PDF parser")
    job_description: str = Field(..., description="Target job description")
    mode: str = Field(default="Project Viva", description="Interview mode")

class InterviewPlan(BaseModel):
    candidate_name: str = Field(description="Candidate's name inferred from resume or 'Candidate'")
    opening_greeting: str = Field(description="Natural, warm 1-2 sentence spoken opening greeting")
    key_projects_detected: List[str] = Field(description="Names or topics of the key projects found")
    questions: List[str] = Field(
        description="5 sharp, specific technical questions grilling them on actual projects, trade-offs, and target JD skills"
    )

class TranscriptItem(BaseModel):
    speaker: str  # "Candidate" | "Interviewer"
    text: str
    timestamp: Optional[str] = None

class HintRequest(BaseModel):
    transcript: List[TranscriptItem]
    resume_text: Optional[str] = ""
    current_question: Optional[str] = None

class HintResponse(BaseModel):
    hint: str

class QuestionFeedback(BaseModel):
    question: str
    user_answer_summary: str
    what_went_well: str
    ideal_improved_answer: str

class EnglishRefactor(BaseModel):
    original_spoken: str
    professional_version: str
    why_it_works: str

class ScorecardResponse(BaseModel):
    technical_depth_score: int = Field(ge=0, le=100)
    communication_clarity_score: int = Field(ge=0, le=100)
    confidence_score: int = Field(ge=0, le=100)
    filler_words_count: int
    overall_summary: str
    question_feedback: List[QuestionFeedback]
    english_refactoring: List[EnglishRefactor]

class EvaluateRequest(BaseModel):
    transcript: List[TranscriptItem]
    interview_plan: dict
    mode: Optional[str] = "Project Viva"

# ----------------- Endpoints -----------------

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "PrepVoice AI Backend",
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY") and os.getenv("GEMINI_API_KEY") != "your_free_google_ai_studio_key"),
        "livekit_configured": bool(os.getenv("LIVEKIT_API_KEY") and os.getenv("LIVEKIT_API_KEY") != "your_livekit_key"),
    }

@app.post("/api/interview/start")
async def start_interview(req: StartRequest):
    client = get_gemini_client()

    mode_guidelines = {
        "Project Viva": "Focus heavily on system architecture, database choices, why specific frameworks were chosen, bottlenecks, scalability, and handling production edge cases in their listed projects.",
        "DSA & Core CS": "Focus on verbal algorithmic problem-solving, time & space complexity analysis, OS concepts (threads, memory, locks), DBMS (indexing, transactions, ACID), and networking fundamentals.",
        "HR & Behavioural": "Focus on STAR method scenarios: technical disagreements, handling deadlines, learning from failure, teamwork, and cross-functional ownership.",
    }
    guideline = mode_guidelines.get(req.mode, mode_guidelines["Project Viva"])

    prompt = f"""
    You are a Senior Indian Engineering Interviewer designing a 10-minute '{req.mode}' mock interview plan.
    Target Guidelines: {guideline}

    Analyze the Candidate's Resume and the Target Job Description below.
    Generate exactly 5 sharp, specific technical questions that directly reference their listed technologies,
    specific projects, and the job requirements.
    
    CANDIDATE RESUME:
    {req.resume_text[:6000]}
    
    TARGET JOB DESCRIPTION:
    {req.job_description[:3000]}
    """

    try:
        res = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=InterviewPlan,
                temperature=0.7,
            ),
        )
        plan_dict = json.loads(res.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate interview plan with Gemini: {str(e)}")

    room_name = f"viva-{uuid.uuid4().hex[:8]}"

    livekit_api_key = os.getenv("LIVEKIT_API_KEY", "devkey")
    livekit_api_secret = os.getenv("LIVEKIT_API_SECRET", "secret_dev_livekit_key_at_least_32_bytes_long")

    token = (
        api.AccessToken(livekit_api_key, livekit_api_secret)
        .with_identity("candidate")
        .with_name("Candidate")
        .with_metadata(json.dumps(plan_dict))
        .with_grants(api.VideoGrants(room_join=True, room=room_name))
    )

    return {
        "token": token.to_jwt(),
        "room_name": room_name,
        "interview_plan": plan_dict,
    }

@app.post("/api/interview/hint", response_model=HintResponse)
async def get_rescue_hint(req: HintRequest):
    client = get_gemini_client()

    recent_turns = "\n".join([f"{t.speaker}: {t.text}" for t in req.transcript[-4:]]) if req.transcript else "Candidate is waiting to answer the question."
    current_q = req.current_question or "Current technical interview question"

    prompt = f"""
    You are an empathetic, expert Senior Engineering Interview Coach offering a discreet, 1-sentence real-time rescue hint to a candidate who is stuck or hesitating during their live technical viva.
    
    INTERVIEW QUESTION / TOPIC:
    {current_q}

    RECENT CONVERSATION TURNS:
    {recent_turns}

    CANDIDATE RESUME HIGHLIGHTS:
    {req.resume_text[:2000]}

    Provide ONE concise, tactical hint (maximum 22 words) that gently reminds them of a relevant architectural trade-off, tool, metric, or project detail to mention.
    Do NOT give away the complete code or full answer; provide a memory-jogging steer.
    """

    try:
        res = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=HintResponse,
                temperature=0.6,
            ),
        )
        return json.loads(res.text)
    except Exception as e:
        return {"hint": "Think about the system trade-offs: latency vs. consistency and why you chose your specific storage engine."}

@app.post("/api/interview/evaluate")
async def evaluate_interview(req: EvaluateRequest):
    client = get_gemini_client()

    convo = "\n".join([f"{t.speaker}: {t.text}" for t in req.transcript])
    if not convo.strip():
        convo = "Interviewer: Welcome! Walk me through your project.\nCandidate: (Interview completed with minimal speech turns recorded)."

    # Count spoken filler words using regex across candidate speech
    candidate_speech = " ".join([t.text for t in req.transcript if t.speaker.lower() == "candidate"]).lower()
    fillers = re.findall(r"\b(um|uh|like|basically|actually|you know|sort of|kind of|i mean)\b", candidate_speech)
    detected_fillers_count = len(fillers)

    prompt = f"""
    You are a distinguished Principal Engineering Interviewer and Corporate Spoken English Coach evaluating an Indian engineering student's mock interview.
    
    INTERVIEW MODE: {req.mode}
    PLANNED RUBRIC & QUESTIONS:
    {json.dumps(req.interview_plan)}

    INTERVIEW TRANSCRIPT:
    {convo}

    Provide an objective, highly constructive evaluation:
    1. Score Technical Depth (0-100), Spoken Clarity (0-100), and Confidence (0-100).
    2. Provide question-by-question feedback for each question in the rubric:
       - Summarize candidate's answer
       - Note what went well
       - Detail an ideal, impressive answer they should give in top-tier tech interviews
    3. English Refactoring: Identify 3 to 4 awkward, overly informal, grammatically clumsy, or literal-translation phrases used by the candidate (or typical Indian graduate patterns if minimal turns were spoken).
       Provide the original spoken phrase, an elegant professional version suited for Indian/global tech MNCs, and 'why_it_works' explaining the communication impact.
    4. Provide an overall summary highlighting their key strengths and top 2 action items.
    """

    try:
        res = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ScorecardResponse,
                temperature=0.5,
            ),
        )
        result = json.loads(res.text)
        # Ensure detected filler count is merged accurately if AI underestimated
        if result.get("filler_words_count", 0) < detected_fillers_count:
            result["filler_words_count"] = detected_fillers_count
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to evaluate interview with Gemini: {str(e)}")
