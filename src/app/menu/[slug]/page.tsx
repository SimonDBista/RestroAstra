'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Globe,
  Sparkles,
  Phone,
  MapPin,
  Clock,
  Box,
  Check,
  ChevronRight,
  Utensils,
  Search,
  MessageCircle,
  AlertCircle,
  X,
  Flame,
  ArrowRight,
  ZoomIn,
  Send,
  QrCode,
  ChefHat,
} from 'lucide-react';
import { MenuItemData, HotelData, OrderItem, OrderData } from '@/lib/types';
import { translations, Language } from '@/lib/i18n';
import { formatNPR, getCategoryDetails, formatTime } from '@/lib/utils';
import ThreeDViewerModal from '@/components/ThreeDViewerModal';
import ImageZoomModal from '@/components/ImageZoomModal';
import { playChime, playCustomerMessageChime } from '@/lib/audio';
import { useSocket } from '@/lib/socket';
import TableQRScannerModal from '@/components/TableQRScannerModal';

function isBackForwardNavigation(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const navEntries = window.performance.getEntriesByType('navigation');
    if (navEntries.length > 0) {
      const nav = navEntries[0] as PerformanceNavigationTiming;
      return nav.type === 'back_forward';
    }
    return (window.performance as any)?.navigation?.type === 2;
  } catch {
    return false;
  }
}

export default function CustomerMenuPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-full border-4 border-gold-500/20 border-t-gold-500 animate-spin mb-4" />
          <p className="text-sm font-semibold text-white">Loading Digital Menu...</p>
        </div>
      }
    >
      <CustomerMenuContent />
    </Suspense>
  );
}

function CustomerMenuContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const slug = params?.slug as string;
  const rawInitialTable = searchParams?.get('table') || '';
  const editOrderId = searchParams?.get('editOrder');

  const scanParam = searchParams?.get('scan') === 'true';
  const qrParam = searchParams?.get('qr') === '1';

  // Check if session for this table was settled & ended in storage, or arrived via back navigation
  const isEndedInStorage =
    typeof window !== 'undefined' && rawInitialTable
      ? sessionStorage.getItem(`table_session_ended_${slug}_${rawInitialTable}`) === 'true'
      : false;

  const isBackNav = typeof window !== 'undefined' ? isBackForwardNavigation() : false;

  // If table was settled in storage, or arrived via back navigation when ended
  const isTableEnded = isEndedInStorage || (isBackNav && isEndedInStorage);

  // Fresh scan is ONLY true if explicitly scanned via scanner modal, or fresh camera QR navigation and NOT marked ended
  const isFreshScan = scanParam || (qrParam && !isTableEnded && !isBackNav);

  // Table number MUST be empty if ended, to never restore or show settled table on back navigation
  const initialTable = isTableEnded ? '' : rawInitialTable;

  const [hotel, setHotel] = useState<HotelData | null>(null);
  const [items, setItems] = useState<MenuItemData[]>([]);
  const [mostOrderedItems, setMostOrderedItems] = useState<MenuItemData[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lang, setLang] = useState<Language>('en');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Session end & scan state
  const [isSessionEnded, setIsSessionEnded] = useState(isTableEnded);
  const [sessionEndedMessage, setSessionEndedMessage] = useState<string | null>(
    isTableEnded
      ? `Staff has settled and cleared Table #${rawInitialTable}. This dining session has officially closed. To place a new order, please scan your table QR code again.`
      : null
  );
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [sessionCreatedAt, setSessionCreatedAt] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const now = new Date().toISOString();
      if (isFreshScan && !isTableEnded) {
        try {
          sessionStorage.setItem(`session_time_${slug}_${initialTable}`, now);
        } catch {}
        return now;
      }
      try {
        const saved = sessionStorage.getItem(`session_time_${slug}_${initialTable}`);
        return saved || '';
      } catch {
        return '';
      }
    }
    return '';
  });

  // Map of item id to popularity rank (1 = most ordered, 2 = 2nd, etc.)
  const itemRankMap = React.useMemo(() => {
    const map = new Map<string, number>();
    mostOrderedItems.forEach((item, index) => {
      map.set(item.id, index + 1);
    });
    return map;
  }, [mostOrderedItems]);

  // Cart state
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState(initialTable);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Edit order & active table session states
  const [editingOrder, setEditingOrder] = useState<OrderData | null>(null);
  const [activeTableSession, setActiveTableSession] = useState<{
    hasActiveOrder: boolean;
    count: number;
    latestOrderId?: string;
    activeOrders?: any[];
  } | null>(null);

  // 3D Model Viewer Modal state
  const [threeDItem, setThreeDItem] = useState<{
    isOpen: boolean;
    name: string;
    modelUrl?: string | null;
    imageUrl?: string | null;
  }>({
    isOpen: false,
    name: '',
  });

  // Food Photo Zoom Modal state
  const [zoomItem, setZoomItem] = useState<{
    isOpen: boolean;
    name: string;
    imageUrl: string;
    price?: number;
    category?: string;
    description?: string | null;
    originalItem?: MenuItemData;
  }>({
    isOpen: false,
    name: '',
    imageUrl: '',
  });

  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Live Table Chat state
  const { socket } = useSocket();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [tableMessages, setTableMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [incomingStaffMessage, setIncomingStaffMessage] = useState<{
    id: string;
    message: string;
    createdAt: string | Date;
  } | null>(null);
  const isSendingChatRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const t = translations[lang];

  // Fetch table chat messages when tableNumber is set
  useEffect(() => {
    if (!slug || !tableNumber) return;

    async function loadTableChat() {
      try {
        const res = await fetch(
          `/api/public/chat/table?hotelSlug=${slug}&tableNumber=${encodeURIComponent(tableNumber)}`
        );
        if (res.ok) {
          const data = await res.json();
          setTableMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Failed to load table chat:', err);
      }
    }

    loadTableChat();
  }, [slug, tableNumber]);

  // Join table socket room for real-time messages
  useEffect(() => {
    if (!socket || !hotel?.id || !tableNumber) return;

    socket.emit('join_table', {
      hotelId: hotel.id,
      tableNumber,
    });

    const handleNewMessage = (msg: any) => {
      if (msg.tableNumber === tableNumber) {
        setTableMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });

        if (msg.sender === 'staff') {
          try {
            playCustomerMessageChime();
          } catch {}
          if (!isChatOpen) {
            setUnreadChatCount((prev) => prev + 1);
            setIncomingStaffMessage({
              id: msg.id || String(Date.now()),
              message: msg.message,
              createdAt: msg.createdAt || new Date(),
            });
            setTimeout(() => {
              setIncomingStaffMessage((prev) => (prev?.id === msg.id ? null : prev));
            }, 8000);
          }
        }
      }
    };

    const handleTableSessionEnded = (data: any) => {
      const endedTbl = data?.tableNumber || tableNumber;
      if (!tableNumber || String(data.tableNumber).trim() === String(tableNumber).trim()) {
        setIsSessionEnded(true);
        setSessionEndedMessage(
          `Staff has settled and cleared Table #${endedTbl}. Thank you for dining with us! This dining session has officially closed. To place a new order, please scan the QR code on your table again.`
        );
        setCart([]);
        setIsCartOpen(false);
        setTableNumber('');
        try {
          localStorage.removeItem(`last_order_${slug}`);
          localStorage.removeItem(`last_table_${slug}`);
          sessionStorage.removeItem(`session_time_${slug}_${endedTbl}`);
          sessionStorage.setItem(`table_session_ended_${slug}_${endedTbl}`, 'true');
          localStorage.setItem(`table_settled_at_${slug}_${endedTbl}`, data?.settledAt || new Date().toISOString());
        } catch {}
        // Clean URL so refresh does not restore settled table
        router.replace(`/menu/${slug}`);
        playChime('message');
        setIsQRScannerOpen(true);
      }
    };

    socket.on('chat_message', handleNewMessage);
    socket.on('table_session_ended', handleTableSessionEnded);

    return () => {
      socket.off('chat_message', handleNewMessage);
      socket.off('table_session_ended', handleTableSessionEnded);
    };
  }, [socket, hotel?.id, tableNumber, isChatOpen, slug]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tableMessages, isChatOpen]);

  // Send customer message to table chat
  const handleSendCustomerMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !tableNumber || isSendingChatRef.current) return;

    try {
      isSendingChatRef.current = true;
      setIsSendingChat(true);
      const text = chatInput.trim();
      const res = await fetch('/api/public/chat/table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelSlug: slug,
          tableNumber,
          message: text,
          customerName: customerName || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTableMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        setChatInput('');
      }
    } catch (err) {
      console.error('Error sending chat:', err);
    } finally {
      isSendingChatRef.current = false;
      setIsSendingChat(false);
    }
  };

  useEffect(() => {
    async function fetchMenu() {
      try {
        setLoading(true);
        const res = await fetch(`/api/public/menu/${slug}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error('Hotel menu not found');
          throw new Error('Failed to load menu');
        }
        const data = await res.json();
        setHotel(data.hotel);
        setItems(data.items || []);
        setMostOrderedItems(data.mostOrderedItems || []);
        setCategories(data.categories || []);
      } catch (err: any) {
        setError(err.message || 'Error loading menu');
      } finally {
        setLoading(false);
      }
    }
    if (slug) fetchMenu();
  }, [slug]);

  useEffect(() => {
    if (rawInitialTable && isTableEnded) {
      setTableNumber('');
      setIsSessionEnded(true);
      setSessionEndedMessage(
        `Staff has settled and cleared Table #${rawInitialTable}. This dining session has officially closed. To place a new order, please scan your table QR code again.`
      );
      setCart([]);
      router.replace(`/menu/${slug}`);
    } else if (initialTable) {
      setTableNumber(initialTable);
    }
  }, [initialTable, rawInitialTable, isTableEnded, slug, router]);

  // Handle pageshow event for mobile Safari / Chrome bfcache back navigation
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      const isBackForward = event.persisted || isBackForwardNavigation();
      const currentTbl = searchParams?.get('table') || rawInitialTable || tableNumber;
      if (currentTbl && slug) {
        const endedInStorage = sessionStorage.getItem(`table_session_ended_${slug}_${currentTbl}`) === 'true';
        if (endedInStorage || isBackForward) {
          if (endedInStorage) {
            setTableNumber('');
            setIsSessionEnded(true);
            setSessionEndedMessage(
              `Staff has settled and cleared Table #${currentTbl}. This dining session has officially closed. To place a new order, please scan your table QR code again.`
            );
            setCart([]);
            router.replace(`/menu/${slug}`);
          }
        }
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [slug, searchParams, rawInitialTable, tableNumber, router]);

  // Check if active table orders exist whenever tableNumber changes
  useEffect(() => {
    if (!slug || !tableNumber.trim()) {
      setActiveTableSession(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/public/orders/active?hotelSlug=${encodeURIComponent(
            slug
          )}&tableNumber=${encodeURIComponent(tableNumber.trim())}`
        );
        if (res.ok) {
          const data = await res.json();

          if (data.sessionToken && !isSessionEnded) {
            try {
              sessionStorage.setItem(
                `table_session_token_${slug}_${tableNumber.trim()}`,
                data.sessionToken
              );
            } catch {}
          }

          if (data.hasActiveOrder) {
            // Active orders currently in the kitchen or being served for this table
            setIsSessionEnded(false);
            setActiveTableSession({
              hasActiveOrder: true,
              count: data.count,
              latestOrderId: data.latestOrderId,
              activeOrders: data.activeOrders,
            });
            // Pre-fill customer name & phone from active session if empty
            if (data.activeOrders?.[0]) {
              const prev = data.activeOrders[0];
              if (!customerName && prev.customerName) setCustomerName(prev.customerName);
              if (!customerPhone && prev.customerPhone) setCustomerPhone(prev.customerPhone);
            }
          } else {
            setActiveTableSession(null);
            // No ongoing orders on this table.
            const endedInStorage =
              typeof window !== 'undefined' && tableNumber
                ? sessionStorage.getItem(`table_session_ended_${slug}_${tableNumber}`) === 'true'
                : false;

            if (endedInStorage) {
              setIsSessionEnded(true);
              setSessionEndedMessage(
                `Staff has settled and cleared Table #${tableNumber}. This dining session has officially closed. To place a new order, please scan your table QR code again.`
              );
              setCart([]);
              setTableNumber('');
              router.replace(`/menu/${slug}`);
            } else if (data.lastSettledAt) {
              const settledTime = new Date(data.lastSettledAt).getTime();
              const sessTime = sessionCreatedAt ? new Date(sessionCreatedAt).getTime() : 0;
              if (!isFreshScan && (sessTime === 0 || sessTime <= settledTime)) {
                setIsSessionEnded(true);
                setSessionEndedMessage(
                  `Staff has settled and cleared Table #${tableNumber}. This dining session has officially closed. To place a new order, please scan your table QR code again.`
                );
                setCart([]);
                setTableNumber('');
                router.replace(`/menu/${slug}`);
              } else {
                setIsSessionEnded(false);
              }
            } else {
              setIsSessionEnded(false);
            }
          }
        }
      } catch (err) {
        console.error('Failed to check active orders:', err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [slug, tableNumber, sessionCreatedAt, isFreshScan, isSessionEnded]);

  // If editOrderId is present, fetch and populate existing order to edit
  useEffect(() => {
    if (!editOrderId) return;
    async function loadOrderToEdit() {
      try {
        const res = await fetch(`/api/public/orders/${editOrderId}`);
        if (!res.ok) return;
        const data = await res.json();
        const order = data.order;
        if (!order) return;

        if (order.status !== 'received') {
          alert(
            'This order is already being prepared by the kitchen and cannot be modified. You can add more dishes as a new round!'
          );
          return;
        }

        setEditingOrder(order);
        setTableNumber(order.tableNumber || '');
        if (order.customerName) setCustomerName(order.customerName);
        if (order.customerPhone) setCustomerPhone(order.customerPhone);
        if (order.notes) setOrderNotes(order.notes);

        let parsedItems: OrderItem[] = [];
        try {
          parsedItems =
            typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        } catch {}

        if (parsedItems.length > 0) {
          setCart(parsedItems);
          setIsCartOpen(true);
        }
      } catch (err) {
        console.error('Failed to load order for edit:', err);
      }
    }
    loadOrderToEdit();
  }, [editOrderId]);

  const addToCart = (item: MenuItemData) => {
    if (isSessionEnded || !tableNumber.trim()) {
      setIsQRScannerOpen(true);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          imageUrl: item.imageUrl || undefined,
        },
      ];
    });

    playChime('message');
    showToast(`${item.name} ${t.addedToCart}!`);
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((i) => {
          if (i.id === itemId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as OrderItem[];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartItemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSessionEnded || !tableNumber.trim()) {
      setIsQRScannerOpen(true);
      return;
    }
    if (cart.length === 0) {
      alert('Your cart is empty');
      return;
    }

    try {
      setIsSubmitting(true);

      if (editingOrder) {
        // Update existing order before cooking starts
        const res = await fetch(`/api/public/orders/${editingOrder.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart,
            notes: orderNotes.trim() || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to update order');
        }

        playChime('success');
        showToast('Order updated successfully!');
        router.push(`/order/${editingOrder.id}`);
        return;
      }

      const storedSessionToken =
        typeof window !== 'undefined'
          ? sessionStorage.getItem(`table_session_token_${slug}_${tableNumber.trim()}`)
          : undefined;

      // Normal order or Round 2+ for this table
      const res = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelId: hotel?.id,
          tableNumber: tableNumber.trim(),
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          items: cart,
          notes: orderNotes.trim() || undefined,
          sessionCreatedAt,
          sessionToken: storedSessionToken || undefined,
          isFreshScan,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.sessionEnded) {
          setIsSessionEnded(true);
          setSessionEndedMessage(data.error);
          setCart([]);
          setIsCartOpen(false);
          setIsQRScannerOpen(true);
        }
        throw new Error(data.error || 'Failed to place order');
      }

      // Save to localStorage for quick restore
      try {
        localStorage.setItem(`last_order_${slug}`, data.order.id);
        localStorage.setItem(`last_table_${slug}`, tableNumber.trim());
      } catch {}

      playChime('success');
      router.push(`/order/${data.order.id}`);
    } catch (err: any) {
      alert(err.message || 'Could not place order. Please try again.');
      setIsSubmitting(false);
    }
  };

  const filteredItems = React.useMemo(() => {
    let list = items;
    if (activeCategory === 'most_ordered') {
      list = [...mostOrderedItems];
    } else if (activeCategory !== 'all') {
      list = items.filter((item) => item.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [items, mostOrderedItems, activeCategory, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-full border-4 border-gold-500/20 border-t-gold-500 animate-spin mb-4 shadow-gold-glow" />
        <h2 className="font-serif text-xl font-bold text-white mb-1">
          Loading RestroAstra Menu...
        </h2>
        <p className="text-xs text-gold-400 font-semibold tracking-widest uppercase">RestroAstra</p>
      </div>
    );
  }

  if (error || !hotel) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-4 shadow-xl">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-white mb-2">Menu Unavailable</h2>
        <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
          {error || 'The requested hotel menu could not be found or is currently offline.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 gold-btn rounded-xl text-xs font-bold shadow-gold-glow"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-32 selection:bg-amber-500 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-white/95 border border-amber-400 text-amber-900 text-xs font-bold rounded-full shadow-lg backdrop-blur-xl flex items-center space-x-2 animate-slide-up">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Floating Incoming Staff Message Notification Toast */}
      {incomingStaffMessage && !isChatOpen && (
        <div className="fixed top-5 left-4 right-4 max-w-md mx-auto z-50 animate-slide-up">
          <div className="bg-white/95 border-2 border-amber-400 rounded-3xl p-4 shadow-2xl backdrop-blur-xl flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 border border-amber-300 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 animate-bounce" />
                </div>
                <div>
                  <span className="text-xs font-serif font-bold text-stone-900 block">
                    {lang === 'en' ? 'Staff Desk • Reception Reply' : 'होटल कर्मचारीको सन्देश'}
                  </span>
                  <span className="text-[10px] text-amber-700 font-semibold">
                    {formatTime(incomingStaffMessage.createdAt)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIncomingStaffMessage(null)}
                className="text-stone-400 hover:text-stone-800 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-800 bg-stone-50 rounded-xl p-2.5 border border-stone-200 line-clamp-2 leading-relaxed font-medium">
              &ldquo;{incomingStaffMessage.message}&rdquo;
            </p>

            <div className="flex items-center justify-end space-x-2 pt-0.5">
              <button
                onClick={() => setIncomingStaffMessage(null)}
                className="px-3 py-1.5 rounded-xl dark-btn text-xs font-semibold text-stone-600 hover:text-stone-900"
              >
                {lang === 'en' ? 'Dismiss' : 'हटाउनुहोस्'}
              </button>
              <button
                onClick={() => {
                  setIncomingStaffMessage(null);
                  setIsChatOpen(true);
                }}
                className="px-4 py-1.5 rounded-xl bronze-btn text-xs font-bold text-white flex items-center space-x-1 shadow-sm"
              >
                <span>{lang === 'en' ? 'Open Chat' : 'च्याट खोल्नुहोस्'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Language Switcher */}
      <div className="fixed top-4 right-4 z-40">
        <button
          onClick={() => setLang(lang === 'en' ? 'ne' : 'en')}
          className="px-3.5 py-1.5 rounded-full bg-white/95 border border-stone-200 text-xs font-bold text-amber-700 shadow-md backdrop-blur-xl flex items-center space-x-1.5 hover:border-amber-400 transition"
        >
          <Globe className="w-3.5 h-3.5 text-amber-600" />
          <span>{lang === 'en' ? 'नेपाली' : 'English'}</span>
        </button>
      </div>

      {/* Hero Header Banner (Luxury Five-Star Styling) */}
      <header className="relative w-full bg-gradient-to-b from-amber-500/10 via-stone-50 to-[#FAFAF7] border-b border-stone-200 px-4 pt-12 pb-10 text-center overflow-hidden">
        {/* Subtle decorative crest watermark */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-xl mx-auto">
          {/* Welcome Tag */}
          <div className="inline-flex items-center space-x-2 text-[10px] uppercase tracking-[0.35em] text-amber-700 font-serif font-bold mb-2">
            <span>✦</span>
            <span>{t.welcome}</span>
            <span>✦</span>
          </div>

          {/* Hotel Name */}
          <h1 className="text-3xl sm:text-4xl font-serif font-extrabold text-stone-900 uppercase tracking-wide leading-tight drop-shadow-xs">
            {hotel.name}
          </h1>

          {/* Gold Decorative Ribbon Divider */}
          <div className="flex items-center justify-center space-x-3 my-3.5">
            <div className="h-[1px] w-14 bg-gradient-to-r from-transparent via-amber-500/60 to-amber-500" />
            <div className="px-3.5 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-[10px] font-serif uppercase tracking-[0.25em] text-amber-800 font-bold">
              FINE DINING & SEKUWA
            </div>
            <div className="h-[1px] w-14 bg-gradient-to-l from-transparent via-amber-500/60 to-amber-500" />
          </div>

          {/* Active Table Indicator (Verified or Scan Prompt) */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white border border-stone-200 shadow-xs mb-4">
            <span
              className={`w-2 h-2 rounded-full ${
                tableNumber && !isSessionEnded ? 'bg-emerald-500' : 'bg-amber-500'
              } animate-pulse`}
            />
            <div className="text-xs font-bold text-stone-800 flex items-center space-x-1.5">
              <span>{t.table}:</span>
              {tableNumber && !isSessionEnded ? (
                <span className="text-amber-800 font-extrabold flex items-center space-x-1.5">
                  <span>
                    {tableNumber.toLowerCase().startsWith('room')
                      ? `Rooms #${tableNumber.replace(/^room\s*#?/i, '')}`
                      : `#${tableNumber.replace(/^#/, '')}`}
                  </span>
                  <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 rounded font-mono font-bold">
                    Verified QR
                  </span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsQRScannerOpen(true)}
                  className="text-xs font-bold text-amber-700 hover:text-amber-800 underline flex items-center space-x-1"
                >
                  <span>Not Scanned</span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold ml-0.5">
                    Scan QR
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Address & Phone Details */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-slate-400">
            {hotel.address && (
              <div className="flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-gold-400" />
                <span>{hotel.address}</span>
              </div>
            )}
            {hotel.phone && (
              <div className="flex items-center space-x-1.5">
                <Phone className="w-3.5 h-3.5 text-gold-400" />
                <a href={`tel:${hotel.phone}`} className="hover:text-gold-300 transition">
                  {hotel.phone}
                </a>
              </div>
            )}
            <div className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-gold-400" />
              <span>Open Everyday</span>
            </div>
          </div>
        </div>
      </header>

      {/* Edit Order Banner */}
      {editingOrder && (
        <div className="max-w-4xl mx-auto px-4 mt-5">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-fade-in">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-300 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-stone-900 flex items-center space-x-2">
                  <span>Editing Order #{editingOrder.id.slice(-6).toUpperCase()}</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-mono border border-amber-300">
                    Table #{editingOrder.tableNumber}
                  </span>
                </h4>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Add, remove, or adjust dishes. When ready, open your cart and tap Save Changes.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 self-end sm:self-auto">
              <button
                onClick={() => setIsCartOpen(true)}
                className="px-3.5 py-1.5 rounded-xl gold-btn text-xs font-bold shadow-sm transition"
              >
                Review Cart ({cartItemCount})
              </button>
              <button
                onClick={() => {
                  setEditingOrder(null);
                  setCart([]);
                  router.push(`/menu/${slug}?table=${tableNumber}`);
                }}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-stone-100 text-stone-700 text-xs font-semibold border border-stone-200 transition shadow-sm"
              >
                Cancel Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Session Ended Banner */}
      {isSessionEnded && (
        <div className="max-w-4xl mx-auto px-4 mt-5">
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-red-950/40 via-dark-900 to-amber-950/40 border-2 border-amber-500/40 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0 shadow-gold-glow">
                <QrCode className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="font-serif font-bold text-base text-white">
                    Table #{tableNumber || initialTable || rawInitialTable || 'Dining'} Session Ended
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Bill Settled
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-lg leading-relaxed">
                  {sessionEndedMessage ||
                    `Staff has settled and cleared Table #${tableNumber || initialTable || rawInitialTable}. This dining session has officially closed. To place a new order, please scan your table QR code again.`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsQRScannerOpen(true)}
              className="px-6 py-3 rounded-2xl gold-btn text-black text-xs font-black flex items-center justify-center space-x-2 shadow-gold-glow shrink-0 hover:scale-105 transition"
            >
              <QrCode className="w-4 h-4" />
              <span>Scan Table QR Code</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Table Session Banner (Continuity for same table) */}
      {!editingOrder && !isSessionEnded && activeTableSession?.hasActiveOrder && (
        <div className="max-w-4xl mx-auto px-4 mt-5">
          <div className="p-4 rounded-2xl bg-white border border-amber-400/60 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center border border-emerald-500/30 shrink-0">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-stone-900 font-serif flex items-center space-x-2">
                  <span>Table #{tableNumber} has an active dining session</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 text-[10px] font-bold border border-amber-500/30">
                    {activeTableSession.count} {activeTableSession.count === 1 ? 'Order' : 'Rounds'} Active
                  </span>
                </h4>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Track kitchen status, chat with receptionist, or add more dishes to this table.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 self-end sm:self-auto">
              {activeTableSession.latestOrderId && (
                <Link
                  href={`/order/${activeTableSession.latestOrderId}`}
                  className="px-4 py-2 rounded-xl gold-btn text-black text-xs font-bold flex items-center space-x-1.5 shadow-md hover:scale-105 transition"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>View Order & Chat</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 mt-6">
        {/* Search Input */}
        <div className="relative mb-5">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder={
              lang === 'en'
                ? 'Search dishes, drinks, sekuwa, momos...'
                : 'परिकारहरू, पेय पदार्थ खोज्नुहोस्...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-10 py-3 bg-white border border-stone-200 rounded-2xl text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 shadow-sm transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Most Ordered & Guest Favorites Spotlight Section */}
        {activeCategory === 'all' && !searchQuery.trim() && mostOrderedItems.length > 0 && (
          <section className="mb-8 animate-fade-in">
            {/* Section Header */}
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-sm">
                  <Flame className="w-4 h-4 animate-pulse text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-serif font-bold text-stone-900 text-sm sm:text-base tracking-wide flex items-center gap-1.5">
                      <span>{t.guestFavorites}</span>
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/15 text-amber-800 border border-amber-500/30 uppercase tracking-wider">
                      Hot
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5 font-light">
                    {t.guestFavoritesDesc}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveCategory('most_ordered')}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center space-x-1 transition px-2.5 py-1 rounded-lg hover:bg-amber-50"
              >
                <span>{t.all} ({mostOrderedItems.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Horizontal Scroll Cards (Compact Size) */}
            <div className="flex items-stretch space-x-3.5 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x snap-mandatory">
              {mostOrderedItems.slice(0, 6).map((item, idx) => {
                const inCartItem = cart.find((i) => i.id === item.id);
                const rank = idx + 1;
                return (
                  <div
                    key={`spotlight-${item.id}`}
                    className="snap-start shrink-0 w-[180px] sm:w-[200px] bg-white border border-stone-200 hover:border-amber-400 rounded-2xl overflow-hidden shadow-sm hover:shadow-md flex flex-col justify-between group transition-all duration-300"
                  >
                    {/* Photo with badges */}
                    <div
                      onClick={() => {
                        if (item.imageUrl && !failedImages[item.id]) {
                          setZoomItem({
                            isOpen: true,
                            name: item.name,
                            imageUrl: item.imageUrl,
                            price: item.price,
                            category: item.category,
                            description: item.description,
                            originalItem: item,
                          });
                        }
                      }}
                      className={`relative w-full h-28 sm:h-30 bg-stone-100 overflow-hidden ${
                        item.imageUrl && !failedImages[item.id] ? 'cursor-zoom-in group/photo' : ''
                      }`}
                    >
                      {item.imageUrl && !failedImages[item.id] ? (
                        <>
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                            loading="lazy"
                            onError={() => {
                              setFailedImages((prev) => ({ ...prev, [item.id]: true }));
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-70" />
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 bg-stone-100">
                          <Utensils className="w-7 h-7 mb-1 opacity-40" />
                          <span className="text-[9px]">Freshly Prepared</span>
                        </div>
                      )}

                      {/* Rank Badge */}
                      <div className="absolute top-2 left-2 z-10">
                        {rank === 1 ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-black border border-yellow-200 shadow-md flex items-center space-x-1">
                            <Flame className="w-2.5 h-2.5 text-red-600 fill-red-600 animate-pulse" />
                            <span>#1 {t.bestseller}</span>
                          </span>
                        ) : rank === 2 ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-slate-200 to-slate-400 text-slate-950 border border-white shadow-md flex items-center space-x-1">
                            <span>🥈 #2</span>
                          </span>
                        ) : rank === 3 ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-amber-700 to-orange-700 text-amber-100 border border-amber-500/50 shadow-md flex items-center space-x-1">
                            <span>🥉 #3</span>
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-white/90 text-amber-800 border border-amber-300 shadow-sm flex items-center space-x-1">
                            <Flame className="w-2 h-2 text-amber-600" />
                            <span>#{rank}</span>
                          </span>
                        )}
                      </div>

                      {/* 3D button if enabled */}
                      {item.is3dEnabled && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setThreeDItem({
                              isOpen: true,
                              name: item.name,
                              modelUrl: item.modelUrl,
                              imageUrl: item.imageUrl,
                            });
                          }}
                          className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-amber-500/90 hover:bg-amber-500 text-black text-[8px] font-bold shadow-sm backdrop-blur flex items-center space-x-0.5 transition z-10"
                        >
                          <Box className="w-2 h-2" />
                          <span>3D</span>
                        </button>
                      )}

                      {/* Social proof order count */}
                      {item.totalOrdered && item.totalOrdered > 0 && (
                        <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded-md bg-white/90 backdrop-blur-md border border-stone-200 text-[8px] font-bold text-amber-800 flex items-center space-x-1 shadow-sm">
                          <Flame className="w-2 h-2 text-amber-600" />
                          <span>{item.totalOrdered} ordered</span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-3 flex flex-col justify-between flex-1">
                      <div>
                        <h4 className="font-serif font-bold text-stone-900 text-xs sm:text-sm line-clamp-1 group-hover:text-amber-700 transition-colors">
                          {item.name}
                        </h4>
                        {item.description && (
                          <p className="text-[10px] text-stone-500 mt-0.5 line-clamp-1 leading-normal">
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between">
                        <span className="text-sm sm:text-base font-serif font-black text-amber-600">
                          {formatNPR(item.price, lang === 'ne')}
                        </span>

                        {item.isAvailable ? (
                          inCartItem ? (
                            <div className="flex items-center space-x-1 bg-stone-50 border border-amber-300 rounded-lg p-0.5 shadow-sm">
                              <button
                                onClick={() => updateQuantity(item.id, -1)}
                                className="w-5 h-5 rounded-md bg-stone-200 text-stone-700 flex items-center justify-center hover:bg-amber-500 hover:text-white transition"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className="text-[11px] font-bold text-stone-900 px-1">
                                {inCartItem.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.id, 1)}
                                className="w-5 h-5 rounded-md bg-amber-500 text-black flex items-center justify-center hover:bg-amber-400 transition"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart(item)}
                              className="px-2.5 py-1 rounded-lg gold-btn text-[10px] font-bold flex items-center space-x-1 shadow-sm"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              <span>{t.orderNow}</span>
                            </button>
                          )
                        ) : (
                          <span className="text-[9px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                            {t.outOfStock}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Category Filter Pills (Horizontal Scroll) */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-3 scrollbar-none mb-6">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-1.5 ${
              activeCategory === 'all'
                ? 'gold-btn text-black shadow-gold-glow'
                : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 hover:border-amber-400 shadow-sm'
            }`}
          >
            <span>🍽️</span>
            <span>{t.all}</span>
            <span className="opacity-70 text-[10px]">({items.length})</span>
          </button>

          {/* Quick Filter: Most Ordered / Bestseller */}
          {mostOrderedItems.length > 0 && (
            <button
              onClick={() =>
                setActiveCategory(activeCategory === 'most_ordered' ? 'all' : 'most_ordered')
              }
              className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center space-x-1.5 shadow-sm ${
                activeCategory === 'most_ordered'
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-orange-500/30 border border-amber-300 ring-2 ring-amber-400/40'
                  : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 shadow-sm'
              }`}
            >
              <Flame
                className={`w-3.5 h-3.5 ${
                  activeCategory === 'most_ordered'
                    ? 'animate-bounce text-yellow-200'
                    : 'text-amber-500'
                }`}
              />
              <span>{t.mostOrdered}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeCategory === 'most_ordered'
                    ? 'bg-black/40 text-yellow-200'
                    : 'bg-amber-500/15 text-amber-800'
                }`}
              >
                {mostOrderedItems.length}
              </span>
            </button>
          )}

          {categories.map((cat) => {
            const info = getCategoryDetails(cat, lang);
            const count = items.filter(
              (i) => i.category.toUpperCase() === cat.toUpperCase()
            ).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-1.5 ${
                  activeCategory === cat
                    ? 'gold-btn text-black shadow-gold-glow'
                    : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 hover:border-amber-400 shadow-sm'
                }`}
              >
                <span>{info.icon}</span>
                <span>{info.label}</span>
                {count > 0 && (
                  <span className="opacity-70 text-[10px]">({count})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Most Ordered Active Banner */}
        {activeCategory === 'most_ordered' && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-center justify-between gap-3 text-xs shadow-sm animate-fade-in">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center border border-amber-500/30 shrink-0">
                <Flame className="w-5 h-5 animate-pulse text-amber-600" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-serif font-black text-stone-900 text-sm">
                    {t.guestFavorites}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-800 border border-amber-500/30">
                    {filteredItems.length} {t.ordersCount}
                  </span>
                </div>
                <p className="text-stone-600 text-[11px] mt-0.5">
                  {t.guestFavoritesDesc}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveCategory('all')}
              className="text-[11px] font-bold text-amber-800 hover:text-amber-900 px-3 py-1.5 rounded-xl bg-white border border-amber-200 shadow-sm whitespace-nowrap transition"
            >
              {t.all}
            </button>
          </div>
        )}

        {/* Menu Cards Bento Grid */}
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center bg-white border border-stone-200 rounded-3xl shadow-sm">
            <div className="text-4xl mb-3">
              {activeCategory === 'most_ordered'
                ? '🔥'
                : activeCategory !== 'all'
                ? getCategoryDetails(activeCategory, lang).icon
                : '🍽️'}
            </div>
            <p className="text-sm font-bold text-stone-800">
              {activeCategory === 'most_ordered'
                ? t.mostOrdered
                : activeCategory !== 'all'
                ? `No dishes in ${getCategoryDetails(activeCategory, lang).label} right now`
                : 'No dishes found'}
            </p>
            <p className="text-xs text-stone-500 mt-1 mb-4">
              Explore our other delicious freshly-prepared items!
            </p>
            <button
              onClick={() => {
                setActiveCategory('all');
                setSearchQuery('');
              }}
              className="px-5 py-2 rounded-xl gold-btn text-xs font-bold shadow-sm"
            >
              Browse All Items ({items.length})
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4.5">
            {filteredItems.map((item) => {
              const inCartItem = cart.find((i) => i.id === item.id);
              return (
                <div
                  key={item.id}
                  className="group relative bg-white border border-stone-200 hover:border-amber-400 rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                >
                  {/* Photo Container - Click to Zoom & Look Around */}
                  <div
                    onClick={() => {
                      if (item.imageUrl && !failedImages[item.id]) {
                        setZoomItem({
                          isOpen: true,
                          name: item.name,
                          imageUrl: item.imageUrl,
                          price: item.price,
                          category: item.category,
                          description: item.description,
                          originalItem: item,
                        });
                      }
                    }}
                    className={`relative w-full h-28 sm:h-36 md:h-40 bg-stone-100 overflow-hidden ${
                      item.imageUrl && !failedImages[item.id] ? 'cursor-zoom-in group/photo' : ''
                    }`}
                    title={
                      item.imageUrl && !failedImages[item.id]
                        ? 'Tap or click to zoom and move around the food picture'
                        : undefined
                    }
                  >
                    {item.imageUrl && !failedImages[item.id] ? (
                      <>
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                          loading="lazy"
                          onError={() => {
                            setFailedImages((prev) => ({ ...prev, [item.id]: true }));
                          }}
                        />
                        {/* Hover / Tap Zoom badge */}
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-md border border-stone-200 text-stone-800 text-[9px] font-bold opacity-80 sm:opacity-0 sm:group-hover/photo:opacity-100 transition-opacity flex items-center space-x-1 shadow-sm pointer-events-none">
                          <ZoomIn className="w-2.5 h-2.5 text-amber-600" />
                          <span>Zoom</span>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 bg-stone-100">
                        <Utensils className="w-8 h-8 mb-1 opacity-40" />
                        <span className="text-[9px]">Freshly Prepared</span>
                      </div>
                    )}

                    {/* Gradient shade */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-70" />

                    {/* Category Glass Tag */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-md border border-stone-200 text-[9px] font-bold text-amber-800 flex items-center space-x-1 z-10 shadow-sm">
                      <span>{getCategoryDetails(item.category, lang).icon}</span>
                      <span className="hidden xs:inline">{getCategoryDetails(item.category, lang).label}</span>
                    </div>

                    {/* Top Right Badges: Rank Badge & 3D Food Preview */}
                    <div className="absolute top-2 right-2 flex flex-col items-end gap-1 z-10">
                      {(() => {
                        const rank = itemRankMap.get(item.id);
                        if (rank === 1) {
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-black border border-yellow-200 shadow-md flex items-center space-x-0.5">
                              <Flame className="w-2.5 h-2.5 text-red-600 fill-red-600 animate-pulse" />
                              <span>#1</span>
                            </span>
                          );
                        }
                        if (rank === 2) {
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-slate-200 to-slate-400 text-slate-950 border border-white shadow-md flex items-center space-x-0.5">
                              <span>🥈 #2</span>
                            </span>
                          );
                        }
                        if (rank === 3) {
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-amber-700 to-orange-700 text-amber-100 border border-amber-500/50 shadow-md flex items-center space-x-0.5">
                              <span>🥉 #3</span>
                            </span>
                          );
                        }
                        if (rank && rank <= 5) {
                          return (
                            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-white/90 text-amber-800 border border-amber-300 shadow-sm flex items-center space-x-0.5">
                              <Flame className="w-2 h-2 text-amber-600" />
                              <span>#{rank}</span>
                            </span>
                          );
                        }
                        return null;
                      })()}

                      {item.is3dEnabled && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setThreeDItem({
                              isOpen: true,
                              name: item.name,
                              modelUrl: item.modelUrl,
                              imageUrl: item.imageUrl,
                            });
                          }}
                          className="px-2 py-0.5 rounded-full bg-amber-500/90 hover:bg-amber-500 text-black text-[8px] font-bold shadow-sm backdrop-blur flex items-center space-x-0.5 transition"
                        >
                          <Box className="w-2.5 h-2.5" />
                          <span>3D</span>
                        </button>
                      )}
                    </div>

                    {/* Social proof order tag if ordered */}
                    {item.totalOrdered && item.totalOrdered > 0 && (
                      <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-white/90 backdrop-blur-md border border-stone-200 text-[8px] font-bold text-amber-800 flex items-center space-x-0.5 pointer-events-none z-10 shadow-sm">
                        <Flame className="w-2 h-2 text-amber-600" />
                        <span>{item.totalOrdered} ordered</span>
                      </div>
                    )}
                  </div>

                  {/* Card Content Body */}
                  <div className="p-3 sm:p-3.5 flex flex-col flex-1 justify-between">
                    <div>
                      <h3 className="font-serif font-bold text-stone-900 text-xs sm:text-sm md:text-base leading-snug line-clamp-1 group-hover:text-amber-700 transition-colors">
                        {item.name}
                      </h3>

                      {item.description && (
                        <p className="text-[10px] sm:text-[11px] text-stone-500 mt-1 line-clamp-1 sm:line-clamp-2 leading-relaxed font-normal">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Price & Add to Cart Row */}
                    <div className="mt-2.5 sm:mt-3 pt-2 border-t border-stone-100 flex items-center justify-between gap-1">
                      <div>
                        <span className="text-[8px] uppercase font-bold text-stone-400 tracking-wider block">
                          Price
                        </span>
                        <span className="text-xs sm:text-sm md:text-base font-serif font-black text-amber-600">
                          {formatNPR(item.price, lang === 'ne')}
                        </span>
                      </div>

                      {/* Quantity Controls or Order Now Button */}
                      {item.isAvailable ? (
                        inCartItem ? (
                          <div className="flex items-center space-x-1 bg-stone-50 border border-amber-300 rounded-lg p-0.5 shadow-sm">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-stone-200 text-stone-700 flex items-center justify-center hover:bg-amber-500 hover:text-white transition"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <span className="text-[11px] sm:text-xs font-bold text-stone-900 px-1">
                              {inCartItem.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-amber-500 text-black flex items-center justify-center hover:bg-amber-400 transition"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(item)}
                            className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl gold-btn text-[10px] sm:text-xs font-bold flex items-center space-x-1 shadow-sm"
                          >
                            <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            <span>{t.orderNow}</span>
                          </button>
                        )
                      ) : (
                        <span className="text-[9px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                          {t.outOfStock}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && !isSessionEnded && (
        <div className="fixed bottom-5 left-4 right-4 max-w-md mx-auto z-40 animate-slide-up">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full p-4 rounded-2xl gold-btn text-black flex items-center justify-between shadow-gold-glow border-t border-white/20"
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center backdrop-blur">
                <ShoppingBag className="w-5 h-5 text-black" />
              </div>
              <div className="text-left">
                <div className="text-[11px] uppercase tracking-wider font-semibold opacity-90">
                  {cartItemCount} {cartItemCount === 1 ? 'dish' : 'dishes'} in order
                </div>
                <div className="text-base font-serif font-black text-black">
                  {formatNPR(cartTotal, lang === 'ne')}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1 text-xs font-bold bg-black text-gold-400 px-4 py-2 rounded-xl shadow-md">
              <span>{t.viewCart}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Floating Bottom Live Order Status Bar (When diner has active table orders and cart is empty) */}
      {cart.length === 0 && !isSessionEnded && activeTableSession?.hasActiveOrder && activeTableSession.latestOrderId && (
        <div className="fixed bottom-5 left-4 right-4 max-w-md mx-auto z-40 animate-slide-up">
          <Link
            href={`/order/${activeTableSession.latestOrderId}`}
            className="w-full p-3.5 sm:p-4 rounded-2xl bg-white/95 border border-amber-400 text-stone-900 flex items-center justify-between shadow-xl backdrop-blur-xl group hover:border-amber-500 transition"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center border border-amber-500/30 relative">
                <ChefHat className="w-5 h-5 animate-pulse" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute -top-0.5 -right-0.5 border-2 border-white" />
              </div>
              <div className="text-left">
                <div className="text-[10px] uppercase font-bold text-amber-700 tracking-wider">
                  Table #{tableNumber} • {activeTableSession.count} {activeTableSession.count === 1 ? 'Order' : 'Rounds'} Active
                </div>
                <div className="text-xs sm:text-sm font-serif font-bold text-stone-900 flex items-center space-x-1.5">
                  <span>Tracking Live Kitchen Status</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1 text-xs font-bold gold-btn text-black px-3.5 py-2 rounded-xl shadow-md group-hover:scale-105 transition">
              <span>View Order</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>
      )}

      {/* Cart Slide-Over Modal / Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg max-h-[92vh] bg-white border border-stone-200 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-700 flex items-center justify-center border border-amber-500/30">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <h2 className="font-serif font-extrabold text-stone-900 text-lg">
                  {t.cart}
                </h2>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3 bg-white">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl flex items-center justify-between gap-3 shadow-sm"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-xs sm:text-sm text-stone-900 truncate">
                      {item.name}
                    </h4>
                    <p className="text-xs text-amber-600 font-serif font-bold mt-0.5">
                      {formatNPR(item.price * item.quantity, lang === 'ne')}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1.5 bg-white border border-stone-200 rounded-xl p-1">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-6 h-6 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center hover:bg-amber-500 hover:text-white transition"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold text-stone-900 px-1.5">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-6 h-6 rounded-lg bg-amber-500 text-black flex items-center justify-center hover:bg-amber-400 transition"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="p-1.5 text-stone-400 hover:text-red-500 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Order Form Inputs */}
              <form onSubmit={handlePlaceOrder} className="pt-4 space-y-3.5">
                {editingOrder ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                    <span className="font-bold">
                      ✏️ Editing Order #{editingOrder.id.slice(-6).toUpperCase()}
                    </span>
                    <span className="text-[10px] bg-amber-100 px-2 py-0.5 rounded text-amber-900 font-mono">
                      Table #{editingOrder.tableNumber}
                    </span>
                  </div>
                ) : activeTableSession?.hasActiveOrder ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                    <span className="font-bold">
                      ➕ Adding Round #{activeTableSession.count + 1}
                    </span>
                    <span className="text-[10px] bg-amber-100 px-2 py-0.5 rounded text-amber-900 font-mono">
                      Table #{tableNumber}
                    </span>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-stone-700">
                        {t.tableNumber} <span className="text-amber-600 font-bold">*</span>
                      </label>
                      {tableNumber && !isSessionEnded && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center space-x-1">
                          <Check className="w-2.5 h-2.5" />
                          <span>Verified Table QR</span>
                        </span>
                      )}
                    </div>
                    {tableNumber && !isSessionEnded ? (
                      <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-emerald-400 bg-emerald-50/50 text-emerald-800 text-xs font-bold">
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>
                            {tableNumber.toLowerCase().startsWith('room')
                              ? `Rooms #${tableNumber.replace(/^room\s*#?/i, '')}`
                              : `Table #${tableNumber.replace(/^#/, '')}`}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsQRScannerOpen(true)}
                          className="text-[11px] text-amber-600 hover:text-amber-700 underline font-semibold ml-2"
                        >
                          Change Table
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsQRScannerOpen(true)}
                        className="w-full px-3.5 py-2.5 rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center space-x-2 transition"
                      >
                        <QrCode className="w-4 h-4 text-amber-600 animate-pulse" />
                        <span>Scan Table QR Code (Required)</span>
                      </button>
                    )}
                    {tableNumber && !isSessionEnded ? (
                      <span className="text-[10px] text-emerald-600 mt-1 block">
                        Locked to Table #{tableNumber} from your scanned table stand.
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-700 mt-1 block">
                        Orders must be placed from a verified table stand.
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {t.yourName}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Aarav"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {t.specialInstructions}
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Extra spicy timur, less salt, please serve drinks first..."
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition"
                  />
                </div>
              </form>
            </div>

            {/* Footer Total & Place Order */}
            <div className="p-6 bg-stone-50 border-t border-stone-200">
              <div className="flex items-center justify-between text-base font-extrabold text-stone-900 mb-4">
                <span>{t.total}:</span>
                <span className="text-amber-600 font-serif text-xl">
                  {formatNPR(cartTotal, lang === 'ne')}
                </span>
              </div>

              {isSessionEnded || !tableNumber.trim() ? (
                <button
                  type="button"
                  onClick={() => setIsQRScannerOpen(true)}
                  className="w-full py-3.5 rounded-2xl gold-btn text-xs sm:text-sm font-extrabold flex items-center justify-center space-x-2 shadow-gold-glow text-black hover:scale-[1.01] transition"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Scan Table QR Code to Place Order</span>
                </button>
              ) : (
                <button
                  onClick={handlePlaceOrder}
                  disabled={isSubmitting || cart.length === 0}
                  className="w-full py-3.5 rounded-2xl gold-btn text-xs sm:text-sm font-extrabold flex items-center justify-center space-x-2 disabled:opacity-50 shadow-gold-glow text-black"
                >
                  {isSubmitting ? (
                    <span>{editingOrder ? 'Updating Order...' : t.placingOrder}</span>
                  ) : editingOrder ? (
                    <>
                      <span>Save Order Changes</span>
                      <Check className="w-4 h-4" />
                    </>
                  ) : activeTableSession?.hasActiveOrder ? (
                    <>
                      <span>Submit Additional Order (Round {activeTableSession.count + 1})</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>{t.placeOrder}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3D Food Model Viewer Modal */}
      <ThreeDViewerModal
        isOpen={threeDItem.isOpen}
        onClose={() => setThreeDItem({ isOpen: false, name: '' })}
        itemName={threeDItem.name}
        modelUrl={threeDItem.modelUrl}
        imageUrl={threeDItem.imageUrl}
      />

      {/* Interactive Food Photo Zoom & Look Around Modal */}
      <ImageZoomModal
        isOpen={zoomItem.isOpen}
        onClose={() => setZoomItem((prev) => ({ ...prev, isOpen: false }))}
        imageUrl={zoomItem.imageUrl}
        itemName={zoomItem.name}
        price={zoomItem.price}
        category={zoomItem.category}
        description={zoomItem.description}
        onAddToCart={
          zoomItem.originalItem
            ? () => addToCart(zoomItem.originalItem!)
            : undefined
        }
      />

      {/* Floating Receptionist & Staff Live Chat Button */}
      {tableNumber && (
        <div className={`fixed z-40 ${cart.length > 0 ? 'bottom-24 right-4' : 'bottom-6 right-4'}`}>
          <button
            onClick={() => {
              setIsChatOpen(true);
              setUnreadChatCount(0);
            }}
            className="group px-4 py-2.5 rounded-full bg-white/95 border border-amber-400/70 shadow-xl backdrop-blur-xl flex items-center space-x-2.5 hover:border-amber-500 hover:scale-105 transition-all text-xs font-bold text-stone-900 relative"
          >
            <div className="relative">
              <MessageCircle className="w-4 h-4 text-amber-600" />
              {unreadChatCount > 0 && (
                <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center animate-bounce">
                  {unreadChatCount}
                </span>
              )}
            </div>
            <span className="hidden sm:inline">Staff Desk</span>
            <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-[10px] text-amber-800 font-mono border border-amber-200">
              #{tableNumber}
            </span>
          </button>
        </div>
      )}

      {/* Table Live Chat Slide-Over Drawer */}
      {isChatOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-0 sm:p-4">
          <div className="relative w-full max-w-lg h-[80vh] sm:h-[650px] bg-white border border-stone-200 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="p-4 px-5 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-sm text-stone-900 flex items-center space-x-2">
                    <span>Receptionist & Staff Desk</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </h3>
                  <span className="text-[10px] text-stone-500">
                    Live Chat connected to Table #{tableNumber}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages Scroll Body */}
            <div className="flex-1 p-5 overflow-y-auto space-y-3 bg-stone-50">
              {tableMessages.length === 0 ? (
                <div className="py-16 text-center max-w-xs mx-auto">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/25 text-amber-700 flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-stone-900 mb-1">
                    Direct Line to Hotel Staff
                  </h4>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Have a question about a dish, need napkins, or want water? Send a message directly from Table #{tableNumber} and staff will respond promptly!
                  </p>
                </div>
              ) : (
                tableMessages.map((m) => {
                  const isCustomer = m.sender === 'customer';
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl p-3 text-xs sm:text-sm ${
                          isCustomer
                            ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 font-semibold rounded-tr-sm shadow-sm'
                            : 'bg-white border border-stone-200 text-stone-900 rounded-tl-sm shadow-sm'
                        }`}
                      >
                        <span className="text-[9px] font-bold uppercase tracking-wider block mb-1 opacity-75">
                          {isCustomer ? `Table #${tableNumber} (You)` : 'Staff • Reception'}
                        </span>
                        <p className="whitespace-pre-wrap leading-relaxed">{m.message}</p>
                      </div>
                      <span className="text-[9px] text-stone-400 font-mono mt-1 px-1">
                        {formatTime(m.createdAt)}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input Bar */}
            <div className="p-3.5 px-4 bg-white border-t border-stone-200">
              <form onSubmit={handleSendCustomerMessage} className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Type a message to reception..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isSendingChat}
                  className="flex-1 px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isSendingChat}
                  className="px-4 py-2.5 rounded-xl gold-btn text-xs font-bold flex items-center space-x-1.5 shadow-gold-glow disabled:opacity-50 text-black"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Table QR Scanner Modal */}
      <TableQRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        hotelSlug={slug}
        expectedTableNumber={tableNumber}
        onScanSuccess={(scannedTbl) => {
          const freshTable = scannedTbl || tableNumber;
          setTableNumber(freshTable);
          setIsSessionEnded(false);
          setSessionEndedMessage(null);
          const now = new Date().toISOString();
          setSessionCreatedAt(now);
          try {
            sessionStorage.removeItem(`table_session_ended_${slug}_${freshTable}`);
            sessionStorage.setItem(`session_time_${slug}_${freshTable}`, now);
            localStorage.setItem(`last_table_${slug}`, freshTable);
          } catch {}
          showToast(`Fresh dining session activated for Table #${freshTable}!`);
          router.push(`/menu/${slug}?table=${encodeURIComponent(freshTable)}&qr=1&scan=true&t=${Date.now()}`);
        }}
      />
    </div>
  );
}
