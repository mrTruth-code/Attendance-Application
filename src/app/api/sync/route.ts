import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

interface AttendanceRecord {
    id: string;
    studentName: string;
    studentId: string;
    timestamp: string;
    day: string;
    sessionId: string;
    sessionName: string;
}

interface SessionInfo {
    id: string;
    name: string;
}

interface Database {
    activeSession: SessionInfo | null;
    records: AttendanceRecord[];
}

// Fallback for local development without KV configured
const useFallback = !process.env.KV_REST_API_URL;
const DB_PATH = path.join(process.cwd(), "db.json");

/**
 * Helper to wrap a promise with a timeout.
 * Prevents the API from hanging on slow Vercel KV connections.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number = 5000): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("KV_TIMEOUT")), ms)
    );
    return Promise.race([promise, timeout]);
}

// Initial empty state
const defaultDb: Database = {
    activeSession: null,
    records: [],
};

async function getDb(): Promise<Database> {
    if (useFallback) {
        try {
            const data = await fs.readFile(DB_PATH, "utf-8");
            return JSON.parse(data);
        } catch (error: any) {
            // If file doesn't exist, return default
            if (error.code === 'ENOENT') {
                return defaultDb;
            }
            // Real error (permissions/disk/lock) - throw so we don't overwrite!
            console.error("[DB] Read Error:", error);
            throw error;
        }
    }

    try {
        // Use timeout to prevent hanging on KV
        const [activeSession, records] = await withTimeout(Promise.all([
            kv.get<SessionInfo | null>("activeSession"),
            kv.get<AttendanceRecord[]>("records"),
        ]));

        return {
            activeSession: activeSession || null,
            records: records || [],
        };
    } catch (error: any) {
        console.error("KV Error or Timeout:", error);

        // CRITICAL FALLBACK: Try to read from local file
        try {
            const data = await fs.readFile(DB_PATH, "utf-8");
            return JSON.parse(data);
        } catch (e: any) {
            // If the local file ALSO doesn't exist, ONLY then return empty
            if (e.code === 'ENOENT') {
                return defaultDb;
            }
            // If there's a real read error, THROW. Don't return empty or you'll overwrite KV with nothing!
            throw new Error("RELIABILITY_FAILURE: Could not load data from any source.");
        }
    }
}

async function saveDb(data: Database): Promise<void> {
    if (useFallback) {
        const tempPath = `${DB_PATH}.tmp`;
        try {
            await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
            await fs.rename(tempPath, DB_PATH);
        } catch (e) {
            console.error("[DB] Save Error:", e);
            throw e;
        }
        return;
    }

    try {
        await withTimeout(Promise.all([
            kv.set("activeSession", data.activeSession),
            kv.set("records", data.records),
        ]));
    } catch (error: any) {
        console.error("KV Save Error or Timeout:", error);
        // Fallback to local file with atomic safety
        const tempPath = `${DB_PATH}.tmp`;
        await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
        await fs.rename(tempPath, DB_PATH);
    }
}

export async function GET() {
    const db = await getDb();
    return NextResponse.json(db);
}

export async function POST(req: Request) {
    const { action, payload } = await req.json();
    const db = await getDb();

    switch (action) {
        case "SET_SESSION":
            db.activeSession = payload;
            break;
        case "ADD_RECORD":
            // Prevent duplicates server-side as well
            const exists = db.records.some(r => r.studentId === payload.studentId && r.sessionId === payload.sessionId);
            if (!exists) {
                db.records = [payload, ...db.records];
            }
            break;
        case "DELETE_RECORD":
            db.records = db.records.filter((r: AttendanceRecord) => r.id !== payload);
            break;
        case "CLEAR_RECORDS":
            // Protection: User requested data NOT to be erased. 
            // We disable this global clear action to prevent accidents.
            console.warn("Attempt to clear records blocked for safety.");
            break;
        case "CLEAR_SESSION":
            db.activeSession = null;
            break;
    }

    await saveDb(db);
    return NextResponse.json(db);
}
