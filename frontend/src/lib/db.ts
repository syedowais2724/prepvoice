import { openDB, IDBPDatabase } from "idb";

const DB_NAME = "prepvoice_db";
const STORE_NAME = "sessions";
const DB_VERSION = 1;

export interface SessionData {
  id?: number;
  mode: string;
  interview_plan: {
    candidate_name: string;
    opening_greeting: string;
    key_projects_detected: string[];
    questions: string[];
  };
  transcript: Array<{ speaker: string; text: string; timestamp?: string }>;
  scorecard: {
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
  };
  resume_snippet?: string;
  job_description?: string;
  createdAt?: string;
}

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("createdAt", "createdAt");
      }
    },
  });
}

export async function saveInterviewSession(sessionData: Omit<SessionData, "id">): Promise<number> {
  const db = await getDB();
  const sessionWithDate = {
    ...sessionData,
    createdAt: sessionData.createdAt || new Date().toISOString(),
  };
  const id = await db.add(STORE_NAME, sessionWithDate);
  return id as number;
}

export async function getPastSessions(): Promise<SessionData[]> {
  try {
    const db = await getDB();
    const sessions = await db.getAll(STORE_NAME);
    // Return newest sessions first
    return sessions.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  } catch (err) {
    console.error("Failed to read past sessions from IndexedDB:", err);
    return [];
  }
}

export async function getSessionById(id: number): Promise<SessionData | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, id);
}

export async function deleteSession(id: number): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

export async function clearAllSessions(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
}
