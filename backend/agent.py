import json
from datetime import datetime, timezone
from dotenv import load_dotenv
from livekit import agents, rtc
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli
from livekit.plugins import google, deepgram, cartesia, silero

load_dotenv()

class VivaInterviewer(Agent):
    def __init__(self, plan: dict) -> None:
        candidate_name = plan.get("candidate_name", "the candidate")
        questions = plan.get("questions", [])
        questions_str = "\n".join([f"{i+1}. {q}" for i, q in enumerate(questions)])
        projects_str = ", ".join(plan.get("key_projects_detected", []))

        super().__init__(
            instructions=f"""
            You are a sharp, encouraging Senior Engineering Interviewer conducting a live voice viva for {candidate_name}.
            Detected key projects from resume: {projects_str}

            STRICT VOICE RULES:
            - Speak in plain, natural sentences. NEVER use markdown, bullet points, asterisks, or formatting.
            - Keep every response strictly under 2 to 3 sentences maximum so the conversation feels like a real phone call.
            - Grill the candidate on these 5 specific questions from their resume and target role one by one:
            {questions_str}
            - If their answer is vague, generic, or buzzword-heavy, ask one sharp follow-up (e.g. "Why did you choose that database over alternatives?" or "How did you handle service failures?") before advancing to the next question.
            - Conclude positively and wish them luck when all questions have been covered.
            """
        )

async def entrypoint(ctx: JobContext):
    await ctx.connect()
    participant = await ctx.wait_for_participant()

    # Read the resume rubric passed via participant token metadata
    plan = {
        "candidate_name": "Candidate",
        "opening_greeting": "Hi! Let's start your technical viva. Walk me through the architecture of your primary project.",
        "key_projects_detected": ["Resume Projects"],
        "questions": [
            "What was the most challenging technical bottleneck you solved in your recent project?",
            "How did you design your database schema and handle data consistency?",
            "What architectural trade-offs did you make between performance and complexity?",
            "How did you test and handle failures in your production services?",
            "If your traffic increased 100x overnight, what would break first and how would you scale it?"
        ]
    }

    if participant.metadata:
        try:
            parsed = json.loads(participant.metadata)
            if isinstance(parsed, dict) and "questions" in parsed:
                plan = parsed
        except Exception as e:
            print(f"Warning: Failed to parse participant metadata JSON: {e}")

    session = AgentSession(
        vad=silero.VAD.load(),
        stt=deepgram.STT(model="nova-3", language="en-IN"),
        llm=google.LLM(model="gemini-2.5-flash"),
        tts=cartesia.TTS(),
    )

    # Stream committed speech turns to the Next.js frontend over LiveKit Data Channel
    @session.on("user_input_transcribed")
    def on_user_speech(ev):
        if getattr(ev, "is_final", True):
            now_str = datetime.now(timezone.utc).strftime("%H:%M:%S")
            payload = json.dumps({
                "speaker": "Candidate",
                "text": ev.transcript,
                "timestamp": now_str
            })
            ctx.room.local_participant.publish_data(payload.encode("utf-8"), reliable=True)

    @session.on("conversation_item_added")
    def on_agent_speech(ev):
        if ev.item.role == "assistant" and getattr(ev.item, "text_content", None):
            now_str = datetime.now(timezone.utc).strftime("%H:%M:%S")
            payload = json.dumps({
                "speaker": "Interviewer",
                "text": ev.item.text_content,
                "timestamp": now_str
            })
            ctx.room.local_participant.publish_data(payload.encode("utf-8"), reliable=True)

    await session.start(room=ctx.room, agent=VivaInterviewer(plan))
    greeting = plan.get("opening_greeting", "Hi! Welcome to your technical viva. Tell me about your primary project.")
    await session.generate_reply(instructions=f"Say this exact greeting naturally: {greeting}")

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
