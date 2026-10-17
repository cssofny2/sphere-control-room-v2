// Vercel Function: web look-ups for Dr. Wire. Logic and environment variables are documented in src/technician/lookupServer.ts.
import Anthropic from '@anthropic-ai/sdk';
import { createLookupHandler } from '../src/technician/lookupServer';

const handler = createLookupHandler({
  env: process.env as Record<string, string | undefined>,
  client: () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) as any,
});
export async function POST(req: Request) { return handler(req); }
export async function GET() { return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { 'content-type': 'application/json', allow: 'POST' } }); }
