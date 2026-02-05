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
        const [activeSession, records] = await Promise.all([
            kv.get<SessionInfo | null>("activeSession"),
            kv.get<AttendanceRecord[]>("records"),
        ]);

        return {
            activeSession: activeSession || null,
            records: records || [],
        };
    } catch (error) {
        console.error("KV Error:", error);
        // Fallback to local file if KV fails
        try {
            const data = await fs.readFile(DB_PATH, "utf-8");
            return JSON.parse(data);
        } catch (e) {
            return defaultDb;
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
        await Promise.all([
            kv.set("activeSession", data.activeSession),
            kv.set("records", data.records),
        ]);
    } catch (error) {
        console.error("KV Save Error:", error);
        // Fallback to local file with same atomic safety
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
