import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hotelId = searchParams.get('hotelId');
    const hotelSlug = searchParams.get('hotelSlug');
    const tableNumber = searchParams.get('tableNumber')?.trim();

    if ((!hotelId && !hotelSlug) || !tableNumber) {
      return NextResponse.json(
        { error: 'hotelId or hotelSlug, and tableNumber are required' },
        { status: 400 }
      );
    }

    let targetHotelId = hotelId;
    if (!targetHotelId && hotelSlug) {
      const hotel = await prisma.hotel.findUnique({
        where: { slug: hotelSlug },
        select: { id: true },
      });
      if (!hotel) {
        return NextResponse.json({ error: 'Hotel not found' }, { status: 404 });
      }
      targetHotelId = hotel.id;
    }

    const cleanTable = tableNumber.replace(/^table\s*#?/i, '').replace(/^#+/, '').trim();
    const tableCandidates = Array.from(new Set([tableNumber, cleanTable, `Table ${cleanTable}`, `#${cleanTable}`].filter(Boolean)));

    // Fetch table settlement information
    const table = await prisma.restaurantTable.findFirst({
      where: {
        hotelId: targetHotelId!,
        tableNumber: { in: tableCandidates },
      },
      select: {
        id: true,
        lastSettledAt: true,
        sessionToken: true,
      },
    });

    let currentSessionToken = table?.sessionToken || null;
    if (table && !currentSessionToken) {
      currentSessionToken =
        'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      try {
        await prisma.restaurantTable.update({
          where: { id: table.id },
          data: { sessionToken: currentSessionToken },
        });
      } catch {}
    }

    // Look for active orders in the last 12 hours (and after last settlement if settled)
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const minCreatedAt =
      table?.lastSettledAt && new Date(table.lastSettledAt) > twelveHoursAgo
        ? new Date(new Date(table.lastSettledAt).getTime() - 2000)
        : twelveHoursAgo;

    const activeOrders = await prisma.order.findMany({
      where: {
        hotelId: targetHotelId!,
        tableNumber: { in: tableCandidates },
        status: { in: ['received', 'in_progress', 'done'] },
        createdAt: { gte: minCreatedAt },
      },
      include: {
        _count: {
          select: { chatMessages: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (activeOrders.length === 0) {
      return NextResponse.json({
        hasActiveOrder: false,
        activeOrders: [],
        count: 0,
        lastSettledAt: table?.lastSettledAt || null,
        sessionToken: currentSessionToken,
      });
    }

    const latestOrder = activeOrders[activeOrders.length - 1];

    return NextResponse.json({
      hasActiveOrder: true,
      count: activeOrders.length,
      latestOrderId: latestOrder.id,
      activeOrders,
      lastSettledAt: table?.lastSettledAt || null,
      sessionToken: currentSessionToken,
    });
  } catch (error) {
    console.error('Check active order error:', error);
    return NextResponse.json(
      { error: 'Failed to check active orders' },
      { status: 500 }
    );
  }
}
