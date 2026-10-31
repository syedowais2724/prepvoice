# PrepVoice AI — Real-Time Voice Mock Interview & Viva Coach

A production-grade, zero-database-cost web application for engineering students and graduates to practice real-time technical interviews, project vivas, and professional spoken English.

---

## Architecture Highlights
- **Zero-Cost Client-Side Storage**: Resume PDFs are parsed directly in the user's browser using `pdfjs-dist` (₹0 server RAM / compute).
- **Zero Backend Database**: All session history, transcripts, and evaluation scorecards are stored locally in the browser's IndexedDB (`idb`).
- **Pre-Interview Rubric Planner**: Uses Gemini 2.5 Flash structured outputs to generate 5 sharp technical questions based on the candidate's actual projects.
- **Real-Time Voice Agent**: LiveKit Agents worker with Silero VAD, Deepgram Nova-3 (Indian English `en-IN`), Gemini 2.5 Flash LLM, and Cartesia TTS.
- **Rescue Hint Engine**: Real-time tactical 1-sentence lifeline prompts if the candidate gets stuck.
- **Post-Interview Scorecard & English Refactoring**: Technical depth, spoken clarity, confidence, filler word analysis, and "What You Said vs. How to Say It in an Interview" refactoring.

---

## Directory Structure
```text
prepvoice/
├── backend/
│   ├── .env
│   ├── .env.example
│   ├── requirements.txt
│   ├── main.py            # FastAPI server (Rubric planner + Rescue hint + Evaluator)
│   └── agent.py           # LiveKit Voice Agent worker
└── frontend/
    ├── .env.local
    ├── .env.local.example
    ├── package.json
    └── src/
        ├── lib/
        │   ├── pdf.ts     # Client-side PDF.js extractor
        │   └── db.ts      # IndexedDB storage wrapper
        └── app/
            ├── layout.tsx
            ├── globals.css
            └── page.tsx   # Setup, LiveKit Voice Room, & Scorecard UI
```

---

## Quick Start (Run Locally)

### 1. Configure Environment Variables

**`backend/.env`**:
```ini
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_key
LIVEKIT_API_SECRET=your_livekit_secret
GEMINI_API_KEY=your_google_ai_studio_key
DEEPGRAM_API_KEY=your_deepgram_api_key
CARTESIA_API_KEY=your_cartesia_api_key
```

**`frontend/.env.local`**:
```ini
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
```

### 2. Run the 3 Processes

**Terminal 1 — FastAPI Backend Server:**
```powershell
cd E:\prepvoice\backend
.\venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

**Terminal 2 — LiveKit Voice Agent Worker:**
```powershell
cd E:\prepvoice\backend
.\venv\Scripts\activate
python agent.py dev
```

**Terminal 3 — Next.js Frontend:**
```powershell
cd E:\prepvoice\frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
