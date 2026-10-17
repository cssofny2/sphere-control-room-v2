// Vercel Function: the lab page's mailbox (poll, draft, send). See src/technician/mailServer.ts for setup.
import Anthropic from '@anthropic-ai/sdk';
import { createMailHandler } from '../src/technician/mailServer';

const handler = createMailHandler({
  env: process.env as Record<string, string | undefined>,
  client: () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) as any,
});
export async function POST(req: Request) { return handler(req); }
export async function GET() { return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { 'content-type': 'application/json', allow: 'POST' } }); }
