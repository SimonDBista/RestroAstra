import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Admin logged out' });
  response.cookies.delete(ADMIN_COOKIE_NAME);
  response.cookies.delete('admin_token');
  return response;
}

