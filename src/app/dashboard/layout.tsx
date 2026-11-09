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
  UserCheck,
  ChefHat,
  Crown,
  CreditCard,
  Lock,
  KeyRound,
  ShieldCheck,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { HotelData, StaffMemberData, ActiveStaffSession } from '@/lib/types';
import OrderNotificationToast from '@/components/OrderNotificationToast';
import ChatNotificationToast from '@/components/ChatNotificationToast';
import { playOrderBell, playChime, unlockAudio } from '@/lib/audio';

interface NavItemConfig {
  label: string;
  href: string;
  icon: any;
  allowedRoles: string[];
}

const ALL_NAV_ITEMS: NavItemConfig[] = [
  {
    label: 'Live Orders',
    href: '/dashboard',
    icon: ShoppingBag,
    allowedRoles: ['OWNER', 'MANAGER', 'CHEF', 'WAITER', 'CASHIER'],
  },
  {
    label: 'Menu Manager',
    href: '/dashboard/menu',
    icon: UtensilsCrossed,
    allowedRoles: ['OWNER', 'MANAGER'],
  },
  {
    label: 'Live Chat',
    href: '/dashboard/chat',
    icon: MessageSquare,
    allowedRoles: ['OWNER', 'MANAGER', 'WAITER'],
  },
  {
    label: 'Reviews & Ratings',
    href: '/dashboard/feedback',
    icon: Star,
    allowedRoles: ['OWNER', 'MANAGER', 'CASHIER'],
  },
  {
    label: 'Sales Reports',
    href: '/dashboard/reports',
    icon: BarChart3,
    allowedRoles: ['OWNER', 'MANAGER', 'CASHIER'],
  },
  {
    label: 'Menu QR Code',
    href: '/dashboard/qr',
    icon: QrCode,
    allowedRoles: ['OWNER', 'MANAGER', 'WAITER'],
  },
  {
    label: 'Ingredient Inventory',
    href: '/dashboard/inventory',
    icon: Boxes,
    allowedRoles: ['OWNER', 'MANAGER', 'CHEF'],
  },
  {
    label: 'Staff Attendance',
    href: '/dashboard/attendance',
    icon: UserCheck,
    allowedRoles: ['OWNER', 'MANAGER'],
  },
];

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

  // Active Staff & RBAC Session State
  const [activeStaff, setActiveStaff] = useState<ActiveStaffSession>({
    id: 'owner',
    name: 'Restaurant Owner',
    role: 'OWNER',
    isOwner: true,
  });

  // PIN Switcher Modal State
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [availableStaff, setAvailableStaff] = useState<StaffMemberData[]>([]);
  const [selectedStaffToSwitch, setSelectedStaffToSwitch] = useState<any | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  const isLoginPage = pathname === '/dashboard/login';

  // Load Hotel Auth & Active Staff Session
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

        // Load saved active staff session or default to owner
        const savedStaff = localStorage.getItem('restroastra_active_staff');
        if (savedStaff) {
          try {
            setActiveStaff(JSON.parse(savedStaff));
          } catch {
            setActiveStaff({
              id: 'owner',
              name: data.hotel.name + ' (Owner)',
              role: 'OWNER',
              isOwner: true,
            });
          }
        } else {
          setActiveStaff({
            id: 'owner',
            name: data.hotel.name + ' (Owner)',
            role: 'OWNER',
            isOwner: true,
          });
        }
      } catch {
        router.push('/dashboard/login');
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [isLoginPage, router]);

  // Fetch staff list for switch modal
  const fetchStaffForSwitch = async () => {
    try {
      const res = await fetch('/api/hotel/staff');
      if (res.ok) {
        const data = await res.json();
        setAvailableStaff(data.staff || []);
      }
    } catch (err) {
      console.error('Failed to load staff for switch modal:', err);
    }
  };

  const openSwitchModal = () => {
    fetchStaffForSwitch();
    setSelectedStaffToSwitch(null);
    setEnteredPin('');
    setPinError(null);
    setIsSwitchModalOpen(true);
  };

  // Handle PIN verification and switch
  const handleVerifyAndSwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffToSwitch) return;

    try {
      setIsVerifyingPin(true);
      setPinError(null);

      const isOwnerSwitch = selectedStaffToSwitch.id === 'owner';
      const res = await fetch('/api/hotel/staff/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: isOwnerSwitch ? undefined : selectedStaffToSwitch.id,
          isOwner: isOwnerSwitch,
          pinCode: enteredPin,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setPinError(data.error || 'Invalid PIN entered. Please try again.');
        return;
      }

      // Success! Update active staff
      unlockAudio();
      playChime('success');

      setActiveStaff(data.activeStaff);
      localStorage.setItem('restroastra_active_staff', JSON.stringify(data.activeStaff));
      setIsSwitchModalOpen(false);

      // If current page is restricted for the new role, smoothly route to /dashboard
      const targetConfig = ALL_NAV_ITEMS.find((item) => item.href === pathname);
      if (targetConfig && !targetConfig.allowedRoles.includes(data.activeStaff.role)) {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error(err);
      setPinError('Connection error during PIN verification.');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleLogout = async () => {
    try {
      try {
        localStorage.removeItem('restroastra_hotel_token');
        localStorage.removeItem('hotel_token');
        localStorage.removeItem('restroastra_active_staff');
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

  // Role Meta Helper
  const getRoleMeta = (role: string) => {
    switch (role) {
      case 'CHEF':
        return {
          label: 'Chef / Kitchen',
          icon: ChefHat,
          badge: 'bg-amber-100 text-amber-800 border-amber-300',
        };
      case 'WAITER':
        return {
          label: 'Waiter / Service',
          icon: UserCheck,
          badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        };
      case 'CASHIER':
        return {
          label: 'Cashier / Billing',
          icon: CreditCard,
          badge: 'bg-blue-100 text-blue-800 border-blue-300',
        };
      case 'MANAGER':
        return {
          label: 'Manager (Admin)',
          icon: ShieldCheck,
          badge: 'bg-purple-100 text-purple-800 border-purple-300',
        };
      case 'OWNER':
      default:
        return {
          label: 'Owner (All Access)',
          icon: Crown,
          badge: 'bg-amber-500/15 text-amber-900 border-amber-500/30',
        };
    }
  };

  const activeRoleMeta = getRoleMeta(activeStaff.role);
  const ActiveRoleIcon = activeRoleMeta.icon;

  // Filter Nav Items according to current active role
  const visibleNavItems = ALL_NAV_ITEMS.filter((item) =>
    item.allowedRoles.includes(activeStaff.role)
  );

  // Check if current page is restricted
  const currentRouteConfig = ALL_NAV_ITEMS.find((item) => item.href === pathname);
  const isRouteRestricted =
    currentRouteConfig && !currentRouteConfig.allowedRoles.includes(activeStaff.role);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex selection:bg-amber-500 selection:text-white">
      {/* Desktop Luxury Sidebar */}
      <aside className="hidden lg:flex w-72 flex-col bg-white border-r border-stone-200 p-5 sticky top-0 h-screen justify-between z-20 shadow-xs">
        <div>
          {/* Brand Header */}
          <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 mb-4">
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

          {/* Active Staff Switcher Pill */}
          <div className="p-3 bg-stone-50/90 hover:bg-stone-100/80 rounded-2xl border border-stone-200 transition mb-5 flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700 shrink-0">
                <ActiveRoleIcon className="w-4 h-4" />
              </div>
              <div className="truncate">
                <span className="font-serif font-bold text-xs text-stone-900 block truncate">
                  {activeStaff.name}
                </span>
                <span
                  className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider border mt-0.5 ${activeRoleMeta.badge}`}
                >
                  {activeRoleMeta.label}
                </span>
              </div>
            </div>

            <button
              onClick={openSwitchModal}
              className="p-1.5 rounded-lg bg-white border border-stone-200 hover:border-amber-400 text-stone-600 hover:text-amber-800 transition shrink-0 shadow-2xs"
              title="Switch Staff Profile / Unlock with PIN"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {visibleNavItems.map((item) => {
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
            <div className="max-w-[130px] truncate">
              <span className="font-serif font-bold text-xs text-stone-900 block truncate">
                {hotel?.name}
              </span>
              <span className="text-[9px] text-amber-600 uppercase tracking-wider font-semibold">
                Staff Dashboard
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Quick Staff Switch Button on Mobile */}
            <button
              onClick={openSwitchModal}
              className="px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold flex items-center space-x-1"
              title="Switch Staff Role"
            >
              <ActiveRoleIcon className="w-3.5 h-3.5 text-amber-600" />
              <span className="max-w-[65px] truncate">{activeStaff.name.split(' ')[0]}</span>
              <ArrowRightLeft className="w-2.5 h-2.5 opacity-60" />
            </button>

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
            {visibleNavItems.map((item) => {
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

        {/* Page Main Content or Role Restriction Guard */}
        <main className="p-4 sm:p-6 lg:p-10 flex-1 max-w-7xl w-full mx-auto">
          {isRouteRestricted ? (
            <div className="min-h-[50vh] flex items-center justify-center p-4">
              <div className="max-w-md w-full bg-white border border-amber-300 rounded-3xl p-8 text-center shadow-lg animate-fade-in">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-serif font-bold text-stone-900 mb-1">
                  Access Restricted ({activeRoleMeta.label})
                </h2>
                <p className="text-xs text-stone-600 mb-6 leading-relaxed">
                  The <strong>{currentRouteConfig?.label}</strong> section requires Manager or Owner privileges. You are currently logged in under <strong>{activeStaff.name}</strong>.
                </p>
                <div className="space-y-2.5">
                  <button
                    onClick={openSwitchModal}
                    className="w-full py-3 rounded-xl bronze-btn text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 shadow-xs"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Switch Staff / Enter PIN</span>
                  </button>
                  <Link
                    href="/dashboard"
                    className="w-full py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold block"
                  >
                    Return to Live Orders
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* =====================================================================
          MODAL: QUICK POS STAFF ROLE & PIN SWITCHER
         ===================================================================== */}
      {isSwitchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-7 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-5">
              <div>
                <h3 className="text-xl font-serif font-bold text-stone-900 flex items-center space-x-2">
                  <ArrowRightLeft className="w-5 h-5 text-amber-600" />
                  <span>Switch Staff Account</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Select a profile and enter the 4-digit PIN to switch role views.
                </p>
              </div>
              <button
                onClick={() => setIsSwitchModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {pinError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{pinError}</span>
              </div>
            )}

            {!selectedStaffToSwitch ? (
              /* Step 1: Select Staff Profile */
              <div className="space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
                  Select Team Member:
                </span>

                {/* Owner / Administrator Option */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStaffToSwitch({
                      id: 'owner',
                      name: hotel?.name ? `${hotel.name} (Owner)` : 'Restaurant Owner',
                      role: 'OWNER',
                      isOwner: true,
                    });
                    setEnteredPin('');
                    setPinError(null);
                  }}
                  className={`w-full p-3.5 rounded-2xl border text-left transition flex items-center justify-between ${
                    activeStaff.isOwner
                      ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20'
                      : 'bg-white hover:bg-stone-50 border-stone-200'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-800 flex items-center justify-center font-bold">
                      <Crown className="w-5 h-5 text-amber-700" />
                    </div>
                    <div>
                      <span className="font-serif font-bold text-xs text-stone-900 block">
                        Restaurant Owner / Administrator
                      </span>
                      <span className="text-[10px] text-amber-700 font-semibold block">
                        Full Operational Access • Requires Account Password
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-[10px] font-bold uppercase">
                    Master
                  </span>
                </button>

                {/* Staff Members List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {availableStaff.map((staff) => {
                    const meta = getRoleMeta(staff.systemRole || 'WAITER');
                    const StaffIcon = meta.icon;
                    const isCurrent = activeStaff.id === staff.id;

                    return (
                      <button
                        key={staff.id}
                        type="button"
                        onClick={() => {
                          setSelectedStaffToSwitch(staff);
                          setEnteredPin('');
                          setPinError(null);
                        }}
                        className={`p-3 rounded-2xl border text-left transition flex items-center space-x-3 ${
                          isCurrent
                            ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20'
                            : 'bg-stone-50/60 hover:bg-stone-100/80 border-stone-200'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-700 font-bold text-xs shrink-0 shadow-2xs">
                          {staff.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .substring(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="truncate">
                          <span className="font-serif font-bold text-xs text-stone-900 block truncate">
                            {staff.name}
                          </span>
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider border mt-0.5 ${meta.badge}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Step 2: Enter Password or PIN */
              <form onSubmit={handleVerifyAndSwitch} className="space-y-4">
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-stone-500 block">Switching To:</span>
                    <span className="font-serif font-bold text-sm text-stone-900 block">
                      {selectedStaffToSwitch.name}
                    </span>
                    <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">
                      {selectedStaffToSwitch.isOwner
                        ? 'OWNER (ALL ACCESS)'
                        : selectedStaffToSwitch.systemRole || selectedStaffToSwitch.role}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStaffToSwitch(null)}
                    className="text-xs text-amber-700 hover:underline font-bold"
                  >
                    Change Person
                  </button>
                </div>

                <div>
                  <label className="font-bold text-stone-700 text-xs block mb-1.5">
                    {selectedStaffToSwitch.isOwner
                      ? 'Enter Restaurant Account Password:'
                      : 'Enter 4-Digit PIN:'}
                  </label>
                  {selectedStaffToSwitch.isOwner ? (
                    <input
                      type="password"
                      autoFocus
                      placeholder="Enter account login password"
                      value={enteredPin}
                      onChange={(e) => setEnteredPin(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                    />
                  ) : (
                    <input
                      type="password"
                      maxLength={8}
                      autoFocus
                      placeholder="••••"
                      value={enteredPin}
                      onChange={(e) => setEnteredPin(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white text-center font-mono tracking-[0.4em] text-lg font-bold text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                    />
                  )}
                </div>

                {/* Quick Keypad for Staff PINs */}
                {!selectedStaffToSwitch.isOwner && (
                  <div className="grid grid-cols-3 gap-2">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          if (k === 'C') setEnteredPin('');
                          else if (k === '⌫') setEnteredPin((prev) => prev.slice(0, -1));
                          else setEnteredPin((prev) => (prev.length < 12 ? prev + k : prev));
                        }}
                        className="py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-sm font-bold font-mono transition active:scale-95"
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedStaffToSwitch(null)}
                    className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifyingPin}
                    className="flex-1 py-2.5 rounded-xl bronze-btn text-white text-xs font-bold tracking-wide shadow-xs flex items-center justify-center space-x-2"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>{isVerifyingPin ? 'Verifying...' : 'Unlock & Switch'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
