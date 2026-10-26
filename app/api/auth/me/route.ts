import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { emailConfigured } from '@/lib/email/send';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json(
    { user: user ? { name: user.fullName, email: user.email, role: user.role } : null, magicLink: emailConfigured() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
