import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import prisma from '@/lib/prisma';
import { getHotelAuth } from '@/lib/auth';
import { getAppBaseUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = getHotelAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const hotel = await prisma.hotel.findUnique({
      where: { id: auth.hotelId },
      select: { name: true, slug: true, status: true },
    });

    if (!hotel) {
      return NextResponse.json({ error: 'Hotel not found' }, { status: 404 });
    }

    const baseUrl = getAppBaseUrl(request);
    const targetUrl = `${baseUrl}/menu/${hotel.slug}?qr=1`;

    const qrDataUrl = await QRCode.toDataURL(targetUrl, {
      width: 600,
      margin: 2,
      color: {
        dark: '#0a0b0e',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });

    return NextResponse.json({
      targetUrl,
      qrDataUrl,
      hotelName: hotel.name,
      slug: hotel.slug,
    });
  } catch (error) {
    console.error('QR generation error:', error);
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 });
  }
}
