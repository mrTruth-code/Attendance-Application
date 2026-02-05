import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

// Initialize Redis
const redis = Redis.fromEnv();

export const POST = async () => {
    // Fetch data from Redis (using "records" as a sample key from existing usage)
    const result = await redis.get("records");

    // Return the result in the response
    return new NextResponse(JSON.stringify({ result }), { status: 200 });
};

export const GET = async () => {
    // Also add a GET for easy browser testing
    try {
        const result = await redis.get("records");
        return NextResponse.json({ result });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
};
