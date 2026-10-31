import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = getAdminAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
    }

    const [
      totalHotels,
      activeHotels,
      pendingHotels,
      expiredHotels,
      totalOrders,
      completedOrders,
      totalMenuItems,
      totalFeedbacks,
    ] = await Promise.all([
      prisma.hotel.count(),
      prisma.hotel.count({ where: { status: 'active' } }),
      prisma.hotel.count({ where: { status: 'pending' } }),
      prisma.hotel.count({ where: { status: 'expired' } }),
      prisma.order.count(),
      prisma.order.findMany({ where: { status: 'done' }, select: { totalAmount: true } }),
      prisma.menuItem.count(),
      prisma.feedback.count(),
    ]);

    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    return NextResponse.json({
      stats: {
        totalHotels,
        activeHotels,
        pendingHotels,
        expiredHotels,
        totalOrders,
        totalRevenue: Math.round(totalRevenue),
        totalMenuItems,
        totalFeedbacks,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch admin stats' }, { status: 500 });
  }
}
