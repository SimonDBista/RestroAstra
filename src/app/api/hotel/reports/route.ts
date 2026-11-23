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

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'today'; // 'today' | 'yesterday' | 'date' | 'custom' | '7days' | 'month' | 'all'
    const dateParam = searchParams.get('date'); // YYYY-MM-DD
    const startDateParam = searchParams.get('startDate'); // YYYY-MM-DD
    const endDateParam = searchParams.get('endDate'); // YYYY-MM-DD

    // Owner-Only RBAC Guard: Access to past dates, custom date ranges, and all-time records is restricted to Owner
    const staffRole = request.headers.get('x-staff-role') || searchParams.get('staffRole') || 'OWNER';
    const isOwnerVerified = request.headers.get('x-owner-verified') === 'true';

    const isHistoricalRequest =
      range === 'all' ||
      range === 'date' ||
      range === 'custom' ||
      range === '7days' ||
      range === 'month';

    if (isHistoricalRequest && staffRole !== 'OWNER' && !isOwnerVerified) {
      return NextResponse.json(
        { error: 'Access to historical sales records and custom date selection is restricted to the Restaurant Owner.' },
        { status: 403 }
      );
    }

    // Determine start and end date filter in Nepal Time (Asia/Kathmandu UTC+5:45)
    const now = new Date();
    const nepalTodayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu' }).format(now);
    const startOfToday = new Date(`${nepalTodayStr}T00:00:00+05:45`);

    let startDate: Date | null = null;
    let endDate: Date | null = null;
    let chartDays = 7;

    if (range === 'today') {
      startDate = startOfToday;
      endDate = null;
      chartDays = 1;
    } else if (range === 'yesterday') {
      startDate = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
      endDate = startOfToday;
      chartDays = 1;
    } else if (range === 'date' && dateParam) {
      startDate = new Date(`${dateParam}T00:00:00+05:45`);
      endDate = new Date(`${dateParam}T23:59:59.999+05:45`);
      chartDays = 1;
    } else if (range === 'custom' && startDateParam && endDateParam) {
      startDate = new Date(`${startDateParam}T00:00:00+05:45`);
      endDate = new Date(`${endDateParam}T23:59:59.999+05:45`);
      const diffMs = Math.abs(endDate.getTime() - startDate.getTime());
      chartDays = Math.max(1, Math.min(60, Math.ceil(diffMs / (1000 * 60 * 60 * 24))));
    } else if (range === '7days') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      endDate = null;
      chartDays = 7;
    } else if (range === 'month') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      endDate = null;
      chartDays = 30;
    } else if (range === 'all') {
      startDate = null; // ALL TIME RECORD: No date ceiling or floor!
      endDate = null;
      chartDays = 30; // display last 30 active days on chart
    }

    // 1. Fetch active orders matching hotel and date
    const orderWhere: any = { hotelId: auth.hotelId };
    if (startDate && endDate) {
      orderWhere.createdAt = { gte: startDate, lt: endDate };
    } else if (startDate) {
      orderWhere.createdAt = { gte: startDate };
    }
    const currentOrders = await prisma.order.findMany({
      where: orderWhere,
      orderBy: { createdAt: 'desc' },
    });

    // 2. Fetch settled historical sales matching hotel and date
    const saleWhere: any = { hotelId: auth.hotelId };
    if (startDate && endDate) {
      saleWhere.orderDate = { gte: startDate, lt: endDate };
    } else if (startDate) {
      saleWhere.orderDate = { gte: startDate };
    }

    let historicalSales: any[] = [];
    const db = prisma as any;
    try {
      if (db.historicalSale?.findMany) {
        historicalSales = await db.historicalSale.findMany({
          where: saleWhere,
          orderBy: { orderDate: 'desc' },
        });
      } else {
        throw new Error('historicalSale is not available on active Prisma instance');
      }
    } catch {
      // Direct SQLite query fallback
      try {
        if (startDate && endDate) {
          historicalSales = await prisma.$queryRawUnsafe(
            `SELECT * FROM HistoricalSale WHERE hotelId = ? AND orderDate >= ? AND orderDate < ? ORDER BY orderDate DESC`,
            auth.hotelId,
            startDate.toISOString(),
            endDate.toISOString()
          );
        } else if (startDate) {
          historicalSales = await prisma.$queryRawUnsafe(
            `SELECT * FROM HistoricalSale WHERE hotelId = ? AND orderDate >= ? ORDER BY orderDate DESC`,
            auth.hotelId,
            startDate.toISOString()
          );
        } else {
          historicalSales = await prisma.$queryRawUnsafe(
            `SELECT * FROM HistoricalSale WHERE hotelId = ? ORDER BY orderDate DESC`,
            auth.hotelId
          );
        }
      } catch (rawErr) {
        console.warn('Raw query for HistoricalSale also failed (table may be empty or unmigrated):', rawErr);
        historicalSales = [];
      }
    }

    // Completed sales aggregation
    const activeDoneOrders = currentOrders.filter((o) => o.status === 'done');
    const activeCancelledOrders = currentOrders.filter((o) => o.status === 'cancelled');
    const activePendingOrders = currentOrders.filter(
      (o) => o.status === 'received' || o.status === 'in_progress'
    );

    const historicalTotal = historicalSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const activeDoneTotal = activeDoneOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    const activeCashTotal = activeDoneOrders
      .filter((o) => !String((o as any).paymentMethod || '').toLowerCase().includes('online'))
      .reduce((sum, o) => sum + o.totalAmount, 0);
    const activeOnlineTotal = activeDoneOrders
      .filter((o) => String((o as any).paymentMethod || '').toLowerCase().includes('online'))
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const historicalCashTotal = historicalSales
      .filter((s) => !String((s as any).paymentMethod || '').toLowerCase().includes('online'))
      .reduce((sum, s) => sum + s.totalAmount, 0);
    const historicalOnlineTotal = historicalSales
      .filter((s) => String((s as any).paymentMethod || '').toLowerCase().includes('online'))
      .reduce((sum, s) => sum + s.totalAmount, 0);

    const cashRevenue = activeCashTotal + historicalCashTotal;
    const onlineRevenue = activeOnlineTotal + historicalOnlineTotal;

    const activeDiscounts = activeDoneOrders.reduce((sum, o) => sum + ((o as any).discountAmount || 0), 0);
    const historicalDiscounts = historicalSales.reduce((sum, s) => sum + ((s as any).discountAmount || 0), 0);
    const totalDiscounts = activeDiscounts + historicalDiscounts;

    const totalRevenue = activeDoneTotal + historicalTotal;
    const grossSales = totalRevenue + totalDiscounts;
    const completedCount = activeDoneOrders.length + historicalSales.length;
    const totalOrdersCount = currentOrders.length + historicalSales.length;
    const pendingCount = activePendingOrders.length;
    const cancelledCount = activeCancelledOrders.length;
    const averageOrderValue = completedCount > 0 ? totalRevenue / completedCount : 0;

    // Top selling items aggregation from both active and historical
    const itemMap: Record<string, { name: string; quantity: number; revenue: number }> = {};

    function processItems(itemsJson: string) {
      try {
        const items = typeof itemsJson === 'string' ? JSON.parse(itemsJson) : itemsJson;
        if (Array.isArray(items)) {
          items.forEach((it: any) => {
            const key = (it.name || it.id || '').trim();
            if (!key) return;
            if (!itemMap[key]) {
              itemMap[key] = { name: it.name, quantity: 0, revenue: 0 };
            }
            const qty = Number(it.quantity) || 1;
            const price = Number(it.price) || 0;
            itemMap[key].quantity += qty;
            itemMap[key].revenue += qty * price;
          });
        }
      } catch {}
    }

    activeDoneOrders.forEach((o) => processItems(o.items));
    historicalSales.forEach((s) => processItems(s.items));

    const topItems = Object.values(itemMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // Group sales into daily trend buckets
    const daysMap: Record<string, { date: string; sales: number; count: number }> = {};

    if (range === 'yesterday') {
      const yesterdaySample = new Date(startOfToday.getTime() - 12 * 60 * 60 * 1000);
      const dateStr = yesterdaySample.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Kathmandu' });
      daysMap[dateStr] = { date: dateStr, sales: 0, count: 0 };
    } else if (range === 'date' && dateParam) {
      const d = new Date(`${dateParam}T12:00:00+05:45`);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Kathmandu' });
      daysMap[dateStr] = { date: dateStr, sales: 0, count: 0 };
    } else if (range === 'custom' && startDate && endDate) {
      const cur = new Date(startDate);
      let count = 0;
      while (cur <= endDate && count < 60) {
        const dateStr = cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Kathmandu' });
        daysMap[dateStr] = { date: dateStr, sales: 0, count: 0 };
        cur.setDate(cur.getDate() + 1);
        count++;
      }
    } else {
      for (let i = chartDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Kathmandu' });
        daysMap[dateStr] = { date: dateStr, sales: 0, count: 0 };
      }
    }

    // Populate active done orders into chart
    activeDoneOrders.forEach((o) => {
      const d = new Date(o.createdAt);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Kathmandu' });
      if (daysMap[dateStr]) {
        daysMap[dateStr].count += 1;
        daysMap[dateStr].sales += o.totalAmount;
      }
    });

    // Populate historical sales into chart
    historicalSales.forEach((s) => {
      const d = new Date(s.orderDate);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Kathmandu' });
      if (daysMap[dateStr]) {
        daysMap[dateStr].count += 1;
        daysMap[dateStr].sales += s.totalAmount;
      }
    });

    const dailyTrends = Object.values(daysMap);

    // Query expenses for the selected date range
    const expenseWhere: any = { hotelId: auth.hotelId };
    if (startDate && endDate) {
      expenseWhere.date = { gte: startDate, lt: endDate };
    } else if (startDate) {
      expenseWhere.date = { gte: startDate };
    }
    const expenses = await prisma.expense.findMany({
      where: expenseWhere,
      orderBy: { date: 'desc' },
    });

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = Math.round(totalRevenue - totalExpenses);

    // Group expenses by category
    const categoryMap: Record<string, number> = {};
    expenses.forEach((e) => {
      categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
    });

    const categoryBreakdown = Object.entries(categoryMap)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Construct unified orderRecords list (sorted newest to oldest)
    const orderRecords = [
      ...activeDoneOrders.map((o) => ({
        id: o.id,
        type: 'active',
        tableNumber: o.tableNumber,
        customerName: o.customerName || 'Walk-in Guest',
        customerPhone: o.customerPhone || null,
        totalAmount: o.totalAmount,
        discountAmount: (o as any).discountAmount || 0,
        paymentMethod: String((o as any).paymentMethod || '').toLowerCase().includes('online')
          ? 'online payment'
          : 'cash',
        items: typeof o.items === 'string' ? o.items : JSON.stringify(o.items),
        notes: o.notes || null,
        status: o.status,
        createdAt: o.createdAt,
      })),
      ...historicalSales.map((s) => ({
        id: s.id,
        type: 'historical',
        tableNumber: s.tableNumber,
        customerName: s.customerName || 'Walk-in Guest',
        customerPhone: s.customerPhone || null,
        totalAmount: s.totalAmount,
        discountAmount: (s as any).discountAmount || 0,
        paymentMethod: String((s as any).paymentMethod || '').toLowerCase().includes('online')
          ? 'online payment'
          : 'cash',
        items: typeof s.items === 'string' ? s.items : JSON.stringify(s.items),
        notes: s.notes || null,
        status: 'settled',
        createdAt: s.orderDate || s.settledAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      range,
      selectedDate: dateParam || null,
      startDate: startDateParam || null,
      endDate: endDateParam || null,
      summary: {
        totalRevenue: Math.round(totalRevenue),
        grossSales: Math.round(grossSales),
        cashRevenue: Math.round(cashRevenue),
        onlineRevenue: Math.round(onlineRevenue),
        totalDiscounts: Math.round(totalDiscounts),
        totalExpenses: Math.round(totalExpenses),
        netProfit,
        totalOrdersCount,
        completedCount,
        pendingCount,
        cancelledCount,
        averageOrderValue: Math.round(averageOrderValue),
      },
      topItems,
      dailyTrends,
      expenses: expenses.slice(0, 100),
      categoryBreakdown,
      orderRecords,
    });
  } catch (error) {
    console.error('Hotel reports error:', error);
    return NextResponse.json({ error: 'Failed to generate reports' }, { status: 500 });
  }
}
