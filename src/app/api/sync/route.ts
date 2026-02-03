import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import path from "path";

const DB_PATH = path.join(process.cwd(), "src/app/api/db.json");

async function getDb() {
    try {
        const data = await fs.readFile(DB_PATH, "utf8");
        return JSON.parse(data);
    } catch (e) {
        const initial = { activeSession: null, records: [] };
        await fs.writeFile(DB_PATH, JSON.stringify(initial), "utf8");
        return initial;
    }
}

async function saveDb(data: any) {
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf8");
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
            db.records = [payload, ...db.records];
            break;
        case "DELETE_RECORD":
            db.records = db.records.filter((r: any) => r.id !== payload);
            break;
        case "CLEAR_RECORDS":
            db.records = [];
            break;
        case "CLEAR_SESSION":
            db.activeSession = null;
            break;
    }

    await saveDb(db);
    return NextResponse.json(db);
}
