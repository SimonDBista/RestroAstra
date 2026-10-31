'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  ChefHat,
  MessageCircle,
  Star,
  Send,
  Sparkles,
  ArrowLeft,
  Phone,
  HelpCircle,
  AlertCircle,
  Receipt,
  Heart,
  ExternalLink,
  Edit3,
  XCircle,
  PlusCircle,
  RotateCcw,
  QrCode,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { OrderData, OrderItem, ChatMessageData } from '@/lib/types';
import { translations, Language } from '@/lib/i18n';
import { formatNPR, formatDate, formatTime } from '@/lib/utils';
import { useSocket } from '@/lib/socket';
import { playChime, playCustomerMessageChime } from '@/lib/audio';
import TableQRScannerModal from '@/components/TableQRScannerModal';

export default function OrderTrackingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-full border-4 border-gold-500/20 border-t-gold-500 animate-spin mb-4 shadow-gold-glow" />
          <p className="text-sm font-semibold text-white">Loading Your Table Order...</p>
        </div>
      }
    >
      <OrderTrackingContent />
    </Suspense>
  );
}

function OrderTrackingContent() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<OrderData | null>(null);
  const [tableOrders, setTableOrders] = useState<OrderData[]>([]);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [lang, setLang] = useState<Language>('en');
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isTableSettled, setIsTableSettled] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [incomingStaffToast, setIncomingStaffToast] = useState<{
    id: string;
    message: string;
    createdAt: string | Date;
  } | null>(null);

  // Feedback state
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocket();
  const t = translations[lang];

  useEffect(() => {
    async function fetchOrder() {
      try {
        setLoading(true);
        const res = await fetch(`/api/public/orders/${orderId}`);
        if (!res.ok) throw new Error('Order not found');
        const data = await res.json();
        setOrder(data.order);
        if (data.isSettled || data.sessionEnded) {
          setIsTableSettled(true);
          // Invalidate stored session in client storage
          if (data.order?.hotel?.slug && data.order?.tableNumber) {
            try {
              localStorage.removeItem(`last_order_${data.order.hotel.slug}`);
              localStorage.removeItem(`last_table_${data.order.hotel.slug}`);
              localStorage.removeItem(
                `session_token_${data.order.hotel.slug}_${data.order.tableNumber}`
              );
              sessionStorage.removeItem(`session_time_${data.order.hotel.slug}_${data.order.tableNumber}`);
              sessionStorage.setItem(`table_session_ended_${data.order.hotel.slug}_${data.order.tableNumber}`, 'true');
              sessionStorage.setItem(`last_settled_table_${data.order.hotel.slug}`, data.order.tableNumber);
              localStorage.setItem(`table_settled_at_${data.order.hotel.slug}_${data.order.tableNumber}`, data.lastSettledAt || new Date().toISOString());
            } catch {}
          }
        }
        if (data.order.chatMessages) {
          setMessages(data.order.chatMessages);
        }
        if (data.order.feedback) {
          setFeedbackSubmitted(true);
          setRating(data.order.feedback.rating);
          setComment(data.order.feedback.comment || '');
        }

        // Fetch sibling rounds for this table
        if (data.order?.hotel?.slug && data.order?.tableNumber) {
          try {
            const actRes = await fetch(
              `/api/public/orders/active?hotelSlug=${encodeURIComponent(
                data.order.hotel.slug
              )}&tableNumber=${encodeURIComponent(data.order.tableNumber)}`
            );
            if (actRes.ok) {
              const actData = await actRes.json();
              if (actData.activeOrders) {
                setTableOrders(actData.activeOrders);
              }
            }
          } catch {}
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (orderId) fetchOrder();
  }, [orderId]);

  // Socket.io Listener
  useEffect(() => {
    if (!socket || !orderId) return;

    socket.emit('join_order', orderId);
    if (order?.hotelId && order?.tableNumber) {
      socket.emit('join_table', {
        hotelId: order.hotelId,
        tableNumber: order.tableNumber,
      });
    }

    const handleStatusUpdate = (data: { status: string; order?: any }) => {
      setOrder((prev) => {
        if (!prev) return prev;
        return { ...prev, status: data.status as any };
      });
      playChime('order');

      if (data.status === 'done') {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
        });
      }
    };

    const handleOrderSettled = (data: any) => {
      setIsTableSettled(true);
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              status: 'done' as any,
              paymentMethod: data?.paymentMethod || prev.paymentMethod || 'cash',
            }
          : prev
      );
      const targetSlug = order?.hotel?.slug;
      const targetTable = data?.tableNumber || order?.tableNumber;
      if (targetSlug && targetTable) {
        try {
          localStorage.removeItem(`last_order_${targetSlug}`);
          localStorage.removeItem(`last_table_${targetSlug}`);
          localStorage.removeItem(
            `session_token_${targetSlug}_${targetTable}`
          );
          sessionStorage.removeItem(`session_time_${targetSlug}_${targetTable}`);
          sessionStorage.setItem(`table_session_ended_${targetSlug}_${targetTable}`, 'true');
          sessionStorage.setItem(`last_settled_table_${targetSlug}`, targetTable);
          localStorage.setItem(`table_settled_at_${targetSlug}_${targetTable}`, data?.settledAt || new Date().toISOString());
        } catch {}
      }
      playChime('success');
    };

    const handleTableSessionEnded = (data: any) => {
      const targetSlug = order?.hotel?.slug;
      const endedTbl = data?.tableNumber || order?.tableNumber;
      if (!order?.tableNumber || String(data.tableNumber).trim() === String(order.tableNumber).trim()) {
        setIsTableSettled(true);
        if (targetSlug && endedTbl) {
          try {
            localStorage.removeItem(`last_order_${targetSlug}`);
            localStorage.removeItem(`last_table_${targetSlug}`);
            localStorage.removeItem(
              `session_token_${targetSlug}_${endedTbl}`
            );
            sessionStorage.removeItem(`session_time_${targetSlug}_${endedTbl}`);
            sessionStorage.setItem(`table_session_ended_${targetSlug}_${endedTbl}`, 'true');
            sessionStorage.setItem(`last_settled_table_${targetSlug}`, endedTbl);
            localStorage.setItem(`table_settled_at_${targetSlug}_${endedTbl}`, data?.settledAt || new Date().toISOString());
          } catch {}
        }
      }
    };

    const handleNewMessage = (msg: ChatMessageData) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (msg.sender === 'staff') {
        try {
          playCustomerMessageChime();
        } catch {}
        setIncomingStaffToast({
          id: msg.id || String(Date.now()),
          message: msg.message,
          createdAt: msg.createdAt || new Date(),
        });
        setTimeout(() => {
          setIncomingStaffToast((prev) => (prev?.id === msg.id ? null : prev));
        }, 8000);
      }
    };

    socket.on('order_status_updated', handleStatusUpdate);
    socket.on('order_settled_and_cleared', handleOrderSettled);
    socket.on('table_session_ended', handleTableSessionEnded);
    socket.on('chat_message', handleNewMessage);

    return () => {
      socket.off('order_status_updated', handleStatusUpdate);
      socket.off('order_settled_and_cleared', handleOrderSettled);
      socket.off('table_session_ended', handleTableSessionEnded);
      socket.off('chat_message', handleNewMessage);
    };
  }, [socket, orderId, order?.hotelId, order?.tableNumber, order?.hotel?.slug]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      const res = await fetch(`/api/public/chat/${orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, sender: 'customer' }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingFeedback) return;

    setIsSubmittingFeedback(true);
    try {
      const res = await fetch('/api/public/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          rating,
          comment,
          customerName: order?.customerName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit feedback');

      setFeedbackSubmitted(true);
      playChime('success');
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      alert(err.message || 'Feedback submission failed');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    try {
      setIsCancelling(true);
      const res = await fetch(`/api/public/orders/${order.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel order');
      }
      setOrder((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
      setShowCancelModal(false);
      playChime('message');
    } catch (err: any) {
      alert(err.message || 'Could not cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin mb-4 shadow-sm" />
        <p className="text-sm font-semibold text-stone-800">Loading Your Table Order...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <h2 className="text-xl font-serif font-bold text-stone-900 mb-2">Order Not Found</h2>
        <Link href="/" className="px-6 py-2 gold-btn rounded-xl text-xs font-bold mt-4 shadow-sm">
          Return Home
        </Link>
      </div>
    );
  }

  let items: OrderItem[] = [];
  try {
    items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  } catch {}

  const isDone = order.status === 'done';
  const isInProgress = order.status === 'in_progress';
  const isReceived = order.status === 'received';
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 selection:bg-amber-500 selection:text-white">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-stone-200 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <Link
          href={
            order.hotel?.slug
              ? isTableSettled
                ? `/menu/${order.hotel.slug}`
                : `/menu/${order.hotel.slug}?table=${encodeURIComponent(order.tableNumber)}&qr=1`
              : '#'
          }
          className="flex items-center space-x-2 text-xs font-bold text-stone-600 hover:text-amber-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isTableSettled ? 'Browse Menu' : 'Back to Menu'}</span>
        </Link>

        <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-300">
          <span className={`w-2 h-2 rounded-full ${isTableSettled ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`} />
          <span className="text-xs font-serif font-bold text-amber-900">
            {order.tableNumber?.toLowerCase().startsWith('room')
              ? `Rooms #${order.tableNumber.replace(/^room\s*#?/i, '')}`
              : `Table #${order.tableNumber}`}
            {isTableSettled && ' (Closed)'}
          </span>
        </div>
      </header>

      {/* Floating Incoming Staff Message Notification Toast */}
      {incomingStaffToast && (
        <div className="fixed top-16 left-4 right-4 max-w-md mx-auto z-50 animate-slide-up">
          <div className="bg-white/95 border-2 border-amber-400 rounded-2xl p-4 shadow-xl backdrop-blur-xl flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-700 border border-amber-500/30 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 animate-bounce" />
                </div>
                <div>
                  <span className="text-xs font-serif font-bold text-stone-900 block">
                    {lang === 'en' ? 'Staff Desk / Reception Reply' : 'होटल कर्मचारीको सन्देश'}
                  </span>
                  <span className="text-[10px] text-amber-700 font-semibold">
                    {formatTime(incomingStaffToast.createdAt)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIncomingStaffToast(null)}
                className="text-stone-400 hover:text-stone-800 p-1 rounded-lg text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-800 bg-stone-50 rounded-xl p-2.5 border border-stone-200 line-clamp-2 leading-relaxed font-medium">
              &ldquo;{incomingStaffToast.message}&rdquo;
            </p>

            <div className="flex items-center justify-end space-x-2 pt-0.5">
              <button
                onClick={() => setIncomingStaffToast(null)}
                className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-semibold text-stone-600 hover:text-stone-900 transition"
              >
                {lang === 'en' ? 'Dismiss' : 'हटाउनुहोस्'}
              </button>
              <button
                onClick={() => {
                  setIncomingStaffToast(null);
                  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                  document.querySelector<HTMLInputElement>('input[placeholder*="message"]')?.focus();
                }}
                className="px-4 py-1.5 rounded-xl gold-btn text-xs font-bold text-black flex items-center space-x-1 shadow-sm"
              >
                <span>{lang === 'en' ? 'View & Reply' : 'हेर्नुहोस् र जवाफ दिनुहोस्'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-xl mx-auto px-4 pt-6 space-y-6">
        {/* Celebration Card */}
        {isDone ? (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-amber-50 via-white to-emerald-50/40 border-2 border-amber-400/60 p-6 sm:p-8 text-center shadow-md animate-fade-in">
            {/* Elegant Botanical Corner Icons */}
            <div className="absolute top-3 left-4 text-amber-600/70 text-xl">🌿</div>
            <div className="absolute top-3 right-4 text-amber-600/70 text-xl">🌿</div>
            <div className="absolute bottom-3 left-4 text-amber-600/70 text-xl">🌿</div>
            <div className="absolute bottom-3 right-4 text-amber-600/70 text-xl">🌿</div>

            {/* Inner Border Frame */}
            <div className="border border-amber-400/40 rounded-2xl py-8 px-4">
              <span className="text-[10px] uppercase tracking-[0.35em] text-amber-700 font-serif font-bold">
                DINING COMPLETED
              </span>
              <h2 className="text-3xl sm:text-4xl font-serif font-extrabold text-stone-900 mt-2 uppercase tracking-wider">
                Thank You
              </h2>
              <p className="text-xs uppercase tracking-[0.3em] text-stone-600 mt-1 font-semibold">
                FOR DINING WITH US
              </p>
              <p className="text-xs text-emerald-800 mt-4 max-w-xs mx-auto leading-relaxed">
                {order.hotel?.name || 'Our team'} hopes you loved every single bite!
              </p>
            </div>
          </div>
        ) : (
          /* Live Order Stepper Status Card */
          <div className="bg-white border border-stone-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">
                  {t.orderId} #{order.id.slice(-6).toUpperCase()}
                </span>
                <h1 className="text-lg font-serif font-extrabold text-stone-900 mt-0.5">
                  {order.hotel?.name || 'Hotel Order'}
                </h1>
              </div>
              <div className="text-right">
                <span className="text-xs text-stone-400 block">{formatTime(order.createdAt)}</span>
                <span className="text-xs font-bold text-amber-600">{items.length} Dishes</span>
              </div>
            </div>

            {/* Stepper Timeline */}
            <div className="py-6">
              <div className="relative flex items-center justify-between">
                {/* Connector Line */}
                <div className="absolute top-1/2 left-8 right-8 -translate-y-1/2 h-1 bg-stone-200 z-0">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-700 shadow-sm"
                    style={{
                      width: isDone ? '100%' : isInProgress ? '50%' : '10%',
                    }}
                  />
                </div>

                {/* Step 1: Received */}
                <div className="relative z-10 flex flex-col items-center">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all ${
                      isReceived || isInProgress || isDone
                        ? 'bg-amber-500 border-amber-300 text-black shadow-sm'
                        : 'bg-stone-100 border-stone-300 text-stone-400'
                    }`}
                  >
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-stone-700 mt-2">
                    Received
                  </span>
                </div>

                {/* Step 2: Preparing */}
                <div className="relative z-10 flex flex-col items-center">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all ${
                      isInProgress || isDone
                        ? 'bg-amber-600 border-amber-400 text-white shadow-sm'
                        : 'bg-stone-100 border-stone-300 text-stone-400'
                    }`}
                  >
                    <ChefHat className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-stone-700 mt-2">
                    Preparing
                  </span>
                </div>

                {/* Step 3: Served */}
                <div className="relative z-10 flex flex-col items-center">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all ${
                      isDone
                        ? 'bg-emerald-500 border-emerald-300 text-black shadow-sm'
                        : 'bg-stone-100 border-stone-300 text-stone-400'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-stone-700 mt-2">
                    Served
                  </span>
                </div>
              </div>

              {/* Status Description Banner */}
              <div className="mt-6 p-4 bg-amber-50/80 rounded-2xl border border-amber-200 text-center">
                <p className="text-xs font-semibold text-amber-900 leading-relaxed">
                  {isReceived && t.statusReceivedDesc}
                  {isInProgress && t.statusInProgressDesc}
                  {isDone && t.statusDoneDesc}
                  {isCancelled && 'This order was cancelled by the hotel.'}
                </p>
              </div>

              {/* Sibling Rounds for this Table */}
              {tableOrders.length > 1 && (
                <div className="mt-5 pt-4 border-t border-stone-100">
                  <div className="text-[10px] uppercase font-bold text-stone-500 mb-2 tracking-wider flex items-center justify-between">
                    <span>{order.tableNumber?.toLowerCase().startsWith('room') ? `Rooms #${order.tableNumber.replace(/^room\s*#?/i, '')}` : `Table #${order.tableNumber}`} Dining Rounds ({tableOrders.length})</span>
                    <span className="text-[10px] text-amber-600 font-mono">Tap round to view</span>
                  </div>
                  <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
                    {tableOrders.map((tOrder, idx) => {
                      const isCurrent = tOrder.id === order.id;
                      return (
                        <button
                          key={tOrder.id}
                          onClick={() => router.push(`/order/${tOrder.id}`)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 whitespace-nowrap ${
                            isCurrent
                              ? 'gold-btn text-black shadow-sm'
                              : 'bg-stone-50 text-stone-700 border border-stone-200 hover:border-amber-400'
                          }`}
                        >
                          <span>Round #{idx + 1}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-md uppercase font-black ${
                              tOrder.status === 'received'
                                ? 'bg-amber-100 text-amber-800'
                                : tOrder.status === 'in_progress'
                                ? 'bg-orange-100 text-orange-800'
                                : tOrder.status === 'done'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {tOrder.status}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Customer Actions: Edit / Cancel / Add More Dishes / Rescan when settled */}
              <div className="mt-5 pt-4 border-t border-stone-100 flex flex-wrap items-center gap-2.5">
                {isTableSettled ? (
                  <div className="w-full p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-emerald-50 via-white to-amber-50 border-2 border-emerald-400/60 text-center space-y-4 shadow-sm animate-fade-in">
                    <div className="flex items-center justify-center space-x-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                      <CheckCircle2 className="w-4 h-4 animate-pulse" />
                      <span>Table Bill Settled & Session Ended</span>
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-serif font-extrabold text-lg sm:text-xl text-stone-900">
                        Table #{order.tableNumber} Session Closed
                      </h4>
                      <p className="text-xs text-stone-600 leading-relaxed max-w-sm mx-auto">
                        Staff has settled and cleared your table. Thank you for dining with us! To start a new dining session or place a new order, please scan your table QR code.
                      </p>
                    </div>
                    {order.paymentMethod && (
                      <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-white border border-stone-200 text-xs text-stone-700 shadow-sm">
                        <span className="text-stone-500">Payment Settled:</span>
                        <span className="font-bold text-emerald-700 uppercase">
                          {String(order.paymentMethod || '').toLowerCase().includes('online')
                            ? 'Online Payment'
                            : 'Cash'}
                        </span>
                      </div>
                    )}
                    <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                      <button
                        onClick={() => setIsQRScannerOpen(true)}
                        className="flex-1 py-3 rounded-2xl gold-btn text-black text-xs font-black flex items-center justify-center space-x-2 shadow-sm hover:scale-[1.01] transition"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Scan Table QR for New Order</span>
                      </button>
                      <Link
                        href={`/menu/${order.hotel?.slug || ''}`}
                        className="py-3 px-4 rounded-2xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-bold flex items-center justify-center space-x-1.5 transition shadow-sm"
                      >
                        <span>Browse Menu</span>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    {isReceived && (
                      <>
                        <Link
                          href={`/menu/${order.hotel?.slug || ''}?table=${encodeURIComponent(
                            order.tableNumber
                          )}&editOrder=${order.id}`}
                          className="flex-1 py-2.5 rounded-xl bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center space-x-1.5 transition shadow-sm"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Dishes</span>
                        </Link>

                        <button
                          onClick={() => setShowCancelModal(true)}
                          className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 text-xs font-semibold flex items-center space-x-1.5 transition"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </button>
                      </>
                    )}

                    {!isCancelled && !isDone && (
                      <Link
                        href={`/menu/${order.hotel?.slug || ''}?table=${encodeURIComponent(
                          order.tableNumber
                        )}&qr=1`}
                        className="flex-1 py-2.5 rounded-xl gold-btn text-black text-xs font-extrabold flex items-center justify-center space-x-1.5 shadow-sm hover:scale-[1.02] transition"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Add Extra Dishes (Round 2+)</span>
                      </Link>
                    )}

                    {!isCancelled && isDone && (
                      <Link
                        href={`/menu/${order.hotel?.slug || ''}?table=${encodeURIComponent(
                          order.tableNumber
                        )}&qr=1`}
                        className="flex-1 py-2.5 rounded-xl bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 text-xs font-extrabold flex items-center justify-center space-x-1.5 transition shadow-sm"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Add Extra Dishes (Next Round)</span>
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Live Receptionist Chat Section */}
        <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center border border-amber-500/30">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 text-xs sm:text-sm">
                  {t.liveChat}
                </h3>
                <p className="text-[10px] text-emerald-600 flex items-center space-x-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Receptionist / Staff Connected</span>
                </p>
              </div>
            </div>
          </div>

          {/* Chat Stream */}
          <div className="p-4 h-56 overflow-y-auto space-y-2.5 bg-stone-50">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-500 text-xs text-center p-4">
                <HelpCircle className="w-7 h-7 mb-1.5 text-stone-400 opacity-60" />
                <p>Have special requests for Table #{order.tableNumber}?</p>
                <p className="text-[11px] text-amber-700 font-semibold mt-1">Send a message directly to reception below.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isCustomer = msg.sender === 'customer';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}
                  >
                    <span className="text-[9px] text-stone-400 mb-0.5 px-1 font-mono">
                      {isCustomer ? 'You' : 'Staff'} • {formatTime(msg.createdAt)}
                    </span>
                    <div
                      className={`max-w-[80%] px-4 py-2 rounded-2xl text-xs leading-relaxed ${
                        isCustomer
                          ? 'bg-amber-500 text-stone-950 rounded-br-none shadow-sm font-semibold'
                          : 'bg-white text-stone-900 border border-stone-200 rounded-bl-none shadow-sm'
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-white border-t border-stone-200 flex items-center space-x-2"
          >
            <input
              type="text"
              placeholder={t.chatPlaceholder}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className="p-2.5 rounded-xl gold-btn text-black disabled:opacity-40 shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Post-Order Feedback / Rating Section */}
        <div className="bg-white border border-stone-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center space-x-2 mb-3">
            <Heart className="w-5 h-5 text-amber-500" />
            <h3 className="font-serif font-bold text-stone-900 text-base">
              {t.leaveFeedback}
            </h3>
          </div>

          {feedbackSubmitted ? (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1.5" />
              <h4 className="font-bold text-sm text-stone-900">Review Submitted</h4>
              <div className="flex items-center justify-center space-x-1 my-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= rating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-stone-300'
                    }`}
                  />
                ))}
              </div>
              {comment && <p className="text-xs text-stone-600 italic">"{comment}"</p>}
              <p className="text-[11px] text-emerald-700 font-semibold mt-2">{t.feedbackSuccess}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmitFeedback} className="space-y-4">
              <p className="text-xs text-stone-500">
                {t.rateYourExperience}
              </p>

              {/* 5-Star Interactive Selector */}
              <div className="flex items-center justify-center space-x-2 py-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 transition-transform hover:scale-125 focus:outline-none"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= (hoverRating || rating)
                          ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                          : 'text-stone-300'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {/* Comment Textarea */}
              <textarea
                rows={2}
                placeholder={t.feedbackPlaceholder}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition"
              />

              <button
                type="submit"
                disabled={isSubmittingFeedback}
                className="w-full py-3 rounded-xl gold-btn text-black text-xs font-extrabold shadow-sm"
              >
                {isSubmittingFeedback ? t.submitting : t.submitFeedback}
              </button>
            </form>
          )}
        </div>

        {/* Ordered Items Summary */}
        <div className="bg-white border border-stone-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif font-bold text-stone-900 text-base">Order Breakdown</h3>
            <span className="text-sm font-serif font-black text-amber-600">
              {formatNPR(order.totalAmount, lang === 'ne')}
            </span>
          </div>

          <div className="divide-y divide-stone-100">
            {items.map((item, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2.5">
                  <span className="w-5 h-5 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center font-bold text-amber-800 text-[10px]">
                    {item.quantity}x
                  </span>
                  <span className="font-semibold text-stone-900">{item.name}</span>
                </div>
                <span className="font-bold text-stone-700">
                  {formatNPR(item.price * item.quantity, lang === 'ne')}
                </span>
              </div>
            ))}
          </div>

          {order.notes && (
            <div className="mt-4 p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600">
              <span className="font-semibold text-stone-800">Special Instructions: </span>
              {order.notes}
            </div>
          )}
        </div>
      </main>

      {/* Cancel Order Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white border border-stone-200 rounded-3xl p-6 text-center shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-serif font-bold text-stone-900">
                Cancel Table #{order.tableNumber} Order?
              </h3>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                Since the kitchen has not started cooking yet, you can cancel this order. Would you like to proceed?
              </p>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={isCancelling}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-semibold text-stone-700 transition"
              >
                Keep Order
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={isCancelling}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-sm flex items-center justify-center space-x-1"
              >
                {isCancelling ? <span>Cancelling...</span> : <span>Yes, Cancel</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table QR Scanner Modal */}
      <TableQRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        hotelSlug={order?.hotel?.slug}
        expectedTableNumber={order?.tableNumber}
        onScanSuccess={(scannedTbl) => {
          const freshTable = scannedTbl || order?.tableNumber;
          if (order?.hotel?.slug && freshTable) {
            try {
              sessionStorage.removeItem(`table_session_ended_${order.hotel.slug}_${freshTable}`);
              sessionStorage.setItem(`session_time_${order.hotel.slug}_${freshTable}`, new Date().toISOString());
              localStorage.setItem(`last_table_${order.hotel.slug}`, freshTable);
            } catch {}
            router.push(`/menu/${order.hotel.slug}?table=${encodeURIComponent(freshTable)}&qr=1&scan=true&t=${Date.now()}`);
          }
        }}
      />
    </div>
  );
}
