// Vercel Function: Dr. Wire's natural voice (neural text-to-speech). Inactive until ELEVENLABS_API_KEY or OPENAI_API_KEY is set.
// All logic and the environment variables are documented in src/technician/ttsServer.ts.
import { createTtsHandler } from '../src/technician/ttsServer';

const handler = createTtsHandler({ env: process.env as Record<string, string | undefined> });
export async function POST(req: Request) { return handler(req); }
export async function GET(req: Request) { return handler(req); }
