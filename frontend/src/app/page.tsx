"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  BarVisualizer,
  useVoiceAssistant,
  useDataChannel,
  ControlBar,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { extractTextFromPDF } from "@/lib/pdf";
import {
  saveInterviewSession,
  getPastSessions,
  deleteSession,
  clearAllSessions,
  SessionData,
} from "@/lib/db";
import {
  Mic,
  Clock,
  FileText,
  UploadCloud,
  CheckCircle2,
  XCircle,
  AlertCircle,
  History,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  Award,
  Lightbulb,
  Loader2,
  RotateCcw,
  Sparkles,
  MessageSquare,
  ShieldCheck,
  Check,
} from "lucide-react";

type Turn = { speaker: string; text: string; timestamp?: string };

interface ScorecardData {
  technical_depth_score: number;
  communication_clarity_score: number;
  confidence_score: number;
  filler_words_count: number;
  overall_summary: string;
  question_feedback: Array<{
    question: string;
    user_answer_summary: string;
    what_went_well: string;
    ideal_improved_answer: string;
  }>;
  english_refactoring: Array<{
    original_spoken: string;
    professional_version: string;
    why_it_works: string;
  }>;
}

interface SessionInfo {
  token: string;
  room_name: string;
  interview_plan: {
    candidate_name: string;
    opening_greeting: string;
    key_projects_detected: string[];
    questions: string[];
  };
}

