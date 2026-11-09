import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getHotelAuth } from '@/lib/auth';
import { getNepalDateString, calculateHoursWorked } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function getNepalCurrentTime(): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kathmandu',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date());
}

export async function GET(request: NextRequest) {
  try {
    const auth = getHotelAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || getNepalDateString();
    const department = searchParams.get('department')?.trim();

    // 1. Fetch staff members
    const staffWhere: any = {
      hotelId: auth.hotelId,
      status: { in: ['active', 'on_leave'] },
    };
    if (department && department !== 'All') {
      staffWhere.department = department;
    }

    const staffMembers = await prisma.staffMember.findMany({
      where: staffWhere,
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
    });

    // 2. Fetch existing attendance records for the date
    const attendanceRecords = await prisma.staffAttendance.findMany({
      where: {
        hotelId: auth.hotelId,
        date,
      },
      include: {
        staff: true,
      },
    });

    const recordMap = new Map<string, any>();
    attendanceRecords.forEach((rec) => {
      recordMap.set(rec.staffId, rec);
    });

    // 3. Combine staff with their attendance record
    const staffWithAttendance = staffMembers.map((staff) => {
      const attendance = recordMap.get(staff.id) || null;
      return {
        staff,
        attendance,
        status: attendance ? attendance.status : 'unmarked',
      };
    });

    // 4. Calculate stats
    const totalStaff = staffMembers.length;
    let present = 0;
    let late = 0;
    let halfDay = 0;
    let absent = 0;
    let onLeave = 0;
    let unmarked = 0;

    staffWithAttendance.forEach((item) => {
      if (!item.attendance) {
        unmarked++;
      } else {
        switch (item.attendance.status) {
          case 'present':
            present++;
            break;
          case 'late':
            late++;
            break;
          case 'half_day':
            halfDay++;
            break;
          case 'absent':
            absent++;
            break;
          case 'on_leave':
            onLeave++;
            break;
          default:
            unmarked++;
        }
      }
    });

    const effectivePresent = present + late + halfDay * 0.5;
    const attendanceRate = totalStaff > 0 ? Math.round((effectivePresent / totalStaff) * 100) : 0;

    return NextResponse.json({
      date,
      staffAttendanceList: staffWithAttendance,
      stats: {
        totalStaff,
        present,
        late,
        halfDay,
        absent,
        onLeave,
        unmarked,
        attendanceRate,
      },
    });
  } catch (error) {
    console.error('Fetch attendance error:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance records' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getHotelAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;
    const date = body.date || getNepalDateString();

    // 1. Action: Batch mark all unmarked active staff as present
    if (action === 'batch_mark_present') {
      const activeStaff = await prisma.staffMember.findMany({
        where: { hotelId: auth.hotelId, status: 'active' },
      });

      const nowTime = date === getNepalDateString() ? getNepalCurrentTime() : '09:00 AM';

      for (const staff of activeStaff) {
        await prisma.staffAttendance.upsert({
          where: {
            hotelId_staffId_date: {
              hotelId: auth.hotelId,
              staffId: staff.id,
              date,
            },
          },
          update: {
            status: 'present',
            shift: staff.shift,
            checkInTime: nowTime,
          },
          create: {
            hotelId: auth.hotelId,
            staffId: staff.id,
            date,
            status: 'present',
            shift: staff.shift,
            checkInTime: nowTime,
            markedBy: 'Manager',
          },
        });
      }

      return NextResponse.json({ success: true, message: 'All staff marked present successfully' });
    }

    // 2. Action: Quick Clock-In
    if (action === 'clock_in') {
      const { staffId, time } = body;
      if (!staffId) {
        return NextResponse.json({ error: 'staffId is required' }, { status: 400 });
      }

      const clockInTime = time || getNepalCurrentTime();
      const staff = await prisma.staffMember.findFirst({
        where: { id: staffId, hotelId: auth.hotelId },
      });

      if (!staff) {
        return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
      }

      const record = await prisma.staffAttendance.upsert({
        where: {
          hotelId_staffId_date: {
            hotelId: auth.hotelId,
            staffId,
            date,
          },
        },
        update: {
          status: 'present',
          checkInTime: clockInTime,
          shift: staff.shift,
        },
        create: {
          hotelId: auth.hotelId,
          staffId,
          date,
          status: 'present',
          checkInTime: clockInTime,
          shift: staff.shift,
          markedBy: 'Staff Desk',
        },
      });

      return NextResponse.json({ success: true, record });
    }

    // 3. Action: Quick Clock-Out
    if (action === 'clock_out') {
      const { staffId, time } = body;
      if (!staffId) {
        return NextResponse.json({ error: 'staffId is required' }, { status: 400 });
      }

      const clockOutTime = time || getNepalCurrentTime();
      const existing = await prisma.staffAttendance.findUnique({
        where: {
          hotelId_staffId_date: {
            hotelId: auth.hotelId,
            staffId,
            date,
          },
        },
      });

      const hours = existing?.checkInTime
        ? calculateHoursWorked(existing.checkInTime, clockOutTime)
        : null;

      const record = await prisma.staffAttendance.upsert({
        where: {
          hotelId_staffId_date: {
            hotelId: auth.hotelId,
            staffId,
            date,
          },
        },
        update: {
          checkOutTime: clockOutTime,
          hoursWorked: hours,
        },
        create: {
          hotelId: auth.hotelId,
          staffId,
          date,
          status: 'present',
          checkOutTime: clockOutTime,
          hoursWorked: hours,
          markedBy: 'Staff Desk',
        },
      });

      return NextResponse.json({ success: true, record });
    }

    // 4. Action: Delete / Clear record
    if (action === 'delete_record') {
      const { staffId } = body;
      if (!staffId) {
        return NextResponse.json({ error: 'staffId is required' }, { status: 400 });
      }

      await prisma.staffAttendance.deleteMany({
        where: {
          hotelId: auth.hotelId,
          staffId,
          date,
        },
      });

      return NextResponse.json({ success: true, message: 'Attendance record cleared' });
    }

    // 5. Action: Standard single mark / status change
    const { staffId, status, checkInTime, checkOutTime, shift, notes } = body;
    if (!staffId) {
      return NextResponse.json({ error: 'staffId is required' }, { status: 400 });
    }

    const validStatuses = ['present', 'late', 'half_day', 'absent', 'on_leave'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid attendance status' }, { status: 400 });
    }

    // Fetch staff to get default shift if needed
    const staff = await prisma.staffMember.findFirst({
      where: { id: staffId, hotelId: auth.hotelId },
    });
    if (!staff) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    const hours = calculateHoursWorked(checkInTime, checkOutTime);

    const record = await prisma.staffAttendance.upsert({
      where: {
        hotelId_staffId_date: {
          hotelId: auth.hotelId,
          staffId,
          date,
        },
      },
      update: {
        status: status || 'present',
        checkInTime: checkInTime !== undefined ? checkInTime : undefined,
        checkOutTime: checkOutTime !== undefined ? checkOutTime : undefined,
        shift: shift || staff.shift,
        hoursWorked: hours,
        notes: notes !== undefined ? notes : undefined,
      },
      create: {
        hotelId: auth.hotelId,
        staffId,
        date,
        status: status || 'present',
        checkInTime: checkInTime || null,
        checkOutTime: checkOutTime || null,
        shift: shift || staff.shift,
        hoursWorked: hours,
        notes: notes || null,
        markedBy: 'Manager',
      },
    });

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error('Update attendance error:', error);
    return NextResponse.json({ error: 'Failed to record attendance' }, { status: 500 });
  }
}
