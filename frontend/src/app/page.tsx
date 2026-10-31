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
  Terminal,
  Activity,
  ArrowRight,
  Radio,
  Cpu,
  Layers,
  Code2,
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
// Active LiveKit Voice Studio Component
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

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // LiveKit Data Channel listener
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

  // Request Rescue Hint
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
        setActiveHint(data.hint || "Highlight your architectural trade-offs and latency considerations.");
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
      {/* Floating Tactical Lifeline Banner */}
      {activeHint && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 w-11/12 max-w-xl bg-[#141209]/95 border border-amber-500/50 text-amber-200 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400">
                Tactical Viva Lifeline
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

      {/* Main Studio Console */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Console: Audio Visualizer & Controls */}
        <div className="md:col-span-2 bg-[#0d121d] border border-[#1b2333] rounded-3xl p-6 sm:p-8 flex flex-col justify-between min-h-[480px] shadow-2xl relative overflow-hidden">
          {/* Subtle Top Glow Accent */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

          {/* Console Header Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-2.5 w-2.5 rounded-full ${
                  state === "speaking"
                    ? "bg-cyan-400 shadow-[0_0_8px_#38bdf8]"
                    : state === "listening"
                    ? "bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse"
                    : "bg-slate-500"
                }`}
              />
              <span className="px-3 py-1 rounded-lg text-xs font-mono font-semibold uppercase tracking-wider bg-[#131a29] border border-[#1e273b] text-slate-300">
                Agent: {state || "Connected"}
              </span>
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-lg text-[11px] font-mono bg-[#131a29] border border-[#1e273b] text-slate-400">
                {sessionInfo.room_name}
              </span>
            </div>

            {/* Countdown Clock */}
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-mono text-xs font-semibold ${
                secondsLeft <= 120
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse"
                  : "bg-[#131a29] border-[#1e273b] text-slate-300"
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{formatTime(secondsLeft)}</span>
            </div>
          </div>

          {/* Central Audio Waveform Console */}
          <div className="flex flex-col items-center justify-center my-8">
            <div className="h-40 w-full flex items-center justify-center">
              <BarVisualizer
                state={state}
                barCount={9}
                trackRef={audioTrack}
                className="h-32 w-4/5 max-w-xs text-cyan-400"
              />
            </div>
            <p className="text-xs font-mono text-slate-400 mt-2 text-center">
              {state === "speaking"
                ? "Interviewer is speaking..."
                : state === "listening"
                ? "Listening... Speak naturally and articulate your technical reasoning."
                : "Interviewer is evaluating your response..."}
            </p>
          </div>

          {/* Bottom Control Deck */}
          <div className="w-full flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#1b2333]">
            <div className="flex items-center gap-3">
              <ControlBar
                controls={{ microphone: true, camera: false, screenShare: false, leave: false }}
              />

              {/* Rescue Lifeline Button */}
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
              className="bg-rose-600 hover:bg-rose-500 text-white font-semibold px-5 py-2.5 rounded-xl transition shadow-lg shadow-rose-900/30 text-xs sm:text-sm flex items-center gap-2"
            >
              <span>End & Generate Scorecard</span>
            </button>
          </div>
        </div>

        {/* Right Console: Live Transcript Terminal */}
        <div className="bg-[#0d121d] border border-[#1b2333] rounded-3xl p-5 flex flex-col h-[480px] shadow-2xl relative">
          <div className="flex items-center justify-between pb-3 border-b border-[#1b2333]">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                Live Speech Terminal
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              {transcript.length} turns
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3.5 py-3 pr-1 text-sm">
            {transcript.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500">
                <Radio className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
                <p className="text-xs font-mono">
                  Voice session connected. Turns will stream here in real-time.
                </p>
              </div>
            ) : (
              transcript.map((t, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl transition border ${
                    t.speaker === "Interviewer"
                      ? "bg-[#131a29]/90 text-slate-200 border-[#1e273b]"
                      : "bg-cyan-950/20 text-cyan-100 border-cyan-500/30 ml-2"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-[11px] font-mono font-bold uppercase ${
                        t.speaker === "Interviewer" ? "text-cyan-400" : "text-emerald-400"
                      }`}
                    >
                      {t.speaker}
                    </span>
                    {t.timestamp && (
                      <span className="text-[10px] font-mono text-slate-500">{t.timestamp}</span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-slate-300">{t.text}</p>
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
// Main Application
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

  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [pastSessions, setPastSessions] = useState<SessionData[]>([]);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(0);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      setLoading(true);
      setLoadingStage("Extracting text locally via PDF.js worker...");
      const text = await extractTextFromPDF(file);
      setResumeText(text);
    } catch (err) {
      console.error("PDF Parsing Error:", err);
      alert("Failed to parse PDF in browser. Ensure it is a valid text-based PDF.");
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  };

  const loadSampleData = () => {
    setFileName("Aarav_Sharma_Resume.pdf");
    setResumeText(
      `Candidate Name: Aarav Sharma
Education: B.Tech Computer Science (2025)
Skills: Python, FastAPI, Next.js, PostgreSQL, Redis, Docker, System Design, WebSockets, LiveKit
Projects:
1. High-Throughput Chat Engine: Built with FastAPI, WebSockets, and Redis Pub/Sub. Handled 5,000 concurrent socket connections. Implemented sliding-window rate limiting in Redis and PostgreSQL connection pooling.
2. Distributed Background Task Queue: Built with Python, Celery, and RabbitMQ. Automated batch report generation with exponential backoff and dead-letter queues.
3. Sub-50ms Search Microservice: Synchronized PostgreSQL data to Elasticsearch via Debezium CDC for full-text fuzzy matching.`
    );
    setJd(
      `Role: Backend / Distributed Systems Engineer
Requirements:
- Hands-on experience developing resilient services with Python (FastAPI/Django) or Node.js.
- Strong knowledge of caching architectures (Redis), database schema indexing, and concurrency models.
- Familiarity with WebSockets or real-time WebRTC audio/video systems.
- Ability to articulate system trade-offs, edge-case mitigation, and scaling failure modes.`
    );
  };

  const startInterview = async () => {
    if (!resumeText.trim()) {
      alert("Please upload your Resume PDF first.");
      return;
    }
    setLoading(true);
    setLoadingStage("Synthesizing custom 5-question viva rubric with Gemini 2.5 Flash...");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/interview/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_text: resumeText,
          job_description: jd || "Backend / Full-Stack Engineer Role",
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
      alert(err.message || "Failed to initialize voice session. Verify backend server.");
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  };

  const endAndEvaluate = async () => {
    if (!sessionInfo) return;
    setLoading(true);
    setLoadingStage("Evaluating technical depth, spoken clarity, and English refactoring...");

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

  const handleSelectPastSession = (session: SessionData) => {
    setScorecard(session.scorecard);
    setTranscript(session.transcript || []);
    setMode(session.mode);
    setIsDrawerOpen(false);
  };

  const handleDeleteSession = async (e: React.MouseEvent, id?: number) => {
    e.stopPropagation();
    if (!id) return;
    if (confirm("Delete this session record?")) {
      await deleteSession(id);
      await refreshPastSessions();
    }
  };

  const handleClearAll = async () => {
    if (confirm("Clear all past interview records from browser IndexedDB?")) {
      await clearAllSessions();
      await refreshPastSessions();
    }
  };

  return (
    <main className="min-h-screen bg-[#080b11] text-slate-100 flex flex-col justify-between selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Header Navigation */}
      <header className="border-b border-[#1b2333]/80 bg-[#080b11]/85 backdrop-blur-md sticky top-0 z-20 px-4 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-950/50 border border-cyan-400/30">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold font-heading tracking-tight text-white">
                  PrepVoice AI
                </h1>
                <span className="text-[10px] uppercase font-mono font-semibold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Viva Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Autonomous Project Viva & Spoken English Coach for Engineers
              </p>
            </div>
          </div>

          {/* Past Interviews Trigger */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-2 bg-[#0e1422] hover:bg-[#151e33] border border-[#1e273b] hover:border-cyan-500/40 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition"
          >
            <History className="w-4 h-4 text-cyan-400" />
            <span>Past Interviews</span>
            {pastSessions.length > 0 && (
              <span className="bg-cyan-600 text-white rounded-full px-2 py-0.2 text-[10px] font-mono font-bold">
                {pastSessions.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Loading Modal */}
        {loading && (
          <div className="fixed inset-0 z-50 bg-[#080b11]/85 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <div className="bg-[#0e1422] border border-[#1e273b] rounded-3xl p-8 max-w-md w-full text-center shadow-2xl flex flex-col items-center space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              </div>
              <h3 className="text-lg font-heading font-bold text-white">Analyzing & Preparing</h3>
              <p className="text-xs text-slate-400 font-mono leading-relaxed">{loadingStage}</p>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 1. SETUP VIEW */}
        {/* ==================================================== */}
        {!sessionInfo && !scorecard && (
          <div className="space-y-8 max-w-3xl mx-auto">
            {/* Hero Banner */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono font-medium">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                Zero-Database Cost • Browser-Parsed Resume • Real-Time WebRTC
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold font-heading tracking-tight text-white">
                Crack Your Engineering Viva & Spoken English
              </h2>
              <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
                Upload your resume PDF. The AI interviewer grills you on your actual project architecture,
                system bottlenecks, and refactors your spoken answers into executive tech phrasing.
              </p>
            </div>

            {/* Setup Form Card */}
            <div className="bg-[#0d121d] border border-[#1b2333] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

              {/* Step 1: Upload Resume */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold flex items-center gap-2 text-slate-200">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span>1. Upload Resume PDF</span>
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Local PDF.js (0 Server RAM)
                    </span>
                  </label>
                  {!resumeText && (
                    <button
                      type="button"
                      onClick={loadSampleData}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 hover:underline"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Load Demo Profile
                    </button>
                  )}
                </div>

                <div className="relative border-2 border-dashed border-[#1e273b] hover:border-cyan-500/50 rounded-2xl p-6 transition text-center bg-[#0a0e17]/60 group">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <UploadCloud className="w-8 h-8 text-cyan-400 group-hover:scale-110 transition duration-200" />
                    {fileName ? (
                      <div>
                        <p className="text-sm font-semibold text-white">{fileName}</p>
                        <p className="text-xs font-mono text-emerald-400 mt-1">
                          ✓ Extracted {resumeText.length} characters locally via PDF.js
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-slate-300">
                          Click or drag your Resume PDF here
                        </p>
                        <p className="text-xs text-slate-500 mt-1 font-mono">
                          Parsed client-side in your browser. No files stored on any server.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 2: Target JD */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold flex items-center gap-2 text-slate-200">
                    <Code2 className="w-4 h-4 text-cyan-400" />
                    <span>2. Target Role / Job Description</span>
                    <span className="text-xs text-slate-500">(Optional)</span>
                  </label>
                </div>
                <textarea
                  rows={3}
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder="Paste target role requirements, e.g., Full Stack Engineer, Next.js, FastAPI, Microservices, Redis, PostgreSQL..."
                  className="w-full bg-[#090d16] border border-[#1b2333] rounded-2xl p-4 text-xs sm:text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition font-mono"
                />
              </div>

              {/* Step 3: Interview Mode Selection */}
              <div>
                <label className="text-sm font-semibold flex items-center gap-2 text-slate-200 mb-3">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>3. Select Interview Mode</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: "Project Viva",
                      title: "Project Viva",
                      desc: "Deep-dive grilling on resume projects, architectural choices & trade-offs",
                    },
                    {
                      id: "DSA & Core CS",
                      title: "DSA & Core CS",
                      desc: "Algorithmic thinking, time/space complexities, OS & DBMS transactions",
                    },
                    {
                      id: "HR & Behavioural",
                      title: "HR & Behavioural",
                      desc: "STAR-method evaluation, technical leadership & conflict resolution",
                    },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMode(m.id)}
                      className={`text-left p-4 rounded-2xl border transition flex flex-col justify-between ${
                        mode === m.id
                          ? "bg-cyan-950/30 border-cyan-500 text-white shadow-lg shadow-cyan-950/40"
                          : "bg-[#090d16]/80 border-[#1b2333] text-slate-400 hover:border-[#273248]"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-bold font-heading text-white mb-1">{m.title}</p>
                        <p className="text-xs text-slate-400 leading-relaxed">{m.desc}</p>
                      </div>
                      <div className="mt-3 flex items-center justify-end">
                        {mode === m.id && (
                          <span className="flex h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#38bdf8]" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Launch Action */}
              <button
                type="button"
                disabled={!resumeText || loading}
                onClick={startInterview}
                className="w-full bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition shadow-xl shadow-cyan-950/60 text-sm sm:text-base flex items-center justify-center gap-2"
              >
                <Mic className="w-5 h-5" />
                <span>Initialize 10-Minute Live Voice Viva</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 2. ACTIVE LIVEKIT ROOM */}
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
        {/* 3. POST-INTERVIEW SCORECARD DASHBOARD */}
        {/* ==================================================== */}
        {scorecard && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header Card */}
            <div className="bg-[#0d121d] border border-[#1b2333] rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-3 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Viva Completed
                  </span>
                  <span className="text-xs font-mono text-slate-400">• Mode: {mode}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-white">
                  Technical Viva Dossier
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Persisted locally in browser IndexedDB (zero backend storage cost).
                </p>
              </div>

              <button
                onClick={() => {
                  setScorecard(null);
                  setTranscript([]);
                  setSessionInfo(null);
                }}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-5 py-2.5 rounded-xl transition text-xs sm:text-sm flex items-center gap-2 shrink-0 self-start sm:self-center shadow-lg shadow-cyan-900/30"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Practice Another Session</span>
              </button>
            </div>

            {/* Score Gauges */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#0d121d] border border-[#1b2333] rounded-2xl p-5 text-center shadow-lg">
                <p className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                  Technical Depth
                </p>
                <p className="text-3xl sm:text-4xl font-mono font-black text-cyan-400 mt-2">
                  {scorecard.technical_depth_score}
                  <span className="text-sm font-normal text-slate-500">/100</span>
                </p>
              </div>

              <div className="bg-[#0d121d] border border-[#1b2333] rounded-2xl p-5 text-center shadow-lg">
                <p className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                  Spoken Clarity
                </p>
                <p className="text-3xl sm:text-4xl font-mono font-black text-emerald-400 mt-2">
                  {scorecard.communication_clarity_score}
                  <span className="text-sm font-normal text-slate-500">/100</span>
                </p>
              </div>

              <div className="bg-[#0d121d] border border-[#1b2333] rounded-2xl p-5 text-center shadow-lg">
                <p className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                  Confidence
                </p>
                <p className="text-3xl sm:text-4xl font-mono font-black text-teal-400 mt-2">
                  {scorecard.confidence_score}
                  <span className="text-sm font-normal text-slate-500">/100</span>
                </p>
              </div>

              <div className="bg-[#0d121d] border border-[#1b2333] rounded-2xl p-5 text-center shadow-lg">
                <p className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                  Filler Words
                </p>
                <p className="text-3xl sm:text-4xl font-mono font-black text-amber-400 mt-2">
                  {scorecard.filler_words_count}
                </p>
                <p className="text-[10px] font-mono text-slate-500 mt-1">um, uh, basically, like</p>
              </div>
            </div>

            {/* Overall Summary */}
            {scorecard.overall_summary && (
              <div className="bg-[#0d121d] border border-[#1b2333] rounded-3xl p-6 shadow-xl">
                <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Executive Feedback Summary</span>
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {scorecard.overall_summary}
                </p>
              </div>
            )}

            {/* Spoken English Refactoring */}
            <div className="bg-[#0d121d] border border-[#1b2333] rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-heading text-white">
                    Spoken English Refactoring
                  </h3>
                  <p className="text-xs text-slate-400">
                    What You Said vs. Executive Tech Phrasing
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {scorecard.english_refactoring?.map((item, i) => (
                  <div
                    key={i}
                    className="p-5 bg-[#090d16] rounded-2xl border border-[#1b2333] space-y-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-start gap-2 text-rose-400 text-xs sm:text-sm">
                        <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                        <span className="font-semibold text-rose-300">What you said:</span>
                        <span className="italic text-rose-200 font-mono">&ldquo;{item.original_spoken}&rdquo;</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-start gap-2 text-emerald-400 text-xs sm:text-sm">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                        <span className="font-semibold text-emerald-300">Executive version:</span>
                        <span className="font-medium text-emerald-100 font-mono">
                          &ldquo;{item.professional_version}&rdquo;
                        </span>
                      </div>
                    </div>

                    {item.why_it_works && (
                      <div className="pt-2 border-t border-[#1b2333]">
                        <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
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
            <div className="bg-[#0d121d] border border-[#1b2333] rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
              <h3 className="text-lg font-bold font-heading text-white mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <span>Question-by-Question Viva Breakdown</span>
              </h3>

              <div className="space-y-3">
                {scorecard.question_feedback?.map((q, idx) => {
                  const isOpen = expandedQuestion === idx;
                  return (
                    <div
                      key={idx}
                      className="border border-[#1b2333] rounded-2xl bg-[#090d16]/80 overflow-hidden transition"
                    >
                      <button
                        onClick={() => setExpandedQuestion(isOpen ? null : idx)}
                        className="w-full p-4 text-left flex items-center justify-between gap-3 hover:bg-[#121826] transition"
                      >
                        <div className="flex items-center gap-3">
                          <span className="h-6 w-6 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
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
                        <div className="p-5 pt-0 space-y-3 border-t border-[#1b2333] text-xs sm:text-sm">
                          <div>
                            <p className="text-[11px] font-mono font-bold uppercase text-slate-400 tracking-wider mb-1">
                              Your Answer Summary:
                            </p>
                            <p className="text-slate-300 bg-[#0d121d] p-3 rounded-xl border border-[#1b2333]">
                              {q.user_answer_summary || "Candidate provided minimal response."}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] font-mono font-bold uppercase text-emerald-400 tracking-wider mb-1">
                              What Went Well:
                            </p>
                            <p className="text-emerald-200/90 bg-emerald-950/20 p-3 rounded-xl border border-emerald-500/20">
                              {q.what_went_well}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] font-mono font-bold uppercase text-cyan-400 tracking-wider mb-1">
                              Ideal Answer for Top Tier MNCs:
                            </p>
                            <p className="text-cyan-200/90 bg-cyan-950/20 p-3 rounded-xl border border-cyan-500/20 leading-relaxed">
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
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-[#080b11]/80 backdrop-blur-sm animate-in fade-in duration-200"
          />

          <div className="relative w-full max-w-md bg-[#0d121d] border-l border-[#1b2333] h-full p-6 shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-right duration-300">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#1b2333] mb-4">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-heading font-bold text-white">Past Interview Sessions</h3>
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
                    <History className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-600" />
                    <p className="text-xs font-mono">No past interviews recorded yet.</p>
                  </div>
                ) : (
                  pastSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => handleSelectPastSession(session)}
                      className="p-4 rounded-2xl bg-[#090d16] border border-[#1b2333] hover:border-cyan-500/50 cursor-pointer transition space-y-2 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-heading text-cyan-400">{session.mode}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-500">
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

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1b2333] text-center">
                        <div className="bg-[#0e1422] p-1.5 rounded-lg">
                          <p className="text-[9px] font-mono text-slate-500">Tech</p>
                          <p className="text-xs font-mono font-bold text-cyan-400">
                            {session.scorecard?.technical_depth_score || 0}
                          </p>
                        </div>
                        <div className="bg-[#0e1422] p-1.5 rounded-lg">
                          <p className="text-[9px] font-mono text-slate-500">Clarity</p>
                          <p className="text-xs font-mono font-bold text-emerald-400">
                            {session.scorecard?.communication_clarity_score || 0}
                          </p>
                        </div>
                        <div className="bg-[#0e1422] p-1.5 rounded-lg">
                          <p className="text-[9px] font-mono text-slate-500">Confidence</p>
                          <p className="text-xs font-mono font-bold text-teal-400">
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
              <div className="pt-4 border-t border-[#1b2333]">
                <button
                  onClick={handleClearAll}
                  className="w-full bg-[#090d16] hover:bg-rose-950/20 text-slate-400 hover:text-rose-400 border border-[#1b2333] hover:border-rose-900/40 py-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear All History</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Technical Footer */}
      <footer className="border-t border-[#1b2333] py-4 px-4 text-center text-xs text-slate-500 font-mono">
        PrepVoice AI — Client-Side PDF.js & IndexedDB Zero-Cost Architecture with Gemini 2.5 Flash & LiveKit WebRTC
      </footer>
    </main>
  );
}
