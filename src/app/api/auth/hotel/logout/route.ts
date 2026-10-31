import { NextResponse } from 'next/server';
import { HOTEL_COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  response.cookies.delete(HOTEL_COOKIE_NAME);
  response.cookies.delete('hotel_token');
  return response;
}

