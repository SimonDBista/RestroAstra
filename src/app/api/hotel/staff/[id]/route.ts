import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getHotelAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = getHotelAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const staff = await prisma.staffMember.findFirst({
      where: { id, hotelId: auth.hotelId },
      include: {
        attendances: {
          orderBy: { date: 'desc' },
          take: 31,
        },
      },
    });

    if (!staff) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    return NextResponse.json({ staff });
  } catch (error) {
    console.error('Fetch staff member details error:', error);
    return NextResponse.json({ error: 'Failed to fetch staff details' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = getHotelAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();

    const existing = await prisma.staffMember.findFirst({
      where: { id, hotelId: auth.hotelId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    const {
      name,
      role,
      department,
      systemRole,
      pinCode,
      phone,
      email,
      shift,
      salary,
      salaryType,
      status,
      emergencyContact,
      notes,
    } = body;

    const updated = await prisma.staffMember.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        role: role !== undefined ? role.trim() : existing.role,
        department: department !== undefined ? department : existing.department,
        systemRole: systemRole !== undefined ? systemRole : existing.systemRole,
        pinCode: pinCode !== undefined ? (pinCode && pinCode.trim() ? pinCode.trim() : null) : existing.pinCode,
        phone: phone !== undefined ? (phone ? phone.trim() : null) : existing.phone,
        email: email !== undefined ? (email ? email.trim() : null) : existing.email,
        shift: shift !== undefined ? shift : existing.shift,
        salary: salary !== undefined ? (salary === '' || salary === null ? null : parseFloat(salary)) : existing.salary,
        salaryType: salaryType !== undefined ? salaryType : existing.salaryType,
        status: status !== undefined ? status : existing.status,
        emergencyContact: emergencyContact !== undefined ? (emergencyContact ? emergencyContact.trim() : null) : existing.emergencyContact,
        notes: notes !== undefined ? (notes ? notes.trim() : null) : existing.notes,
      },
    });

    return NextResponse.json({ success: true, staff: updated });
  } catch (error) {
    console.error('Update staff member error:', error);
    return NextResponse.json({ error: 'Failed to update staff member' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = getHotelAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const existing = await prisma.staffMember.findFirst({
      where: { id, hotelId: auth.hotelId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    await prisma.staffMember.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Staff member removed successfully' });
  } catch (error) {
    console.error('Delete staff member error:', error);
    return NextResponse.json({ error: 'Failed to delete staff member' }, { status: 500 });
  }
}
