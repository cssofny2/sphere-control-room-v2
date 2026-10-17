// Vercel Function: receives mail for Dr. Wire from your inbound-mail provider. See src/technician/mailServer.ts for setup.
import { createInboundHandler } from '../src/technician/mailServer';

const handler = createInboundHandler({ env: process.env as Record<string, string | undefined> });
export async function POST(req: Request) { return handler(req); }
export async function GET() { return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { 'content-type': 'application/json', allow: 'POST' } }); }
