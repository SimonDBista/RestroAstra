import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getHotelAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = getHotelAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hotel = await prisma.hotel.findUnique({
      where: { id: auth.hotelId },
      select: {
        id: true,
        name: true,
        slug: true,
        ownerEmail: true,
        phone: true,
        address: true,
        coverImage: true,
        status: true,
        createdAt: true,
      },
    });

    if (!hotel) {
      return NextResponse.json({ error: 'Hotel not found' }, { status: 404 });
    }

    return NextResponse.json({ hotel });
  } catch (error) {
    console.error('Hotel me error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
