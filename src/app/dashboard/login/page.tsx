'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Lock, AlertCircle, Check, ArrowLeft, Utensils } from 'lucide-react';

export default function HotelLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/hotel/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      if (data.token) {
        try {
          localStorage.setItem('restroastra_hotel_token', data.token);
          localStorage.setItem('hotel_token', data.token);
        } catch {}
      }

      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex items-center justify-center p-4 relative overflow-hidden selection:bg-amber-500 selection:text-white">
      {/* Subtle atmospheric ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Back to home */}
      <Link
        href="/"
        className="absolute top-6 right-6 z-20 flex items-center space-x-2 text-xs font-semibold tracking-wider text-stone-600 hover:text-stone-900 transition"
      >
        <ArrowLeft className="w-4 h-4 text-amber-600" />
        <span>Return to Home</span>
      </Link>

      {/* Main Login Card */}
      <div className="relative z-10 w-full max-w-sm bg-white border border-stone-200/90 rounded-3xl p-8 sm:p-9 shadow-2xl shadow-stone-900/10">
        {/* Header Title */}
        <div className="text-center mb-8">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-300 text-amber-600 flex items-center justify-center mx-auto mb-3">
            <Utensils className="w-5 h-5" />
          </div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-amber-600 font-serif font-bold block mb-1">
            STAFF PORTAL
          </span>
          <h1 className="text-3xl font-serif font-bold text-stone-900 tracking-wider uppercase">
            LOGIN
          </h1>
          <p className="text-xs text-stone-500 mt-1 font-normal">Hotel & Kitchen Operations Hub</p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2.5 animate-slide-up">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email / Username Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-stone-400">
              <User className="w-4 h-4" />
            </div>
            <input
              type="email"
              required
              placeholder="Username / Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-200/90 rounded-full text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition shadow-inner font-normal"
            />
          </div>

          {/* Password Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-stone-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-200/90 rounded-full text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition shadow-inner font-normal"
            />
          </div>

          {/* Remember Me */}
          <div className="flex items-center space-x-2.5 pt-1">
            <button
              type="button"
              onClick={() => setRememberMe(!rememberMe)}
              className={`w-4 h-4 rounded-md border border-amber-500 flex items-center justify-center transition ${
                rememberMe ? 'bg-amber-500' : 'bg-transparent'
              }`}
            >
              {rememberMe && <Check className="w-3 h-3 text-white stroke-[3]" />}
            </button>
            <label
              onClick={() => setRememberMe(!rememberMe)}
              className="text-xs text-stone-700 font-medium cursor-pointer select-none"
            >
              Remember me
            </label>
          </div>

          {/* Sign In Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full gold-btn text-white font-semibold text-xs tracking-wider uppercase shadow-gold-glow disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>

          {/* Forget Password */}
          <div className="text-center pt-1">
            <span className="text-xs text-stone-500 hover:text-stone-800 cursor-pointer transition">
              Forgot your password?
            </span>
          </div>

          {/* Footer Note */}
          <div className="pt-4 border-t border-stone-200 text-center text-xs text-stone-500">
            <span>Don't have an account? </span>
            <span className="text-amber-600 font-semibold hover:underline cursor-pointer">
              Contact Administrator
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
