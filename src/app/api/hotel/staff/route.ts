import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getHotelAuth } from '@/lib/auth';
import { getNepalDateString } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const DEFAULT_INITIAL_STAFF = [
  { name: 'Bikram Thapa', role: 'Head Chef / Sekuwa Master', department: 'Kitchen', systemRole: 'CHEF', pinCode: '1111', shift: 'Morning', phone: '9801234567', salary: 45000, salaryType: 'monthly', status: 'active', notes: 'Master in charcoal grilled chicken & mutton' },
  { name: 'Suman Shrestha', role: 'Sous Chef & Curry Specialist', department: 'Kitchen', systemRole: 'CHEF', pinCode: '1112', shift: 'Morning', phone: '9812345678', salary: 32000, salaryType: 'monthly', status: 'active', notes: 'Manages tandoor and gravies' },
  { name: 'Aayush Maharjan', role: 'Senior Waiter & Captain', department: 'Service', systemRole: 'WAITER', pinCode: '2222', shift: 'Full Day', phone: '9823456789', salary: 22000, salaryType: 'monthly', status: 'active', notes: 'Table management and customer dining care' },
  { name: 'Pooja Gurung', role: 'Floor Hostess & Waitress', department: 'Service', systemRole: 'WAITER', pinCode: '2223', shift: 'Evening', phone: '9845678901', salary: 20000, salaryType: 'monthly', status: 'active', notes: 'Evening floor reception and dining hospitality' },
  { name: 'Rabin Tamang', role: 'Mixologist & Bartender', department: 'Bar', systemRole: 'WAITER', pinCode: '3333', shift: 'Evening', phone: '9856789012', salary: 26000, salaryType: 'monthly', status: 'active', notes: 'Cocktails, beverages and bar stock' },
  { name: 'Sunita Rai', role: 'Cashier & Front Desk', department: 'Management', systemRole: 'CASHIER', pinCode: '4444', shift: 'Full Day', phone: '9867890123', salary: 25000, salaryType: 'monthly', status: 'active', notes: 'Billing, registers, and phone reservations' },
  { name: 'Kiran KC', role: 'Kitchen Steward & Cleaner', department: 'Operations', systemRole: 'WAITER', pinCode: '5555', shift: 'Full Day', phone: '9811223344', salary: 16000, salaryType: 'monthly', status: 'active', notes: 'Dishwashing, kitchen hygiene, and deep cleaning' },
];

export async function GET(request: NextRequest) {
  try {
    const auth = getHotelAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim().toLowerCase();
    const department = searchParams.get('department')?.trim();
    const status = searchParams.get('status')?.trim();
    const includeAttendance = searchParams.get('includeAttendance') !== 'false';
    const date = searchParams.get('date') || getNepalDateString();

    const whereClause: any = { hotelId: auth.hotelId };
    if (department && department !== 'All') {
      whereClause.department = department;
    }
    if (status && status !== 'All') {
      whereClause.status = status;
    }

    const staffMembers = await prisma.staffMember.findMany({
      where: whereClause,
      include: includeAttendance
        ? {
            attendances: {
              where: { date },
              take: 1,
            },
          }
        : undefined,
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
    });

    let filtered = staffMembers;
    if (search) {
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(search) ||
          s.role.toLowerCase().includes(search) ||
          (s.phone && s.phone.includes(search)) ||
          s.department.toLowerCase().includes(search)
      );
    }

    // Attach todayAttendance helper property and sanitize pinCode
    const formattedStaff = filtered.map((s: any) => {
      const { pinCode, ...safeStaff } = s;
      return {
        ...safeStaff,
        hasPin: Boolean(pinCode),
        todayAttendance: s.attendances && s.attendances.length > 0 ? s.attendances[0] : null,
      };
    });

    return NextResponse.json({
      staff: formattedStaff,
      total: formattedStaff.length,
      date,
    });
  } catch (error) {
    console.error('Fetch staff members error:', error);
    return NextResponse.json({ error: 'Failed to fetch staff members' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getHotelAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Check if seeding demo staff
    if (body.action === 'seed_demo') {
      const existingCount = await prisma.staffMember.count({ where: { hotelId: auth.hotelId } });
      if (existingCount > 0) {
        return NextResponse.json({ message: 'Staff already exists', count: existingCount });
      }

      for (const item of DEFAULT_INITIAL_STAFF) {
        await prisma.staffMember.create({
          data: {
            hotelId: auth.hotelId,
            ...item,
          },
        });
      }

      const all = await prisma.staffMember.findMany({
        where: { hotelId: auth.hotelId },
        orderBy: [{ department: 'asc' }, { name: 'asc' }],
      });

      return NextResponse.json({ success: true, count: all.length, staff: all });
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

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Staff member name is required' }, { status: 400 });
    }
    if (!role || !role.trim()) {
      return NextResponse.json({ error: 'Role/Designation is required' }, { status: 400 });
    }

    // Determine default system role if not provided
    let finalSystemRole = systemRole;
    if (!finalSystemRole) {
      const deptLower = (department || '').toLowerCase();
      if (deptLower === 'kitchen') finalSystemRole = 'CHEF';
      else if (deptLower === 'management') finalSystemRole = 'MANAGER';
      else finalSystemRole = 'WAITER';
    }

    const newStaff = await prisma.staffMember.create({
      data: {
        hotelId: auth.hotelId,
        name: name.trim(),
        role: role.trim(),
        department: department || 'Service',
        systemRole: finalSystemRole,
        pinCode: pinCode && pinCode.trim() ? pinCode.trim() : null,
        phone: phone ? phone.trim() : null,
        email: email ? email.trim() : null,
        shift: shift || 'Full Day',
        salary: salary ? parseFloat(salary) : null,
        salaryType: salaryType || 'monthly',
        status: status || 'active',
        emergencyContact: emergencyContact ? emergencyContact.trim() : null,
        notes: notes ? notes.trim() : null,
      },
    });

    return NextResponse.json({ success: true, staff: newStaff }, { status: 201 });
  } catch (error) {
    console.error('Create staff member error:', error);
    return NextResponse.json({ error: 'Failed to create staff member' }, { status: 500 });
  }
}
