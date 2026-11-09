import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getHotelAuth, comparePassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = getHotelAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { staffId, pinCode, isOwner } = body;

    // 1. Switch back to Owner / General Manager Mode
    if (isOwner) {
      const hotel = await prisma.hotel.findUnique({
        where: { id: auth.hotelId },
      });

      if (!hotel) {
        return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
      }

      // Owner must enter their actual hotel account login password
      if (!pinCode || !pinCode.trim()) {
        return NextResponse.json({ error: 'Restaurant account password is required' }, { status: 400 });
      }

      const isValidOwner = await comparePassword(pinCode, hotel.passwordHash);

      if (!isValidOwner) {
        return NextResponse.json({ error: 'Incorrect account password. Please try again.' }, { status: 401 });
      }

      return NextResponse.json({
        success: true,
        activeStaff: {
          id: 'owner',
          name: hotel.name + ' (Owner)',
          role: 'OWNER',
          department: 'Management',
          isOwner: true,
        },
      });
    }

    // 2. Switch to a Staff Member Profile
    if (!staffId) {
      return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 });
    }

    const staff = await prisma.staffMember.findFirst({
      where: {
        id: staffId,
        hotelId: auth.hotelId,
      },
    });

    if (!staff) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    // If staff has a PIN set, verify it
    if (staff.pinCode && staff.pinCode.trim()) {
      if (!pinCode || pinCode.trim() !== staff.pinCode.trim()) {
        return NextResponse.json({ error: 'Invalid PIN entered. Please try again.' }, { status: 401 });
      }
    }

    return NextResponse.json({
      success: true,
      activeStaff: {
        id: staff.id,
        name: staff.name,
        role: staff.systemRole || 'WAITER',
        department: staff.department,
        isOwner: false,
      },
    });
  } catch (error) {
    console.error('Verify PIN error:', error);
    return NextResponse.json({ error: 'Internal verification error' }, { status: 500 });
  }
}

