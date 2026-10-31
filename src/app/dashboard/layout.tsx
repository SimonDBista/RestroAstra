'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShoppingBag,
  UtensilsCrossed,
  MessageSquare,
  Star,
  BarChart3,
  QrCode,
  LogOut,
  ExternalLink,
  Menu,
  X,
  ShieldAlert,
  Utensils,
  Bell,
  Boxes,
} from 'lucide-react';
import { HotelData } from '@/lib/types';
import OrderNotificationToast from '@/components/OrderNotificationToast';
import ChatNotificationToast from '@/components/ChatNotificationToast';
import { playOrderBell, unlockAudio } from '@/lib/audio';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [hotel, setHotel] = useState<HotelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isLoginPage = pathname === '/dashboard/login';

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    async function checkAuth() {
      try {
        const token =
          typeof window !== 'undefined'
            ? localStorage.getItem('restroastra_hotel_token') || localStorage.getItem('hotel_token')
            : null;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/auth/hotel/me', { headers });
        if (!res.ok) {
          router.push('/dashboard/login');
          return;
        }
        const data = await res.json();
        setHotel(data.hotel);
      } catch {
        router.push('/dashboard/login');
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [isLoginPage, router]);

  const handleLogout = async () => {
    try {
      try {
        localStorage.removeItem('restroastra_hotel_token');
        localStorage.removeItem('hotel_token');
      } catch {}
      await fetch('/api/auth/hotel/logout', { method: 'POST' });
      window.location.href = '/dashboard/login';
    } catch {
      window.location.href = '/dashboard/login';
    }
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin mb-4" />
        <p className="text-sm font-serif tracking-wider uppercase text-stone-700">
          Opening Staff Dashboard...
        </p>
      </div>
    );
  }

  // Account Inactivity Guard
  if (hotel && hotel.status !== 'active') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-amber-300 rounded-3xl p-8 text-center shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-300 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">Account Inactive</h2>
          <p className="text-[11px] uppercase tracking-widest text-amber-700 font-bold mb-3">
            STATUS: {hotel.status.toUpperCase()}
          </p>
          <p className="text-xs text-stone-600 mb-6 leading-relaxed">
            Your restaurant subscription for <strong>{hotel.name}</strong> is currently pending or expired. Please reach out to the platform admin to activate access.
          </p>
          <div className="space-y-3">
            <a
              href="mailto:support@restroastra.com"
              className="w-full py-3 rounded-xl bronze-btn text-xs font-semibold uppercase tracking-wider block text-white"
            >
              Contact Support
            </a>
            <button
              onClick={handleLogout}
              className="w-full py-2.5 rounded-xl bg-stone-100 text-stone-600 hover:text-stone-900 text-xs font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    { label: 'Live Orders', href: '/dashboard', icon: ShoppingBag },
    { label: 'Menu Manager', href: '/dashboard/menu', icon: UtensilsCrossed },
    { label: 'Live Chat', href: '/dashboard/chat', icon: MessageSquare },
    { label: 'Reviews & Ratings', href: '/dashboard/feedback', icon: Star },
    { label: 'Sales Reports', href: '/dashboard/reports', icon: BarChart3 },
    { label: 'Menu QR Code', href: '/dashboard/qr', icon: QrCode },
    { label: 'Ingredient Inventory', href: '/dashboard/inventory', icon: Boxes },
  ];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex selection:bg-amber-500 selection:text-white">
      {/* Desktop Luxury Sidebar */}
      <aside className="hidden lg:flex w-72 flex-col bg-white border-r border-stone-200 p-5 sticky top-0 h-screen justify-between z-20 shadow-xs">
        <div>
          {/* Brand Header */}
          <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 font-serif font-bold text-lg">
                <Utensils className="w-5 h-5" />
              </div>
              <div className="leading-tight overflow-hidden">
                <span className="font-serif font-semibold text-sm text-stone-900 tracking-wide block truncate">
                  {hotel?.name || 'Restaurant Dashboard'}
                </span>
                <span className="text-[9px] text-amber-600 font-bold tracking-[0.2em] uppercase mt-0.5 block">
                  Staff Operations Hub
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-3.5 px-4 py-3 rounded-2xl text-xs font-semibold tracking-wider transition-all ${
                    isActive
                      ? 'bronze-btn text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-950 hover:bg-stone-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-stone-200 space-y-2.5">
          {/* Order Alert Bell Status & Test Button */}
          <button
            onClick={() => {
              unlockAudio();
              playOrderBell();
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold transition group shadow-xs"
            title="Click to test order bell sound and activate audio alert"
          >
            <span className="flex items-center space-x-2">
              <Bell className="w-3.5 h-3.5 text-amber-600 group-hover:animate-bounce" />
              <span>Order Bell Alert</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-200/60 text-[10px] font-mono font-bold text-amber-900">
              Test Bell
            </span>
          </button>

          {hotel && (
            <Link
              href={`/menu/${hotel.slug}`}
              target="_blank"
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 text-xs font-semibold transition group shadow-xs"
            >
              <span>View Customer Menu</span>
              <ExternalLink className="w-3.5 h-3.5 text-amber-600 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-red-600 hover:bg-red-50 text-xs font-semibold transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Top Header */}
        <header className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-stone-200 px-4 py-3.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 font-bold font-serif text-sm">
              <Utensils className="w-4 h-4" />
            </div>
            <div className="max-w-[180px] truncate">
              <span className="font-serif font-bold text-xs text-stone-900 block truncate">
                {hotel?.name}
              </span>
              <span className="text-[9px] text-amber-600 uppercase tracking-wider font-semibold">
                Staff Dashboard
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                unlockAudio();
                playOrderBell();
              }}
              className="p-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-700 text-xs flex items-center justify-center"
              title="Test Order Bell Sound"
            >
              <Bell className="w-4 h-4" />
            </button>
            {hotel && (
              <Link
                href={`/menu/${hotel.slug}`}
                target="_blank"
                className="p-2 rounded-xl bg-stone-50 border border-stone-200 text-amber-600 text-xs"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
            )}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-xl bg-stone-50 border border-stone-200 text-stone-700"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-stone-200 p-4 space-y-2 animate-fade-in shadow-lg">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-2xl text-xs font-semibold transition ${
                    isActive
                      ? 'bronze-btn text-white shadow-sm'
                      : 'text-stone-700 bg-stone-50 border border-stone-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl text-red-600 bg-red-50 text-xs font-semibold mt-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        {/* Floating Order Notification Toast & Bell Alert */}
        <OrderNotificationToast hotelId={hotel?.id} />

        {/* Floating Customer Chat Message Notification Toast & Chime Alert */}
        <ChatNotificationToast hotelId={hotel?.id} />

        {/* Page Main Content */}
        <main className="p-4 sm:p-6 lg:p-10 flex-1 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