// ----------------------------------------------------
// Active LiveKit Voice Room Component
// ----------------------------------------------------
function ActiveInterviewRoom({
  onEndInterview,
  transcript,
  setTranscript,
  sessionInfo,
  resumeText,
}: {
  onEndInterview: () => void;
  transcript: Turn[];
  setTranscript: React.Dispatch<React.SetStateAction<Turn[]>>;
  sessionInfo: SessionInfo;
  resumeText: string;
}) {
  const { state, audioTrack } = useVoiceAssistant();
  const [secondsLeft, setSecondsLeft] = useState<number>(600); // 10 minutes
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState<boolean>(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // 10-Minute Countdown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format time mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Auto-scroll transcript drawer
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // LiveKit Data Channel listener for speech turns from Python Agent
  const onDataMessage = useCallback(
    (msg: any) => {
      try {
        const decoded = JSON.parse(new TextDecoder().decode(msg.payload));
        if (decoded && decoded.speaker && decoded.text) {
          setTranscript((prev) => [...prev, decoded]);
        }
      } catch (err) {
        console.error("Failed to decode LiveKit data packet:", err);
      }
    },
    [setTranscript]
  );

  useDataChannel(onDataMessage);

  // Request Rescue Hint (Flow D)
  const handleRequestHint = async () => {
    if (hintLoading) return;
    setHintLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const lastInterviewerQuestion = [...transcript]
        .reverse()
        .find((t) => t.speaker.toLowerCase() === "interviewer")?.text;

      const res = await fetch(`${apiUrl}/api/interview/hint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcript.slice(-4),
          resume_text: resumeText.slice(0, 2000),
          current_question:
            lastInterviewerQuestion || sessionInfo.interview_plan.questions[0] || "Project viva question",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveHint(data.hint || "Mention your architectural trade-offs and bottleneck solutions.");
        // Auto-dismiss hint toast after 14 seconds
        setTimeout(() => setActiveHint(null), 14000);
      }
    } catch (err) {
      console.error("Failed to fetch rescue hint:", err);
      setActiveHint("Highlight the trade-off between latency, throughput, and database choice.");
      setTimeout(() => setActiveHint(null), 8000);
    } finally {
      setHintLoading(false);
    }
  };

  return (
    <div className="relative max-w-5xl mx-auto space-y-6">
      {/* Floating Rescue Hint Toast */}
      {activeHint && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 w-11/12 max-w-xl bg-amber-950/90 border border-amber-500/50 text-amber-200 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Rescue Lifeline Hint
              </p>
              <p className="text-sm font-medium text-slate-100 mt-0.5 leading-relaxed">
                {activeHint}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveHint(null)}
            className="text-slate-400 hover:text-slate-100 p-1 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Room Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Visualizer & Controls */}
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between min-h-[460px] shadow-2xl relative overflow-hidden">
          {/* Top Bar inside Active Call */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-3 w-3 rounded-full ${
                  state === "speaking"
                    ? "bg-emerald-400 animate-ping"
                    : state === "listening"
                    ? "bg-indigo-400 animate-pulse"
                    : "bg-slate-500"
                }`}
              />
              <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-slate-800/80 border border-slate-700/60 text-slate-300">
                Agent: {state || "Connected"}
              </span>
            </div>

            {/* 10-Minute Countdown Display */}
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-mono font-semibold ${
                secondsLeft <= 120
                  ? "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse"
                  : "bg-slate-800/80 border-slate-700/60 text-slate-300"
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>{formatTime(secondsLeft)} Remaining</span>
            </div>
          </div>

          {/* Center: Audio Bar Visualizer */}
          <div className="flex flex-col items-center justify-center my-8">
            <div className="h-36 w-full flex items-center justify-center">
              <BarVisualizer
                state={state}
                barCount={9}
                trackRef={audioTrack}
                className="h-28 w-4/5 max-w-xs text-indigo-500"
              />
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              {state === "speaking"
                ? "Interviewer is speaking..."
                : state === "listening"
                ? "Listening to you... speak clearly and naturally."
                : "Interviewer is preparing the next question..."}
            </p>
          </div>

          {/* Bottom Actions Bar */}
          <div className="w-full flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
            <div className="flex items-center gap-3">
              <ControlBar
                controls={{ microphone: true, camera: false, screenShare: false, leave: false }}
              />
              {/* Rescue Hint Button */}
              <button
                onClick={handleRequestHint}
                disabled={hintLoading}
                className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3.5 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-50"
              >
                {hintLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>Need a Hint</span>
              </button>
            </div>

            <button
              onClick={onEndInterview}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold px-5 py-2.5 rounded-xl transition shadow-lg text-sm flex items-center gap-2"
            >
              <span>End & Generate Scorecard</span>
            </button>
          </div>
        </div>

        {/* Right Col: Live Transcript Drawer */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col h-[460px] shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Live Speech Transcript
              </h3>
            </div>
            <span className="text-[10px] text-slate-500">{transcript.length} turns</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3.5 py-3 pr-1 text-sm">
            {transcript.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500">
                <p className="text-xs">
                  Your voice viva has begun. Speak into your microphone and turns will stream here in real-time.
                </p>
              </div>
            ) : (
              transcript.map((t, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl transition ${
                    t.speaker === "Interviewer"
                      ? "bg-slate-800/90 text-slate-200 border border-slate-700/50"
                      : "bg-indigo-600/20 text-indigo-100 border border-indigo-500/30 ml-2"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[11px] font-bold ${
                        t.speaker === "Interviewer" ? "text-indigo-400" : "text-emerald-400"
                      }`}
                    >
                      {t.speaker}
                    </span>
                    {t.timestamp && (
                      <span className="text-[10px] text-slate-400">{t.timestamp}</span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed">{t.text}</p>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

// ----------------------------------------------------
// Main PrepVoice AI Application
// ----------------------------------------------------
export default function PrepVoiceApp() {
  const [resumeText, setResumeText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [jd, setJd] = useState<string>("");
  const [mode, setMode] = useState<string>("Project Viva");
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStage, setLoadingStage] = useState<string>("");

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);

  // Past Sessions Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [pastSessions, setPastSessions] = useState<SessionData[]>([]);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(0);

  // Load past sessions from IndexedDB on mount
  const refreshPastSessions = useCallback(async () => {
    try {
      const sessions = await getPastSessions();
      setPastSessions(sessions);
    } catch (e) {
      console.error("Failed to load IndexedDB sessions:", e);
    }
  }, []);

  useEffect(() => {
    refreshPastSessions();
  }, [refreshPastSessions]);

  // Handle PDF upload and client-side extraction via PDF.js
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      setLoading(true);
      setLoadingStage("Parsing PDF locally in browser via PDF.js...");
      const text = await extractTextFromPDF(file);
      setResumeText(text);
    } catch (err) {
      console.error("PDF Parsing Error:", err);
      alert("Failed to parse PDF in browser. Please verify it is a valid text-based PDF.");
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  };

  // Populate sample project viva data for instant testing
  const loadSampleData = () => {
    setFileName("Sample_FullStack_Resume.pdf");
    setResumeText(
      `Candidate Name: Aarav Sharma
Education: B.Tech Computer Science, Tier-2 Engineering College (2025)
Skills: Python, FastAPI, Next.js, PostgreSQL, Redis, Docker, System Design, LiveKit WebRTC, WebSockets
Projects:
1. Microservices Real-time Chat App: Built with FastAPI, WebSockets, Redis Pub/Sub, and PostgreSQL. Handled 5,000 concurrent socket connections. Implemented JWT authentication and distributed rate limiting with sliding window in Redis.
2. Distributed Task Scheduler: Built with Python, Celery, and RabbitMQ. Processed background batch PDF reports with exponential backoff retry.
3. E-commerce Search Engine: Integrated Elasticsearch with PostgreSQL via Debezium CDC for sub-50ms fuzzy text search.`
    );
    setJd(
      `Role: Backend / Full-Stack Engineer
Requirements:
- Strong experience building resilient APIs with Python (FastAPI/Django) or Node.js.
- Deep understanding of distributed caching (Redis), relational database schema design, and message queues.
- Hands-on experience with WebSockets or WebRTC real-time systems.
- Ability to explain architectural trade-offs, concurrency models, and failure modes under load.`
    );
  };

  // Start Voice Interview (Flow B)
  const startInterview = async () => {
    if (!resumeText.trim()) {
      alert("Please upload your Resume PDF first.");
      return;
    }
    setLoading(true);
    setLoadingStage("Generating custom 5-question viva rubric with Gemini 2.5 Flash...");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/interview/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_text: resumeText,
          job_description: jd || "General Senior Software Engineer Role",
          mode,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to start interview.");
      }

      const data: SessionInfo = await res.json();
      setSessionInfo(data);
      setTranscript([]);
      setScorecard(null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to initiate voice interview. Check backend server.");
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  };

  // End Call & Evaluate (Flow E)
  const endAndEvaluate = async () => {
    if (!sessionInfo) return;
    setLoading(true);
    setLoadingStage("Analyzing transcript & evaluating technical depth and spoken English...");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/interview/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          interview_plan: sessionInfo.interview_plan,
          mode,
        }),
      });

      if (!res.ok) {
        throw new Error("Evaluation failed.");
      }

      const evaluation: ScorecardData = await res.json();

      // Save complete session + scorecard into IndexedDB (zero backend storage cost)
      await saveInterviewSession({
        mode,
        interview_plan: sessionInfo.interview_plan,
        transcript,
        scorecard: evaluation,
        resume_snippet: resumeText.slice(0, 300),
        job_description: jd.slice(0, 300),
      });

      setScorecard(evaluation);
      setSessionInfo(null);
      await refreshPastSessions();
    } catch (err: any) {
      console.error(err);
      alert("Failed to generate scorecard. Please verify backend logs.");
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  };

  // Load Past Session into View
  const handleSelectPastSession = (session: SessionData) => {
    setScorecard(session.scorecard);
    setTranscript(session.transcript || []);
    setMode(session.mode);
    setIsDrawerOpen(false);
  };

  // Delete a Past Session from IndexedDB
  const handleDeleteSession = async (e: React.MouseEvent, id?: number) => {
    e.stopPropagation();
    if (!id) return;
    if (confirm("Delete this past interview record?")) {
      await deleteSession(id);
      await refreshPastSessions();
    }
  };

  // Clear All Sessions
  const handleClearAll = async () => {
    if (confirm("Clear all past interview records from browser IndexedDB?")) {
      await clearAllSessions();
      await refreshPastSessions();
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-20 px-4 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">PrepVoice AI</h1>
                <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Zero-DB Viva Coach
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Real-Time Tech Viva & Spoken English Coach for Engineering Grads
              </p>
            </div>
          </div>

          {/* Past Interviews Drawer Trigger */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition"
          >
            <History className="w-4 h-4 text-indigo-400" />
            <span>Past Interviews</span>
            {pastSessions.length > 0 && (
              <span className="bg-indigo-600 text-white rounded-full px-2 py-0.2 text-[10px] font-bold">
                {pastSessions.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl flex flex-col items-center space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              </div>
              <h3 className="text-lg font-bold text-white">Processing</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{loadingStage}</p>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 1. SETUP VIEW (When not in call and no scorecard) */}
        {/* ==================================================== */}
        {!sessionInfo && !scorecard && (
          <div className="space-y-8 max-w-3xl mx-auto">
            {/* Banner */}
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
                Master Your Tech Viva & Spoken English
              </h2>
              <p className="text-sm text-slate-400 max-w-xl mx-auto">
                Upload your resume PDF. Our client-side parser reads your project stack locally, and
                an AI voice interviewer grills you on real architectural decisions.
              </p>
            </div>

            {/* Setup Form */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
              {/* Step 1: Upload Resume */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold flex items-center gap-2 text-slate-200">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <span>1. Upload Resume PDF</span>
                    <span className="text-[11px] font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Browser-only parsing (₹0 Server RAM)
                    </span>
                  </label>
                  {!resumeText && (
                    <button
                      type="button"
                      onClick={loadSampleData}
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Load Demo Resume & JD
                    </button>
                  )}
                </div>

                <div className="relative border-2 border-dashed border-slate-700 hover:border-indigo-500/70 rounded-2xl p-6 transition text-center bg-slate-950/40">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <UploadCloud className="w-8 h-8 text-indigo-400" />
                    {fileName ? (
                      <div>
                        <p className="text-sm font-semibold text-white">{fileName}</p>
                        <p className="text-xs text-emerald-400 mt-1">
                          ✓ Extracted {resumeText.length} characters locally via PDF.js
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-slate-300">
                          Click or drag your Resume PDF here
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Parsed 100% in your browser. No files are stored on server.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 2: Target JD */}
              <div>
                <label className="text-sm font-semibold flex items-center gap-2 text-slate-200 mb-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span>2. Target Role / Job Description</span>
                  <span className="text-xs font-normal text-slate-500">(Optional)</span>
                </label>
                <textarea
                  rows={4}
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder="Paste target role requirements, e.g., Full Stack Engineer, Next.js, FastAPI, Microservices, Redis, PostgreSQL..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* Step 3: Interview Mode */}
              <div>
                <label className="text-sm font-semibold flex items-center gap-2 text-slate-200 mb-3">
                  <Award className="w-4 h-4 text-indigo-400" />
                  <span>3. Select Interview Mode</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: "Project Viva",
                      title: "Project Viva",
                      desc: "Deep-dive grilling on projects, system architecture & trade-offs",
                    },
                    {
                      id: "DSA & Core CS",
                      title: "DSA & Core CS",
                      desc: "Verbal complexities, algorithms, OS, DBMS & CN fundamentals",
                    },
                    {
                      id: "HR & Behavioural",
                      title: "HR & Behavioural",
                      desc: "STAR method, teamwork, conflict resolution & ownership",
                    },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMode(m.id)}
                      className={`text-left p-4 rounded-2xl border transition flex flex-col justify-between ${
                        mode === m.id
                          ? "bg-indigo-600/15 border-indigo-500 text-white shadow-lg shadow-indigo-500/10"
                          : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-bold text-white mb-1">{m.title}</p>
                        <p className="text-xs text-slate-400 leading-relaxed">{m.desc}</p>
                      </div>
                      <div className="mt-3 flex items-center justify-end">
                        {mode === m.id && (
                          <span className="flex h-2 w-2 rounded-full bg-indigo-400" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Launch Button */}
              <button
                type="button"
                disabled={!resumeText || loading}
                onClick={startInterview}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition shadow-xl shadow-indigo-600/20 text-sm sm:text-base flex items-center justify-center gap-2"
              >
                <Mic className="w-5 h-5" />
                <span>Start 10-Minute Live Voice Interview</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 2. ACTIVE LIVEKIT ROOM VIEW */}
        {/* ==================================================== */}
        {sessionInfo && (
          <LiveKitRoom
            token={sessionInfo.token}
            serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
            connect={true}
            audio={true}
            video={false}
          >
            <ActiveInterviewRoom
              onEndInterview={endAndEvaluate}
              transcript={transcript}
              setTranscript={setTranscript}
              sessionInfo={sessionInfo}
              resumeText={resumeText}
            />
          </LiveKitRoom>
        )}

        {/* ==================================================== */}
        {/* 3. POST-INTERVIEW SCORECARD & REFACTORING DASHBOARD */}
        {/* ==================================================== */}
        {scorecard && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Interview Completed
                  </span>
                  <span className="text-xs text-slate-400">• Mode: {mode}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Mock Interview Evaluation
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Saved locally to your browser IndexedDB with ₹0 storage footprint.
                </p>
              </div>

              <button
                onClick={() => {
                  setScorecard(null);
                  setTranscript([]);
                  setSessionInfo(null);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl transition text-sm flex items-center gap-2 shrink-0 self-start sm:self-center"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Practice Another Session</span>
              </button>
            </div>

            {/* Score Gauges */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center shadow-lg">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Technical Depth
                </p>
                <p className="text-3xl sm:text-4xl font-black text-indigo-400 mt-2">
                  {scorecard.technical_depth_score}
                  <span className="text-sm font-normal text-slate-500">/100</span>
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center shadow-lg">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Spoken Clarity
                </p>
                <p className="text-3xl sm:text-4xl font-black text-emerald-400 mt-2">
                  {scorecard.communication_clarity_score}
                  <span className="text-sm font-normal text-slate-500">/100</span>
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center shadow-lg">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Confidence
                </p>
                <p className="text-3xl sm:text-4xl font-black text-purple-400 mt-2">
                  {scorecard.confidence_score}
                  <span className="text-sm font-normal text-slate-500">/100</span>
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center shadow-lg">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Filler Words
                </p>
                <p className="text-3xl sm:text-4xl font-black text-amber-400 mt-2">
                  {scorecard.filler_words_count}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">um, uh, basically, like</p>
              </div>
            </div>

            {/* Overall Summary Card */}
            {scorecard.overall_summary && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Executive Feedback Summary</span>
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {scorecard.overall_summary}
                </p>
              </div>
            )}

            {/* Spoken English Refactoring */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Spoken English Refactoring
                  </h3>
                  <p className="text-xs text-slate-400">
                    What You Said vs. Professional Tech Interview Phrasing
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {scorecard.english_refactoring?.map((item, i) => (
                  <div
                    key={i}
                    className="p-5 bg-slate-950 rounded-2xl border border-slate-800 space-y-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-start gap-2 text-rose-400 text-xs sm:text-sm">
                        <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                        <span className="font-semibold text-rose-300">What you said:</span>
                        <span className="italic text-rose-200">&ldquo;{item.original_spoken}&rdquo;</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-start gap-2 text-emerald-400 text-xs sm:text-sm">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                        <span className="font-semibold text-emerald-300">Professional version:</span>
                        <span className="font-medium text-emerald-100">
                          &ldquo;{item.professional_version}&rdquo;
                        </span>
                      </div>
                    </div>

                    {item.why_it_works && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          Why this works:{" "}
                        </span>
                        <span className="text-xs text-slate-300">{item.why_it_works}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Question-by-Question Technical Feedback */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <span>Question-by-Question Viva Breakdown</span>
              </h3>

              <div className="space-y-3">
                {scorecard.question_feedback?.map((q, idx) => {
                  const isOpen = expandedQuestion === idx;
                  return (
                    <div
                      key={idx}
                      className="border border-slate-800 rounded-2xl bg-slate-950/70 overflow-hidden transition"
                    >
                      <button
                        onClick={() => setExpandedQuestion(isOpen ? null : idx)}
                        className="w-full p-4 text-left flex items-center justify-between gap-3 hover:bg-slate-800/30 transition"
                      >
                        <div className="flex items-center gap-3">
                          <span className="h-6 w-6 rounded-full bg-indigo-600/20 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <p className="text-sm font-semibold text-slate-200">{q.question}</p>
                        </div>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                      </button>

                      {isOpen && (
                        <div className="p-5 pt-0 space-y-3 border-t border-slate-800/60 text-xs sm:text-sm">
                          <div>
                            <p className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-1">
                              Your Answer Summary:
                            </p>
                            <p className="text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                              {q.user_answer_summary || "Candidate provided minimal response."}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] font-bold uppercase text-emerald-400 tracking-wider mb-1">
                              What Went Well:
                            </p>
                            <p className="text-emerald-200/90 bg-emerald-950/20 p-3 rounded-xl border border-emerald-500/20">
                              {q.what_went_well}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] font-bold uppercase text-indigo-400 tracking-wider mb-1">
                              Ideal Answer for Top MNCs:
                            </p>
                            <p className="text-indigo-200/90 bg-indigo-950/20 p-3 rounded-xl border border-indigo-500/20 leading-relaxed">
                              {q.ideal_improved_answer}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 4. PAST SESSIONS SLIDE-OUT DRAWER */}
      {/* ==================================================== */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
          />

          {/* Drawer Content */}
          <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 h-full p-6 shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-right duration-300">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-white">Past Interview Sessions</h3>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-180px)] pr-1">
                {pastSessions.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No past interviews recorded yet.</p>
                  </div>
                ) : (
                  pastSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => handleSelectPastSession(session)}
                      className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-indigo-500/60 cursor-pointer transition space-y-2 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-400">{session.mode}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500">
                            {session.createdAt
                              ? new Date(session.createdAt).toLocaleDateString()
                              : "Recent"}
                          </span>
                          <button
                            onClick={(e) => handleDeleteSession(e, session.id)}
                            className="text-slate-500 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-900 text-center">
                        <div className="bg-slate-900/60 p-1.5 rounded-lg">
                          <p className="text-[9px] text-slate-500">Tech</p>
                          <p className="text-xs font-bold text-indigo-300">
                            {session.scorecard?.technical_depth_score || 0}
                          </p>
                        </div>
                        <div className="bg-slate-900/60 p-1.5 rounded-lg">
                          <p className="text-[9px] text-slate-500">Clarity</p>
                          <p className="text-xs font-bold text-emerald-300">
                            {session.scorecard?.communication_clarity_score || 0}
                          </p>
                        </div>
                        <div className="bg-slate-900/60 p-1.5 rounded-lg">
                          <p className="text-[9px] text-slate-500">Confidence</p>
                          <p className="text-xs font-bold text-purple-300">
                            {session.scorecard?.confidence_score || 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {pastSessions.length > 0 && (
              <div className="pt-4 border-t border-slate-800">
                <button
                  onClick={handleClearAll}
                  className="w-full bg-slate-950 hover:bg-rose-950/30 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800/40 py-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear All History</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 px-4 text-center text-xs text-slate-600">
        PrepVoice AI — Client-side PDF.js & IndexedDB zero-cost architecture with Gemini 2.5 Flash & LiveKit Voice.
      </footer>
    </main>
  );
}
