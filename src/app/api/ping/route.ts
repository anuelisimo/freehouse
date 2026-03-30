import { NextResponse } from 'next/server'

// Endpoint liviano para mantener las funciones "calientes"
// Vercel lo llama via cron job cada 5 minutos
export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() })
}
