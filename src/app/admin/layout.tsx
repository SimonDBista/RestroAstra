'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, LogOut, ExternalLink, Sparkles } from 'lucide-react';
import { AdminData } from '@/lib/types';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    async function checkAdminAuth() {
      try {
        const token =
          typeof window !== 'undefined'
            ? localStorage.getItem('restroastra_admin_token') || localStorage.getItem('admin_token')
            : null;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/auth/admin/me', { headers });
        if (!res.ok) {
          router.push('/admin/login');
          return;
        }
        const data = await res.json();
        setAdmin(data.admin);
      } catch {
        router.push('/admin/login');
      } finally {
        setLoading(false);
      }
    }

    checkAdminAuth();
  }, [isLoginPage, router]);

  const handleLogout = async () => {
    try {
      try {
        localStorage.removeItem('restroastra_admin_token');
        localStorage.removeItem('admin_token');
      } catch {}
      await fetch('/api/auth/admin/logout', { method: 'POST' });
      window.location.href = '/admin/login';
    } catch {
      window.location.href = '/admin/login';
    }
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin mb-4 shadow-gold-glow" />
        <p className="text-sm font-serif font-bold text-stone-800">Opening Admin Console...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col selection:bg-amber-500 selection:text-white">
      {/* Admin Topbar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-stone-200 px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-white font-extrabold shadow-sm">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="font-serif font-extrabold text-sm text-stone-900 tracking-wide uppercase">
                RestroAstra
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-[10px] font-extrabold">
                Super Admin
              </span>
            </div>
            <span className="text-[11px] text-stone-500 font-mono">
              Admin • {admin?.email}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="px-4 py-2 rounded-xl dark-btn text-stone-700 text-xs font-semibold flex items-center space-x-1.5 hover:text-stone-950"
          >
            <span>Public Site</span>
            <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
          </Link>

          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold flex items-center space-x-1.5 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Admin Page Content */}
      <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">{children}</main>
    </div>
  );
}
