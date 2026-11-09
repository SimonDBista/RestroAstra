import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getHotelAuth } from '@/lib/auth';
import { getNepalDateString } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = getHotelAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const todayStr = getNepalDateString();
    const currentMonth = todayStr.substring(0, 7); // "YYYY-MM"
    const month = searchParams.get('month') || currentMonth;

    // 1. Fetch all active or on-leave staff
    const staffMembers = await prisma.staffMember.findMany({
      where: {
        hotelId: auth.hotelId,
        status: { in: ['active', 'on_leave'] },
      },
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
    });

    // 2. Fetch all attendance records starting with month prefix "YYYY-MM"
    const records = await prisma.staffAttendance.findMany({
      where: {
        hotelId: auth.hotelId,
        date: {
          startsWith: month,
        },
      },
      orderBy: { date: 'asc' },
    });

    // Group records by staffId
    const staffRecordsMap = new Map<string, any[]>();
    records.forEach((rec) => {
      const list = staffRecordsMap.get(rec.staffId) || [];
      list.push(rec);
      staffRecordsMap.set(rec.staffId, list);
    });

    // Compute metrics per staff
    const staffSummaries = staffMembers.map((staff) => {
      const staffRecords = staffRecordsMap.get(staff.id) || [];
      let present = 0;
      let late = 0;
      let halfDay = 0;
      let absent = 0;
      let onLeave = 0;
      let totalHours = 0;

      const dailyMap: Record<string, { status: string; checkInTime?: string; checkOutTime?: string; hoursWorked?: number }> = {};

      staffRecords.forEach((rec) => {
        dailyMap[rec.date] = {
          status: rec.status,
          checkInTime: rec.checkInTime || undefined,
          checkOutTime: rec.checkOutTime || undefined,
          hoursWorked: rec.hoursWorked || undefined,
        };

        if (rec.hoursWorked) {
          totalHours += rec.hoursWorked;
        }

        switch (rec.status) {
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
        }
      });

      const totalMarkedDays = present + late + halfDay + absent + onLeave;
      const effectivePresent = present + late + halfDay * 0.5;
      const rate = totalMarkedDays > 0 ? Math.round((effectivePresent / totalMarkedDays) * 100) : 0;

      return {
        staff,
        present,
        late,
        halfDay,
        absent,
        onLeave,
        totalMarkedDays,
        totalHours: Math.round(totalHours * 10) / 10,
        attendanceRate: rate,
        dailyMap,
      };
    });

    // Overall month statistics
    const totalRecords = records.length;
    let totalPresent = 0;
    let totalLate = 0;
    let totalHalfDay = 0;
    let totalAbsent = 0;
    let totalLeave = 0;
    let totalWorkedHoursOverall = 0;

    records.forEach((r) => {
      if (r.hoursWorked) totalWorkedHoursOverall += r.hoursWorked;
      if (r.status === 'present') totalPresent++;
      else if (r.status === 'late') totalLate++;
      else if (r.status === 'half_day') totalHalfDay++;
      else if (r.status === 'absent') totalAbsent++;
      else if (r.status === 'on_leave') totalLeave++;
    });

    const overallRate =
      totalRecords > 0
        ? Math.round(((totalPresent + totalLate + totalHalfDay * 0.5) / totalRecords) * 100)
        : 0;

    return NextResponse.json({
      month,
      staffSummaries,
      monthStats: {
        totalStaff: staffMembers.length,
        totalRecords,
        totalPresent,
        totalLate,
        totalHalfDay,
        totalAbsent,
        totalLeave,
        totalWorkedHours: Math.round(totalWorkedHoursOverall * 10) / 10,
        overallRate,
      },
    });
  } catch (error) {
    console.error('Fetch attendance summary error:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance summary' }, { status: 500 });
  }
}
