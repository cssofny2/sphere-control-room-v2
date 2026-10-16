// Vercel Function: streams Dr. Wire's replies from the Anthropic API as server-sent events.
// All logic lives in src/technician/server.ts. See the comments there for the environment variables:
//   ANTHROPIC_API_KEY (required), TECHNICIAN_MODEL, TECHNICIAN_DAILY_CAP_USD, TECHNICIAN_ALLOWED_ORIGINS, TECHNICIAN_RATE_PER_MIN
import Anthropic from '@anthropic-ai/sdk';
import { createHandler } from '../src/technician/server';

const handler = createHandler({
  env: process.env as Record<string, string | undefined>,
  client: () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) as any,
});
export async function POST(req: Request) { return handler(req); }
export async function GET() { return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { 'content-type': 'application/json', allow: 'POST' } }); }
