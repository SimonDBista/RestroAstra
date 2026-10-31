import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { comparePassword, signHotelToken, HOTEL_COOKIE_NAME } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const hotel = await prisma.hotel.findUnique({
      where: { ownerEmail: email.toLowerCase().trim() },
    });

    if (!hotel) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const isMatch = await comparePassword(password, hotel.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const token = signHotelToken({
      hotelId: hotel.id,
      name: hotel.name,
      slug: hotel.slug,
      email: hotel.ownerEmail,
      status: hotel.status,
    });

    const response = NextResponse.json({
      success: true,
      token,
      hotel: {
        id: hotel.id,
        name: hotel.name,
        slug: hotel.slug,
        ownerEmail: hotel.ownerEmail,
        phone: hotel.phone,
        address: hotel.address,
        coverImage: hotel.coverImage,
        status: hotel.status,
      },
    });

    const isHttps = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';

    // Set isolated HTTP-only cookie
    response.cookies.set({
      name: HOTEL_COOKIE_NAME,
      value: token,
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax',
      secure: isHttps,
    });

    return response;
  } catch (error) {
    console.error('Hotel login error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during login' },
      { status: 500 }
    );
  }
}
