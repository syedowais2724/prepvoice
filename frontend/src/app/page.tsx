"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  Check,
  ArrowRight,
  Radio,
  Layers,
  Code2,
  CheckCircle,
  TrendingUp,
  BarChart3,
  Copy,
  Printer,
  ShieldCheck,
  Cpu,
  Zap,
  Volume2,
  VolumeX,
  Bot,
  UserCheck,
  Target,
  BookmarkCheck,
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
// Circular Score Gauge Component
// ----------------------------------------------------
function CircularGauge({
  score,
  max = 100,
  label,
  color = "blue",
  subtitle,
}: {
  score: number;
  max?: number;
  label: string;
  color?: "blue" | "emerald" | "slate" | "amber";
  subtitle?: string;
}) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.min(Math.max(score, 0), max);
  const strokeDashoffset = circumference - (clampedScore / max) * circumference;

  const colorMap = {
    blue: {
      stroke: "#2563eb",
      badgeBg: "bg-blue-50",
      badgeText: "text-blue-700",
      border: "border-blue-100",
      scoreText: "text-blue-600",
    },
    emerald: {
      stroke: "#059669",
      badgeBg: "bg-emerald-50",
      badgeText: "text-emerald-700",
      border: "border-emerald-100",
      scoreText: "text-emerald-600",
    },
    slate: {
      stroke: "#334155",
      badgeBg: "bg-slate-100",
      badgeText: "text-slate-800",
      border: "border-slate-200",
      scoreText: "text-slate-800",
    },
    amber: {
      stroke: "#d97706",
      badgeBg: "bg-amber-50",
      badgeText: "text-amber-800",
      border: "border-amber-100",
      scoreText: "text-amber-600",
    },
  };

  const scheme = colorMap[color] || colorMap.blue;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 flex flex-col items-center justify-between shadow-[0_1px_3px_rgba(15,23,42,0.04),0_6px_20px_-4px_rgba(15,23,42,0.06)] hover:border-slate-300 transition-all">
      <div className="w-full flex items-center justify-between mb-2">
        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <span
          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${scheme.badgeBg} ${scheme.badgeText}`}
        >
          {score >= 80 ? "Top 10%" : score >= 65 ? "Proficient" : "Focus Area"}
        </span>
      </div>

      <div className="relative w-24 h-24 flex items-center justify-center my-1.5">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            className="stroke-slate-100"
            strokeWidth="8"
            fill="transparent"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke={scheme.stroke}
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-mono font-black ${scheme.scoreText} tracking-tight`}>
            {score}
          </span>
          <span className="text-[10px] font-mono text-slate-400">/{max}</span>
        </div>
      </div>

      {subtitle && (
        <p className="text-[11px] text-slate-500 font-mono text-center mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------
// Active LiveKit Voice Studio (Refined Soundboard)
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

  // LiveKit Data Channel listener for live speech turns
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

  // Request Rescue Lifeline Hint
  const handleRequestHint = async () => {
    if (hintLoading) return;
    setHintLoading(true);
    try {
      const lastInterviewerQuestion = [...transcript]
        .reverse()
        .find((t) => t.speaker.toLowerCase() === "interviewer")?.text;

      const res = await fetch(`/api/interview/hint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcript.slice(-4),
          resume_text: resumeText.slice(0, 2000),
          current_question:
            lastInterviewerQuestion ||
            sessionInfo.interview_plan.questions[0] ||
            "Project viva question",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveHint(
          data.hint ||
            "Highlight your architectural trade-offs, caching latency, and failover strategy."
        );
        setTimeout(() => setActiveHint(null), 14000);
      }
    } catch (err) {
      console.error("Failed to fetch rescue hint:", err);
      setActiveHint(
        "Highlight the trade-off between latency, throughput, and database choice."
      );
      setTimeout(() => setActiveHint(null), 8000);
    } finally {
      setHintLoading(false);
    }
  };

  return (
    <div className="relative max-w-5xl mx-auto space-y-6">
      {/* Floating Tactical Lifeline Banner */}
      {activeHint && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 w-11/12 max-w-xl bg-amber-50/95 backdrop-blur-md border border-amber-300 text-amber-950 px-5 py-4 rounded-2xl shadow-xl shadow-amber-500/10 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center border border-amber-200 shrink-0">
              <Lightbulb className="w-4 h-4 text-amber-700 animate-pulse" />
            </div>
            <div>
              <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-800">
                Tactical Viva Lifeline
              </p>
              <p className="text-xs sm:text-sm font-medium text-amber-900 mt-1 leading-relaxed">
                {activeHint}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveHint(null)}
            className="text-amber-700 hover:text-amber-900 p-1 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Studio Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Console: Soundboard & Telemetry Deck */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 flex flex-col justify-between min-h-[520px] shadow-[0_1px_3px_rgba(15,23,42,0.04),0_10px_30px_-5px_rgba(15,23,42,0.06)] relative overflow-hidden">
          {/* Top Status Deck */}
          <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="relative flex items-center justify-center">
                <span
                  className={`h-3 w-3 rounded-full ${
                    state === "speaking"
                      ? "bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.8)]"
                      : state === "listening"
                      ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]"
                      : "bg-slate-400"
                  }`}
                />
                {(state === "speaking" || state === "listening") && (
                  <span
                    className={`absolute -inset-1 rounded-full animate-ping opacity-40 ${
                      state === "speaking" ? "bg-blue-600" : "bg-emerald-500"
                    }`}
                  />
                )}
              </div>

              <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold uppercase tracking-wider bg-slate-100 border border-slate-200 text-slate-800">
                Agent: {state || "Connected"}
              </span>

              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-mono font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                LiveKit WebRTC
              </span>
            </div>

            {/* Countdown Clock */}
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-mono text-xs font-bold ${
                secondsLeft <= 120
                  ? "bg-rose-50 border-rose-300 text-rose-700 animate-pulse"
                  : "bg-slate-50 border-slate-200 text-slate-800 shadow-sm"
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>{formatTime(secondsLeft)}</span>
            </div>
          </div>

          {/* Central Soundwave Studio Visualizer */}
          <div className="flex flex-col items-center justify-center my-6 relative">
            {/* Visual concentric sound rings */}
            <div className="relative flex items-center justify-center w-48 h-48 mb-2">
              <div
                className={`absolute inset-0 rounded-full border border-blue-200/60 transition-all duration-700 ${
                  state === "speaking"
                    ? "scale-125 opacity-100 animate-pulse-ring"
                    : "scale-100 opacity-20"
                }`}
              />
              <div
                className={`absolute inset-4 rounded-full border border-blue-300/40 transition-all duration-500 ${
                  state === "speaking"
                    ? "scale-110 opacity-80"
                    : "scale-95 opacity-20"
                }`}
              />
              <div className="h-28 w-28 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 flex items-center justify-center shadow-inner relative z-10">
                <Bot
                  className={`w-12 h-12 transition-transform duration-300 ${
                    state === "speaking"
                      ? "text-blue-600 scale-110 animate-bounce"
                      : "text-blue-500"
                  }`}
                />
              </div>
            </div>

            {/* Bar Visualizer */}
            <div className="h-24 w-full max-w-sm flex items-center justify-center bg-slate-50/90 rounded-2xl border border-slate-200/80 px-6 shadow-inner">
              <BarVisualizer
                state={state}
                barCount={11}
                trackRef={audioTrack}
                className="h-16 w-full text-blue-600"
              />
            </div>

            {/* Dynamic Telemetry Status */}
            <div className="mt-4 text-center">
              <p className="text-xs font-semibold text-slate-700 flex items-center justify-center gap-2">
                {state === "speaking" ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                    <span>Interviewer is speaking viva question...</span>
                  </>
                ) : state === "listening" ? (
                  <>
                    <Mic className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                    <span className="text-emerald-700">
                      Listening to your answer — speak clearly into your mic
                    </span>
                  </>
                ) : (
                  <>
                    <Cpu className="w-3.5 h-3.5 text-slate-500" />
                    <span>Gemini 2.5 Flash evaluating technical reasoning...</span>
                  </>
                )}
              </p>
              <p className="text-[11px] font-mono text-slate-400 mt-1">
                Silero VAD active • Deepgram en-IN tuned • WebRTC latency &lt;180ms
              </p>
            </div>
          </div>

          {/* Bottom Control Deck */}
          <div className="w-full flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <ControlBar
                controls={{
                  microphone: true,
                  camera: false,
                  screenShare: false,
                  leave: false,
                }}
              />

              {/* Rescue Lifeline Button */}
              <button
                onClick={handleRequestHint}
                disabled={hintLoading}
                className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                {hintLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                ) : (
                  <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span>Need a Hint</span>
              </button>
            </div>

            <button
              onClick={onEndInterview}
              className="bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-bold px-5 py-2.5 rounded-xl transition shadow-md shadow-rose-600/20 text-xs sm:text-sm flex items-center gap-2"
            >
              <span>End & Generate Scorecard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Console: Live Transcript Terminal */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 flex flex-col h-[520px] shadow-[0_1px_3px_rgba(15,23,42,0.04),0_10px_30px_-5px_rgba(15,23,42,0.06)] relative">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
                Live Speech Stream
              </h3>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
              {transcript.length} turns
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1 text-sm">
            {transcript.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                <Radio className="w-8 h-8 text-blue-300 mb-2 animate-pulse" />
                <p className="text-xs font-medium text-slate-600">
                  Voice channel connected.
                </p>
                <p className="text-[11px] font-mono text-slate-400 mt-1">
                  Transcribed turns from Deepgram en-IN stream here in real-time.
                </p>
              </div>
            ) : (
              transcript.map((t, idx) => {
                const isInterviewer =
                  t.speaker.toLowerCase() === "interviewer";
                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl transition border ${
                      isInterviewer
                        ? "bg-slate-50 text-slate-800 border-slate-200"
                        : "bg-blue-50/80 text-slate-900 border-blue-200 ml-2"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        {isInterviewer ? (
                          <Bot className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span
                          className={`text-[11px] font-mono font-bold uppercase ${
                            isInterviewer ? "text-blue-700" : "text-emerald-700"
                          }`}
                        >
                          {t.speaker}
                        </span>
                      </div>
                      {t.timestamp && (
                        <span className="text-[10px] font-mono text-slate-400">
                          {t.timestamp}
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-slate-700">
                      {t.text}
                    </p>
                  </div>
                );
              })
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
  const [mode, setMode] = useState<string>("Project Viva & Architecture");
  const [difficulty, setDifficulty] = useState<string>("Senior (L5)");
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStage, setLoadingStage] = useState<string>("");

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [pastSessions, setPastSessions] = useState<SessionData[]>([]);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(0);
  const [activeTab, setActiveTab] = useState<"english" | "feedback" | "transcript">("english");
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  // Auto-extracted tech skill badges from resume preview
  const extractedSkills = useMemo(() => {
    if (!resumeText) return [];
    const keywords = [
      "FastAPI",
      "Python",
      "Next.js",
      "TypeScript",
      "React",
      "PostgreSQL",
      "Redis",
      "Docker",
      "Kubernetes",
      "Kafka",
      "WebSockets",
      "WebRTC",
      "System Design",
      "Microservices",
      "RabbitMQ",
      "Celery",
      "GraphQL",
      "AWS",
      "CI/CD",
    ];
    return keywords.filter((k) =>
      new RegExp(`\\b${k}\\b`, "i").test(resumeText)
    );
  }, [resumeText]);

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
      setLoadingStage("Extracting text locally via PDF.js worker (0 Server RAM)...");
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

  // Demo Profiles for Instant Testing
  const applyProfile = (type: "backend" | "fullstack" | "ml") => {
    if (type === "backend") {
      setFileName("Aarav_Sharma_Backend_Resume.pdf");
      setResumeText(
        `Candidate Name: Aarav Sharma
Education: B.Tech Computer Science (2025)
Skills: Python, FastAPI, Next.js, PostgreSQL, Redis, Docker, System Design, WebSockets, LiveKit, Celery
Projects:
1. High-Throughput Chat Engine: Built with FastAPI, WebSockets, and Redis Pub/Sub. Handled 5,000 concurrent socket connections. Implemented sliding-window rate limiting in Redis and PostgreSQL connection pooling.
2. Distributed Background Task Queue: Built with Python, Celery, and RabbitMQ. Automated batch report generation with exponential backoff and dead-letter queues.
3. Sub-50ms Search Microservice: Synchronized PostgreSQL data to Elasticsearch via Debezium CDC for full-text fuzzy matching.`
      );
      setJd(
        `Role: Senior Backend / Distributed Systems Engineer
Requirements:
- Hands-on experience developing resilient services with Python (FastAPI) and PostgreSQL.
- Deep knowledge of caching architectures (Redis), database schema indexing, and concurrency models.
- Familiarity with WebSockets or real-time WebRTC audio/video systems.
- Ability to articulate system trade-offs, edge-case mitigation, and scaling failure modes.`
      );
      setMode("Project Viva & Architecture");
    } else if (type === "fullstack") {
      setFileName("Priya_Nair_FullStack_Resume.pdf");
      setResumeText(
        `Candidate Name: Priya Nair
Education: B.E. Information Technology (2024)
Skills: TypeScript, Next.js 15, Node.js, Tailwind CSS, PostgreSQL, Prisma, Redis, Docker, GraphQL
Projects:
1. Enterprise Billing & Invoicing SaaS: Full-stack platform built with Next.js App Router, Server Actions, Stripe webhooks, and Prisma. Implemented idempotent webhook consumers.
2. Real-Time Collaborative Canvas: Built with React, WebSockets, and CRDTs (Yjs) for conflict-free concurrent editing across 20+ simultaneous users.
3. API Gateway & Rate Limiter: Configured Envoy proxy and Redis Token Bucket rate limiting protecting 8 downstream microservices.`
      );
      setJd(
        `Role: Full Stack Engineer (Next.js / TypeScript / Node)
Requirements:
- Strong grasp of React server components, server actions, and client-side performance optimization.
- Experience with relational databases, migrations, and caching strategies.
- Strong verbal communication and ability to explain complex state management trade-offs.`
      );
      setMode("Project Viva & Architecture");
    } else {
      setFileName("Rohan_Mehta_ML_Resume.pdf");
      setResumeText(
        `Candidate Name: Rohan Mehta
Education: M.Tech Artificial Intelligence (2025)
Skills: Python, PyTorch, LangChain, FastAPI, Qdrant Vector DB, Gemini API, Docker, Hugging Face
Projects:
1. Multimodal Document RAG System: Built with LangChain, Qdrant, and Gemini 2.5 Flash. Implemented hybrid dense/sparse search with reciprocal rank fusion (RRF) achieving 94% recall.
2. Real-Time Voice Assistant Pipeline: Integrated Silero VAD, Whisper STT, and Cartesia TTS with under 400ms end-to-end voice latency.
3. Model Quantization Benchmark: Quantized Llama-3 models to 4-bit AWQ with 3.2x inference speedup on T4 GPUs.`
      );
      setJd(
        `Role: Applied AI / LLM Systems Engineer
Requirements:
- Production experience with RAG pipelines, vector databases, and embeddings.
- Experience optimizing voice latency (VAD, streaming STT/TTS).
- Ability to clearly articulate precision/recall trade-offs and latency bottlenecks.`
      );
      setMode("Project Viva & Architecture");
    }
  };

  const startInterview = async () => {
    if (!resumeText.trim()) {
      alert("Please upload your Resume PDF or click a demo profile.");
      return;
    }
    setLoading(true);
    setLoadingStage("Synthesizing custom 5-question viva rubric with Gemini 2.5 Flash...");

    try {
      const res = await fetch(`/api/interview/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_text: resumeText,
          job_description: jd || "Software Engineering Role",
          mode: `${mode} [${difficulty}]`,
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
      alert(err.message || "Failed to initialize voice session.");
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
      const res = await fetch(`/api/interview/evaluate`, {
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
      alert("Failed to generate scorecard.");
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

  const copyScorecardToClipboard = () => {
    if (!scorecard) return;
    const text = `=== PrepVoice AI Technical Viva Dossier ===
Mode: ${mode}
Technical Depth: ${scorecard.technical_depth_score}/100
Spoken Clarity: ${scorecard.communication_clarity_score}/100
Confidence: ${scorecard.confidence_score}/100
Filler Words: ${scorecard.filler_words_count}

Executive Summary:
${scorecard.overall_summary}

Key English Refactorings:
${scorecard.english_refactoring
  .map(
    (e, i) =>
      `${i + 1}. Spoken: "${e.original_spoken}"\n   Executive: "${e.professional_version}"`
  )
  .join("\n\n")}
`;
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 3000);
  };

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col justify-between selection:bg-blue-100 selection:text-blue-900">
      {/* Top Header Navigation */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xl sticky top-0 z-20 px-4 py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-md shadow-blue-500/20 text-white ring-1 ring-blue-500/20">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold font-heading tracking-tight text-slate-900">
                  PrepVoice AI
                </h1>
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LiveKit Audio Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Autonomous Technical Viva & Spoken English Coach
              </p>
            </div>
          </div>

          {/* Action Header Deck */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-sm"
            >
              <History className="w-4 h-4 text-blue-600" />
              <span>Past Sessions</span>
              {pastSessions.length > 0 && (
                <span className="bg-blue-600 text-white rounded-full px-2 py-0.2 text-[10px] font-mono font-bold">
                  {pastSessions.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Loading Modal */}
        {loading && (
          <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl flex flex-col items-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="h-14 w-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center shadow-inner">
                <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
              </div>
              <h3 className="text-lg font-heading font-bold text-slate-900">
                Preparing Viva Session
              </h3>
              <p className="text-xs text-slate-600 font-mono leading-relaxed">
                {loadingStage}
              </p>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 1. SETUP LAUNCHPAD VIEW */}
        {/* ==================================================== */}
        {!sessionInfo && !scorecard && (
          <div className="space-y-8 max-w-4xl mx-auto">
            {/* Hero Launchpad Banner */}
            <div className="text-center space-y-3 pt-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-mono font-medium shadow-sm">
                <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                Zero-Database Cost • Browser PDF.js • Gemini 2.5 Flash Rubrics
              </div>

              <h2 className="text-3xl sm:text-5xl font-extrabold font-heading tracking-tight text-slate-900 max-w-3xl mx-auto leading-tight">
                Master Your Technical Viva & Executive Spoken English
              </h2>

              <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
                Upload your resume PDF. The AI interviewer grills you on your actual project
                architecture, system bottlenecks, and refactors your spoken answers into
                Senior L5 engineering phrasing.
              </p>
            </div>

            {/* Quick Demo Profile Selector Bar */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Instant Demo Profiles:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => applyProfile("backend")}
                  className="px-3 py-1.5 rounded-xl text-xs font-mono font-medium bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 transition"
                >
                  🚀 Backend / Distributed Systems
                </button>
                <button
                  type="button"
                  onClick={() => applyProfile("fullstack")}
                  className="px-3 py-1.5 rounded-xl text-xs font-mono font-medium bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 transition"
                >
                  ⚡ Full Stack (Next.js / TS)
                </button>
                <button
                  type="button"
                  onClick={() => applyProfile("ml")}
                  className="px-3 py-1.5 rounded-xl text-xs font-mono font-medium bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 transition"
                >
                  🧠 Applied AI & RAG
                </button>
              </div>
            </div>

            {/* Setup Form Console */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_10px_30px_-5px_rgba(15,23,42,0.06)]">
              {/* Step 1: Resume Upload */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold flex items-center gap-2 text-slate-900">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>1. Upload Resume PDF</span>
                    <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Local PDF.js (0 RAM)
                    </span>
                  </label>
                  {resumeText && (
                    <button
                      type="button"
                      onClick={() => {
                        setResumeText("");
                        setFileName("");
                      }}
                      className="text-xs text-rose-600 hover:underline font-mono"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="relative border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 transition text-center bg-slate-50/60 group">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="h-12 w-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center group-hover:scale-105 transition duration-200">
                      <UploadCloud className="w-6 h-6 text-blue-600" />
                    </div>
                    {fileName ? (
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {fileName}
                        </p>
                        <p className="text-xs font-mono text-emerald-700 mt-1 font-semibold">
                          ✓ Extracted {resumeText.length} characters locally
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Click or drag your Resume PDF here
                        </p>
                        <p className="text-xs text-slate-500 mt-1 font-mono">
                          Parsed 100% client-side in your browser. Zero backend storage.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Parsed Tech Stack Badges preview */}
                {extractedSkills.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-mono font-bold text-slate-500 uppercase mr-1">
                      Detected Skills:
                    </span>
                    {extractedSkills.map((s, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                      >
                        #{s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Step 2: Target JD */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold flex items-center gap-2 text-slate-900">
                    <Code2 className="w-4 h-4 text-blue-600" />
                    <span>2. Target Role / Job Description</span>
                    <span className="text-xs text-slate-500 font-normal">
                      (Optional)
                    </span>
                  </label>
                </div>
                <textarea
                  rows={3}
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder="Paste target role requirements, e.g., Senior Backend Engineer, FastAPI, Redis, Microservices, WebSockets, PostgreSQL..."
                  className="w-full bg-slate-50/60 border border-slate-300 rounded-2xl p-4 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition font-mono"
                />
              </div>

              {/* Step 3: Interview Mode Selection */}
              <div>
                <label className="text-sm font-semibold flex items-center gap-2 text-slate-900 mb-3">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>3. Select Viva Track & Difficulty</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: "Project Viva & Architecture",
                      title: "Project Viva",
                      badge: "High Grilling",
                      desc: "Deep interrogation on resume projects, architectural trade-offs, caching & failover",
                    },
                    {
                      id: "DSA & Core CS",
                      title: "DSA & Core CS",
                      badge: "Fundamentals",
                      desc: "Time/space complexities, indexing models, OS locks, ACID transactions",
                    },
                    {
                      id: "HR & Tech Leadership",
                      title: "HR & Leadership",
                      badge: "Executive Prep",
                      desc: "STAR-method evaluation, production outage handling, and conflict resolution",
                    },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMode(m.id)}
                      className={`text-left p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                        mode === m.id
                          ? "bg-blue-50/80 border-blue-600 text-slate-900 shadow-sm ring-1 ring-blue-600/30"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-sm font-bold font-heading text-slate-900">
                            {m.title}
                          </p>
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            {m.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {m.desc}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-end">
                        {mode === m.id && (
                          <span className="flex h-2.5 w-2.5 rounded-full bg-blue-600" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Difficulty Tier Selector */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-slate-500">
                    Target Level:
                  </span>
                  {["Junior (L3)", "Mid-Level (L4)", "Senior (L5)"].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setDifficulty(lvl)}
                      className={`px-3 py-1 rounded-xl text-xs font-mono font-semibold transition ${
                        difficulty === lvl
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Launch Action Button */}
              <button
                type="button"
                disabled={!resumeText || loading}
                onClick={startInterview}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition shadow-lg shadow-blue-600/25 text-sm sm:text-base flex items-center justify-center gap-2 transform active:scale-[0.99]"
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
        {/* 3. POST-INTERVIEW SCORECARD DOSSIER */}
        {/* ==================================================== */}
        {scorecard && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
            {/* Header Executive Card */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_10px_30px_-5px_rgba(15,23,42,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="px-3 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    Viva Evaluated
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    • Track: {mode}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-slate-900 tracking-tight">
                  Technical Viva Dossier
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Benchmarked against top-tier tech engineering hiring standards.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
                <button
                  onClick={copyScorecardToClipboard}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-xl transition text-xs font-mono flex items-center gap-1.5"
                >
                  {copiedSummary ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-600" />
                  )}
                  <span>{copiedSummary ? "Copied!" : "Copy Report"}</span>
                </button>

                <button
                  onClick={() => {
                    setScorecard(null);
                    setTranscript([]);
                    setSessionInfo(null);
                  }}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold px-5 py-2.5 rounded-xl transition text-xs sm:text-sm flex items-center gap-2 shadow-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Practice Another</span>
                </button>
              </div>
            </div>

            {/* Scorecard Circular Gauges Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <CircularGauge
                score={scorecard.technical_depth_score}
                max={100}
                label="Technical Depth"
                color="blue"
                subtitle="Architecture & Trade-offs"
              />
              <CircularGauge
                score={scorecard.communication_clarity_score}
                max={100}
                label="Spoken Clarity"
                color="emerald"
                subtitle="Articulation & Structure"
              />
              <CircularGauge
                score={scorecard.confidence_score}
                max={100}
                label="Executive Confidence"
                color="slate"
                subtitle="Tone & Ownership"
              />
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 flex flex-col items-center justify-between shadow-[0_1px_3px_rgba(15,23,42,0.04),0_6px_20px_-4px_rgba(15,23,42,0.06)]">
                <div className="w-full flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                    Filler Words
                  </span>
                  <span
                    className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                      scorecard.filler_words_count <= 4
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {scorecard.filler_words_count <= 4 ? "Minimal" : "Pacing Tip"}
                  </span>
                </div>
                <div className="relative w-24 h-24 flex flex-col items-center justify-center my-1.5 bg-slate-50 rounded-full border border-slate-200">
                  <span className="text-3xl font-mono font-black text-amber-600">
                    {scorecard.filler_words_count}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    occurrences
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono text-center mt-1">
                  &ldquo;um, like, basically&rdquo;
                </p>
              </div>
            </div>

            {/* Executive Summary Card */}
            {scorecard.overall_summary && (
              <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_6px_20px_-4px_rgba(15,23,42,0.06)]">
                <h3 className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>Executive Feedback Summary</span>
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed font-normal">
                  {scorecard.overall_summary}
                </p>
              </div>
            )}

            {/* Interactive Tab Switcher */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                onClick={() => setActiveTab("english")}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2 ${
                  activeTab === "english"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Spoken English Refactoring</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-blue-500/30">
                  {scorecard.english_refactoring?.length || 0}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("feedback")}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2 ${
                  activeTab === "feedback"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Question-by-Question Viva Breakdown</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-blue-500/30">
                  {scorecard.question_feedback?.length || 0}
                </span>
              </button>
            </div>

            {/* Tab 1: Spoken English Refactoring */}
            {activeTab === "english" && (
              <div className="space-y-4">
                {scorecard.english_refactoring?.map((item, i) => (
                  <div
                    key={i}
                    className="p-5 sm:p-6 bg-white rounded-3xl border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_6px_20px_-4px_rgba(15,23,42,0.06)] space-y-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* What you said */}
                      <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80 space-y-1">
                        <div className="flex items-center gap-1.5 text-rose-800 text-xs font-mono font-bold uppercase tracking-wider mb-1">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>What you said (Casual / Hesitant):</span>
                        </div>
                        <p className="text-xs sm:text-sm text-rose-950 font-mono italic leading-relaxed">
                          &ldquo;{item.original_spoken}&rdquo;
                        </p>
                      </div>

                      {/* Executive version */}
                      <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-1">
                        <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-mono font-bold uppercase tracking-wider mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Executive Tech Phrasing (L5 Standard):</span>
                        </div>
                        <p className="text-xs sm:text-sm text-emerald-950 font-mono font-medium leading-relaxed">
                          &ldquo;{item.professional_version}&rdquo;
                        </p>
                      </div>
                    </div>

                    {item.why_it_works && (
                      <div className="pt-2 border-t border-slate-100 flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-700 leading-relaxed">
                          <span className="font-semibold text-slate-900">
                            Linguistic impact:{" "}
                          </span>
                          {item.why_it_works}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Tab 2: Question-by-Question Technical Feedback */}
            {activeTab === "feedback" && (
              <div className="space-y-3">
                {scorecard.question_feedback?.map((q, idx) => {
                  const isOpen = expandedQuestion === idx;
                  return (
                    <div
                      key={idx}
                      className="border border-slate-200/90 rounded-2xl bg-white shadow-sm overflow-hidden transition"
                    >
                      <button
                        onClick={() => setExpandedQuestion(isOpen ? null : idx)}
                        className="w-full p-4 text-left flex items-center justify-between gap-3 hover:bg-slate-50 transition"
                      >
                        <div className="flex items-center gap-3">
                          <span className="h-7 w-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                            Q{idx + 1}
                          </span>
                          <p className="text-sm font-semibold text-slate-900">
                            {q.question}
                          </p>
                        </div>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                      </button>

                      {isOpen && (
                        <div className="p-5 pt-0 space-y-3 border-t border-slate-100 text-xs sm:text-sm">
                          <div>
                            <p className="text-[11px] font-mono font-bold uppercase text-slate-500 tracking-wider mb-1">
                              Your Answer Summary:
                            </p>
                            <p className="text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200">
                              {q.user_answer_summary ||
                                "Candidate provided minimal response."}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] font-mono font-bold uppercase text-emerald-800 tracking-wider mb-1">
                              What Went Well:
                            </p>
                            <p className="text-emerald-950 bg-emerald-50/80 p-3 rounded-xl border border-emerald-200">
                              {q.what_went_well}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] font-mono font-bold uppercase text-blue-800 tracking-wider mb-1">
                              Ideal Answer for Top Tier MNCs:
                            </p>
                            <p className="text-blue-950 bg-blue-50/80 p-3.5 rounded-xl border border-blue-200 leading-relaxed font-mono text-xs">
                              {q.ideal_improved_answer}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm animate-in fade-in duration-200"
          />

          <div className="relative w-full max-w-md bg-white border-l border-slate-200 h-full p-6 shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-right duration-300">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                    <History className="w-4 h-4 text-blue-600" />
                  </div>
                  <h3 className="text-base font-heading font-bold text-slate-900">
                    Past Interview Sessions
                  </h3>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-180px)] pr-1">
                {pastSessions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-50 text-slate-300" />
                    <p className="text-xs font-mono">No past interviews recorded yet.</p>
                  </div>
                ) : (
                  pastSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => handleSelectPastSession(session)}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-blue-400 cursor-pointer transition space-y-2 group hover:bg-blue-50/30"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-heading text-blue-700">
                          {session.mode}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-500">
                            {session.createdAt
                              ? new Date(session.createdAt).toLocaleDateString()
                              : "Recent"}
                          </span>
                          <button
                            onClick={(e) => handleDeleteSession(e, session.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-center">
                        <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                          <p className="text-[9px] font-mono text-slate-500">Tech</p>
                          <p className="text-xs font-mono font-bold text-blue-600">
                            {session.scorecard?.technical_depth_score || 0}
                          </p>
                        </div>
                        <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                          <p className="text-[9px] font-mono text-slate-500">Clarity</p>
                          <p className="text-xs font-mono font-bold text-emerald-600">
                            {session.scorecard?.communication_clarity_score || 0}
                          </p>
                        </div>
                        <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                          <p className="text-[9px] font-mono text-slate-500">Confidence</p>
                          <p className="text-xs font-mono font-bold text-slate-800">
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
              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={handleClearAll}
                  className="w-full bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 py-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2"
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
      <footer className="border-t border-slate-200/80 bg-white py-4 px-4 text-center text-xs text-slate-500 font-mono">
        PrepVoice AI — Client-Side PDF.js &amp; IndexedDB Zero-Cost Architecture with Gemini 2.5 Flash &amp; LiveKit WebRTC
      </footer>
    </main>
  );
}
