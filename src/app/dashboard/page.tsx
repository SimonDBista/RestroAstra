'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Clock,
  ChefHat,
  CheckCircle2,
  XCircle,
  Printer,
  MessageCircle,
  RefreshCw,
  Search,
  AlertCircle,
  Filter,
  Sparkles,
  Volume2,
  ArrowRight,
  Archive,
  Banknote,
  Smartphone,
} from 'lucide-react';
import { OrderData, OrderItem } from '@/lib/types';
import { formatNPR, formatDate, formatTime } from '@/lib/utils';
import { useSocket } from '@/lib/socket';
import { playChime } from '@/lib/audio';
import ReceiptModal from '@/components/ReceiptModal';

export default function HotelOrdersDashboard() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [hotelId, setHotelId] = useState<string>('');
  const [hotelName, setHotelName] = useState<string>('Hotel');
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<OrderData | null>(null);
  const [isTableBillModal, setIsTableBillModal] = useState<boolean>(false);
  const [incomingAlert, setIncomingAlert] = useState<string | null>(null);
  const [clearConfirmModal, setClearConfirmModal] = useState<{
    isOpen: boolean;
    tableNumber?: string;
    count: number;
    amount?: number;
    customerName?: string;
  } | null>(null);
  const [settlePaymentMethod, setSettlePaymentMethod] = useState<'cash' | 'online'>('cash');
  const [isClearing, setIsClearing] = useState(false);

  const { socket } = useSocket();

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const meRes = await fetch('/api/auth/hotel/me');
      if (meRes.ok) {
        const meData = await meRes.json();
        setHotelId(meData.hotel.id);
        setHotelName(meData.hotel.name);
      }

      const res = await fetch('/api/hotel/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Background live sync every 4s to guarantee incoming orders are always visible even if socket reconnects
    const pollInterval = setInterval(() => {
      fetch('/api/hotel/orders')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.orders) {
            setOrders((prev) => {
              const prevMap = new Map(prev.map((o) => [o.id, o.status]));
              let hasChanged = data.orders.length !== prev.length;
              if (!hasChanged) {
                for (const o of data.orders) {
                  if (prevMap.get(o.id) !== o.status) {
                    hasChanged = true;
                    break;
                  }
                }
              }
              return hasChanged ? data.orders : prev;
            });
          }
        })
        .catch(() => {});
    }, 4000);

    return () => clearInterval(pollInterval);
  }, []);

  // Socket.io Realtime Listener
  useEffect(() => {
    if (!socket || !hotelId) return;

    socket.emit('join_hotel', hotelId);

    const handleNewOrder = (newOrder: OrderData) => {
      setOrders((prev) => {
        if (prev.some((o) => o.id === newOrder.id)) return prev;
        return [newOrder, ...prev];
      });
      try {
        playChime('order');
      } catch {}
      setIncomingAlert(`🛎️ New Order received from Table #${newOrder.tableNumber}!`);
    };

    const handleOrderUpdated = (data: { orderId: string; status: string; order?: OrderData }) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === data.orderId ? { ...o, status: data.status as any } : o))
      );
    };

    const handleOrdersCleared = () => {
      fetchOrders();
    };

    socket.on('new_order', handleNewOrder);
    socket.on('order_updated', handleOrderUpdated);
    socket.on('orders_cleared', handleOrdersCleared);

    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off('order_updated', handleOrderUpdated);
      socket.off('orders_cleared', handleOrdersCleared);
    };
  }, [socket, hotelId]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/hotel/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus as any } : o))
        );
        playChime('message');
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleClearOrders = async (tableNumber?: string, paymentMethod: 'cash' | 'online' = 'cash') => {
    try {
      setIsClearing(true);
      const res = await fetch('/api/hotel/orders/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: tableNumber || undefined,
          allCompleted: !tableNumber,
          paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details ? `${data.error}: ${data.details}` : (data.error || 'Failed to clear orders'));
      }

      await fetchOrders();
      setClearConfirmModal(null);
      playChime('success');
    } catch (err: any) {
      alert(err.message || 'Error clearing orders');
    } finally {
      setIsClearing(false);
    }
  };

  // Group orders by table number for consolidated table boxes
  interface TableGroup {
    tableNumber: string;
    customerName?: string;
    customerPhone?: string;
    orders: OrderData[];
    totalAmount: number;
    totalDiscount: number;
    latestCreatedAt: string | Date;
    hasReceived: boolean;
    hasInProgress: boolean;
    hasDone: boolean;
    allCancelled: boolean;
    allDone: boolean;
  }

  const tableGroups: TableGroup[] = React.useMemo(() => {
    const map = new Map<string, TableGroup>();

    // Sort chronologically (oldest to newest: Round 1, Round 2, ...)
    const sorted = [...orders].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const order of sorted) {
      const cleanNum = order.tableNumber.replace(/^table\s*#?/i, '').replace(/^#+/, '').trim();
      const key = cleanNum.toUpperCase() || order.tableNumber.trim().toUpperCase();
      if (!map.has(key)) {
        map.set(key, {
          tableNumber: cleanNum || order.tableNumber,
          customerName: order.customerName || undefined,
          customerPhone: order.customerPhone || undefined,
          orders: [],
          totalAmount: 0,
          totalDiscount: 0,
          latestCreatedAt: order.createdAt,
          hasReceived: false,
          hasInProgress: false,
          hasDone: false,
          allCancelled: true,
          allDone: true,
        });
      }

      const group = map.get(key)!;
      group.orders.push(order);
      if (order.status !== 'cancelled') {
        group.totalAmount += order.totalAmount;
        group.totalDiscount += ((order as any).discountAmount || 0);
      }
      if (order.customerName) group.customerName = order.customerName;
      if (order.customerPhone) group.customerPhone = order.customerPhone;
      if (new Date(order.createdAt).getTime() > new Date(group.latestCreatedAt).getTime()) {
        group.latestCreatedAt = order.createdAt;
      }
      if (order.status === 'received') group.hasReceived = true;
      if (order.status === 'in_progress') group.hasInProgress = true;
      if (order.status === 'done') group.hasDone = true;
      if (order.status !== 'cancelled') group.allCancelled = false;
      if (order.status !== 'done' && order.status !== 'cancelled') group.allDone = false;
    }

    // Sort table groups: prioritize tables with new received orders, then in-kitchen, then newest
    return Array.from(map.values()).sort((a, b) => {
      if (a.hasReceived && !b.hasReceived) return -1;
      if (!a.hasReceived && b.hasReceived) return 1;
      if (a.hasInProgress && !b.hasInProgress) return -1;
      if (!a.hasInProgress && b.hasInProgress) return 1;
      return new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime();
    });
  }, [orders]);

  const filteredTableGroups = tableGroups.filter((group) => {
    let matchesStatus = true;
    if (statusFilter === 'received') {
      matchesStatus = group.hasReceived;
    } else if (statusFilter === 'in_progress') {
      matchesStatus = group.hasInProgress;
    } else if (statusFilter === 'done') {
      matchesStatus = group.allDone && group.hasDone;
    } else if (statusFilter === 'cancelled') {
      matchesStatus = group.allCancelled;
    }

    const matchesTable =
      !tableSearch ||
      group.tableNumber.toLowerCase().includes(tableSearch.toLowerCase()) ||
      (group.customerName &&
        group.customerName.toLowerCase().includes(tableSearch.toLowerCase()));

    return matchesStatus && matchesTable;
  });

  const receivedCount = orders.filter((o) => o.status === 'received').length;
  const inProgressCount = orders.filter((o) => o.status === 'in_progress').length;
  const doneCount = orders.filter((o) => o.status === 'done').length;

  return (
    <div className="space-y-8">
      {/* Realtime Alert Banner */}
      {incomingAlert && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-brandPink-600 via-rose-500 to-gold-500 text-white font-bold text-xs sm:text-sm shadow-pink-glow flex items-center justify-between animate-bounce">
          <div className="flex items-center space-x-2.5">
            <Volume2 className="w-5 h-5 animate-pulse" />
            <span>{incomingAlert}</span>
          </div>
          <button
            onClick={() => setIncomingAlert(null)}
            className="text-xs bg-black/40 hover:bg-black/60 px-3 py-1 rounded-xl"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-extrabold text-stone-900">
            Live Kitchen & Table Feed
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Realtime multi-round order stream grouped by table with automatic audio alerts
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {doneCount > 0 && (
            <button
              onClick={() => {
                const totalDoneAmount = orders
                  .filter((o) => o.status === 'done')
                  .reduce((sum, o) => sum + o.totalAmount, 0);
                setSettlePaymentMethod('cash');
                setClearConfirmModal({
                  isOpen: true,
                  count: doneCount,
                  amount: totalDoneAmount,
                });
              }}
              className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-bold flex items-center space-x-1.5 transition shadow-xs"
              title="Settle bills and clear finished orders from the live kitchen screen"
            >
              <Archive className="w-3.5 h-3.5 text-emerald-700" />
              <span>Settle & Clear All ({doneCount})</span>
            </button>
          )}
          <button
            onClick={() => playChime('order')}
            title="Test audio chime"
            className="p-2.5 rounded-xl dark-btn text-amber-600 hover:border-amber-400 transition"
          >
            <Volume2 className="w-4 h-4" />
          </button>
          <button
            onClick={fetchOrders}
            className="px-4 py-2.5 rounded-xl dark-btn text-xs font-bold flex items-center space-x-2 hover:border-stone-400 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Orders</span>
          </button>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-stone-200/90 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 font-medium block">All Orders / Tables</span>
            <span className="text-3xl font-serif font-black text-stone-900 mt-1 block">
              {orders.length} <span className="text-xs font-sans text-stone-400">({tableGroups.length} tables)</span>
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-stone-100 border border-stone-200 text-stone-700 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-amber-50/70 border border-amber-300/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-amber-800 font-medium block">New / Received</span>
            <span className="text-3xl font-serif font-black text-amber-800 mt-1 block">{receivedCount}</span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-300">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-orange-50/70 border border-orange-300/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-orange-800 font-medium block">Cooking Now</span>
            <span className="text-3xl font-serif font-black text-orange-800 mt-1 block">{inProgressCount}</span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center border border-orange-300">
            <ChefHat className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-emerald-50/70 border border-emerald-300/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-800 font-medium block">Served / Done</span>
            <span className="text-3xl font-serif font-black text-emerald-800 mt-1 block">{doneCount}</span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-300">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'All Orders', count: orders.length },
            { id: 'received', label: 'Received (New)', count: receivedCount },
            { id: 'in_progress', label: 'In Kitchen', count: inProgressCount },
            { id: 'done', label: 'Completed', count: doneCount },
            { id: 'cancelled', label: 'Cancelled', count: orders.filter((o) => o.status === 'cancelled').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? 'gold-btn text-white shadow-sm'
                  : 'dark-btn text-stone-600 hover:text-stone-900'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
          <input
            type="text"
            placeholder="Search Table # or Guest..."
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 shadow-xs"
          />
        </div>
      </div>

      {/* Orders Grid / Feed */}
      {loading && orders.length === 0 ? (
        <div className="p-16 text-center">
          <div className="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin mx-auto mb-3 shadow-gold-glow" />
          <p className="text-xs text-stone-500 font-medium">Connecting kitchen live feed...</p>
        </div>
      ) : filteredTableGroups.length === 0 ? (
        <div className="p-16 text-center bg-white border border-stone-200 rounded-3xl shadow-sm">
          <ShoppingBag className="w-12 h-12 text-stone-300 mx-auto mb-2" />
          <h3 className="font-serif font-bold text-stone-800 text-base">No active orders found</h3>
          <p className="text-xs text-stone-500 mt-1">
            Incoming table orders placed by diners will stream here live.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredTableGroups.map((group) => {
            return (
              <div
                key={group.tableNumber}
                className={`bg-white border rounded-3xl p-6 shadow-sm flex flex-col justify-between transition-all duration-300 ${
                  group.hasReceived
                    ? 'border-amber-400 ring-2 ring-amber-200 shadow-md'
                    : group.hasInProgress
                    ? 'border-orange-400 shadow-sm'
                    : group.allDone
                    ? 'border-emerald-300 shadow-xs'
                    : 'border-stone-200 opacity-75'
                }`}
              >
                <div>
                  {/* Top Bar: Table & Total */}
                  <div className="flex items-center justify-between pb-3.5 border-b border-stone-200">
                    <div className="flex items-center space-x-2.5">
                      <span className="px-3.5 py-1.5 rounded-full bg-stone-100 border border-stone-300 text-stone-900 font-serif font-black text-sm shadow-xs">
                        TABLE #{group.tableNumber}
                      </span>
                      {group.orders.length > 1 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase border border-amber-300 animate-pulse">
                          🔥 {group.orders.length} Rounds
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-stone-500 block font-semibold">
                          Combined Bill
                        </span>
                        {group.totalDiscount > 0 && (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 rounded-md">
                            -{formatNPR(group.totalDiscount)}
                          </span>
                        )}
                      </div>
                      <span className="text-base font-serif font-black text-amber-700">
                        {formatNPR(group.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Customer Info */}
                  {(group.customerName || group.customerPhone) && (
                    <div className="py-2.5 text-xs text-stone-700 flex items-center justify-between border-b border-stone-100">
                      <span>Guest: <strong>{group.customerName || 'Walk-in'}</strong></span>
                      {group.customerPhone && (
                        <span className="text-stone-500 font-mono">{group.customerPhone}</span>
                      )}
                    </div>
                  )}

                  {/* Multi-Order Rounds List inside SAME Customer Box */}
                  <div className="py-3.5 space-y-3.5 max-h-96 overflow-y-auto pr-1">
                    {group.orders.map((order, roundIdx) => {
                      let items: OrderItem[] = [];
                      try {
                        items =
                          typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                      } catch {}

                      const isRoundReceived = order.status === 'received';
                      const isRoundInProgress = order.status === 'in_progress';
                      const isRoundDone = order.status === 'done';
                      const isRoundCancelled = order.status === 'cancelled';

                      return (
                        <div
                          key={order.id}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isRoundReceived
                              ? 'bg-amber-50/80 border-amber-300 shadow-xs'
                              : isRoundInProgress
                              ? 'bg-orange-50/80 border-orange-300 shadow-xs'
                              : isRoundDone
                              ? 'bg-emerald-50/70 border-emerald-200'
                              : 'bg-stone-50 border-stone-200 opacity-60'
                          }`}
                        >
                          {/* Round Header */}
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-200/80">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-serif font-extrabold text-stone-900">
                                {roundIdx === 0
                                  ? '1st Order (Initial)'
                                  : roundIdx === 1
                                  ? '2nd Order (Add-on)'
                                  : `${roundIdx + 1}th Order (Add-on)`}
                              </span>
                              <span className="text-[10px] text-stone-500 font-mono">
                                {formatTime(order.createdAt)}
                              </span>
                            </div>

                            <span
                              className={`text-[9px] uppercase font-black px-2.5 py-0.5 rounded-full ${
                                isRoundReceived
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : isRoundInProgress
                                  ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                  : isRoundDone
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {order.status}
                            </span>
                          </div>

                          {/* Items List */}
                          <div className="space-y-1.5 py-1">
                            {items.map((item, idx) => (
                              <div key={idx} className="flex items-start justify-between text-xs">
                                <div className="flex-1 pr-2">
                                  <span className="font-serif font-black text-amber-700 mr-2">
                                    {item.quantity}x
                                  </span>
                                  <span className="text-stone-900 font-semibold">{item.name}</span>
                                  {item.notes && (
                                    <p className="text-[10px] text-amber-700 italic mt-0.5">
                                      • {item.notes}
                                    </p>
                                  )}
                                </div>
                                <span className="font-bold text-stone-700">
                                  {formatNPR(item.price * item.quantity)}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Instructions */}
                          {order.notes && (
                            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
                              <span className="font-bold">Instructions: </span>
                              {order.notes}
                            </div>
                          )}

                          {/* Round Subtotal & Status Action Buttons */}
                          <div className="mt-3 pt-2.5 border-t border-stone-200/80 flex items-center justify-between gap-2">
                            <div className="flex items-center space-x-1.5 flex-1">
                              {isRoundReceived && (
                                <>
                                  <button
                                    onClick={() => updateOrderStatus(order.id, 'in_progress')}
                                    className="flex-1 py-1.5 px-3 rounded-xl gold-btn text-[11px] font-bold flex items-center justify-center space-x-1 shadow-sm"
                                  >
                                    <ChefHat className="w-3.5 h-3.5" />
                                    <span>Start Cooking</span>
                                  </button>
                                  <button
                                    onClick={() => updateOrderStatus(order.id, 'cancelled')}
                                    className="py-1.5 px-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-semibold"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}

                              {isRoundInProgress && (
                                <button
                                  onClick={() => updateOrderStatus(order.id, 'done')}
                                  className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold flex items-center justify-center space-x-1 shadow transition"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Mark as Served</span>
                                </button>
                              )}

                              {isRoundDone && (
                                <span className="text-[11px] text-emerald-700 font-semibold flex items-center space-x-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Served to Table</span>
                                </span>
                              )}

                              {isRoundCancelled && (
                                <span className="text-[11px] text-red-600 font-semibold">
                                  Order Cancelled
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => {
                                setIsTableBillModal(false);
                                setSelectedReceiptOrder(order);
                              }}
                              title={`Print KOT for Round #${roundIdx + 1}`}
                              className="py-1 px-2.5 rounded-xl dark-btn text-stone-700 text-[10px] font-semibold flex items-center space-x-1 hover:border-amber-400 transition shrink-0"
                            >
                              <Printer className="w-3 h-3 text-amber-600" />
                              <span>KOT</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Table Box Footer Actions */}
                <div className="pt-4 border-t border-stone-200 flex items-center space-x-2 w-full">
                  {/* Print Combined Bill for Table */}
                  <button
                    onClick={() => {
                      const allItems: OrderItem[] = [];
                      group.orders.forEach((ord, oIdx) => {
                        if (ord.status === 'cancelled') return;
                        try {
                          const its: OrderItem[] =
                            typeof ord.items === 'string' ? JSON.parse(ord.items) : ord.items;
                          its.forEach((it) => {
                            allItems.push({
                              ...it,
                              name: group.orders.length > 1 ? `[R${oIdx + 1}] ${it.name}` : it.name,
                            });
                          });
                        } catch {}
                      });

                      const combinedOrder: OrderData = {
                        ...group.orders[group.orders.length - 1],
                        tableNumber: group.tableNumber,
                        customerName: group.customerName || '',
                        customerPhone: group.customerPhone || '',
                        totalAmount: group.totalAmount,
                        discountAmount: group.totalDiscount,
                        items: JSON.stringify(allItems),
                      };
                      setIsTableBillModal(true);
                      setSelectedReceiptOrder(combinedOrder);
                    }}
                    className="flex-1 py-2.5 rounded-xl dark-btn text-stone-800 text-xs font-bold flex items-center justify-center space-x-1.5 hover:border-amber-400 transition shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-600" />
                    <span>Print Table Bill</span>
                  </button>

                  {group.allDone && (
                    <button
                      onClick={() => {
                        setSettlePaymentMethod('cash');
                        setClearConfirmModal({
                          isOpen: true,
                          tableNumber: group.tableNumber,
                          count: group.orders.length,
                          amount: group.totalAmount,
                          customerName: group.customerName,
                        });
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-bold flex items-center space-x-1.5 transition shrink-0"
                      title="Settle bill and clear Table from active feed"
                    >
                      <Archive className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Settle & Clear</span>
                    </button>
                  )}

                  <Link
                    href={`/dashboard/chat?orderId=${group.orders[group.orders.length - 1].id}`}
                    className="px-4 py-2.5 rounded-xl dark-btn text-amber-700 text-xs font-bold flex items-center space-x-1.5 hover:border-amber-400 transition"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Chat</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Settle & Clear Orders Confirmation Modal */}
      {clearConfirmModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg bg-white border border-stone-200 rounded-3xl p-6 text-center shadow-2xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200">
              <Archive className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-serif font-bold text-stone-900">
                {clearConfirmModal.tableNumber
                  ? `Settle & Clear Table #${clearConfirmModal.tableNumber}`
                  : `Settle All Completed Orders (${clearConfirmModal.count})`}
              </h3>
              {clearConfirmModal.customerName && (
                <p className="text-xs text-amber-700 font-medium mt-1">
                  Guest: {clearConfirmModal.customerName}
                </p>
              )}
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                Choose the payment method before archiving to your permanent sales ledger.
              </p>
            </div>

            {/* Bill Amount Pill */}
            {clearConfirmModal.amount !== undefined && (
              <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs">
                <span className="text-stone-500 font-medium">Total Bill Amount:</span>
                <span className="font-serif font-black text-emerald-700 text-base">
                  {formatNPR(clearConfirmModal.amount)}
                </span>
              </div>
            )}

            {/* Payment Method Selector */}
            <div className="text-left space-y-2 pt-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700">
                Payment Method Received <span className="text-rose-500">*</span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                {/* Cash Option */}
                <button
                  type="button"
                  onClick={() => setSettlePaymentMethod('cash')}
                  className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                    settlePaymentMethod === 'cash'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-md ring-1 ring-emerald-500'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        settlePaymentMethod === 'cash'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-stone-200/60 text-stone-500'
                      }`}
                    >
                      <Banknote className="w-4 h-4" />
                    </div>
                    {settlePaymentMethod === 'cash' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-bold block text-stone-900">Cash (नगद)</span>
                    <span className="text-[10px] text-stone-500 block mt-0.5 leading-tight">
                      Received in counter cash drawer
                    </span>
                  </div>
                </button>

                {/* Online Option */}
                <button
                  type="button"
                  onClick={() => setSettlePaymentMethod('online')}
                  className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                    settlePaymentMethod === 'online'
                      ? 'bg-sky-50 border-sky-500 text-sky-950 shadow-md ring-1 ring-sky-500'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        settlePaymentMethod === 'online'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-stone-200/60 text-stone-500'
                      }`}
                    >
                      <Smartphone className="w-4 h-4" />
                    </div>
                    {settlePaymentMethod === 'online' && (
                      <CheckCircle2 className="w-4 h-4 text-sky-600" />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-bold block text-stone-900">Online Payment</span>
                    <span className="text-[10px] text-stone-500 block mt-0.5 leading-tight">
                      Fonepay, eSewa, QR, or Card
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-[11px] text-amber-800 text-left flex items-start space-x-2.5">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Order Record Saved:</strong> Payment method ({settlePaymentMethod.toUpperCase()}) will be stored in your <strong>Daily Order Records & Financial Reports</strong>.
              </span>
            </div>

            <div className="flex items-center space-x-2.5 pt-2">
              <button
                onClick={() => setClearConfirmModal(null)}
                disabled={isClearing}
                className="flex-1 py-3 rounded-xl dark-btn text-xs font-semibold text-stone-700 hover:text-stone-900"
              >
                Keep on Screen
              </button>
              <button
                onClick={() =>
                  handleClearOrders(clearConfirmModal.tableNumber, settlePaymentMethod)
                }
                disabled={isClearing}
                className={`flex-1 py-3 rounded-xl text-white text-xs font-extrabold transition shadow-md flex items-center justify-center space-x-1.5 ${
                  settlePaymentMethod === 'online'
                    ? 'bg-sky-600 hover:bg-sky-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {isClearing ? (
                  <span>Clearing...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Settle via {settlePaymentMethod === 'online' ? 'Online' : 'Cash'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thermal Receipt Print Modal */}
      <ReceiptModal
        isOpen={!!selectedReceiptOrder}
        onClose={() => setSelectedReceiptOrder(null)}
        order={selectedReceiptOrder}
        hotelName={hotelName}
        isTableBill={isTableBillModal}
        onOrderUpdated={() => fetchOrders()}
      />
    </div>
  );
}
