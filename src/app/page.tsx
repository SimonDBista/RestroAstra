'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Smartphone,
  ChefHat,
  Globe,
  Box,
  ArrowRight,
  Utensils,
  Activity,
  Star,
} from 'lucide-react';
import CulinarySteam from '@/components/CulinarySteam';

export default function HomePage() {
  const [activeRoleTab, setActiveRoleTab] = useState<'customer' | 'staff'>('customer');

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-stone-900 flex flex-col selection:bg-amber-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-stone-200/80 px-6 lg:px-14 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Utensils className="w-4 h-4" />
          </div>
          <div>
            <span className="font-serif font-semibold text-stone-900 text-sm sm:text-base tracking-[0.16em] uppercase block leading-none">
              RestroAstra
            </span>
            <span className="text-[9px] text-amber-600 font-semibold tracking-[0.2em] uppercase mt-1 block">
              One platform. Every restaurant operation.
            </span>
          </div>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center space-x-8 text-xs font-semibold tracking-[0.16em] text-stone-600 uppercase">
          <a href="#features" className="hover:text-stone-950 transition">
            Platform
          </a>
          <a href="#experience" className="hover:text-stone-950 transition">
            Guest Experience
          </a>
          <a href="#operations" className="hover:text-stone-950 transition">
            Kitchen Live
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard/login"
            className="px-5 py-2.5 rounded-xl gold-btn text-xs font-bold tracking-wider uppercase text-white shadow-sm transition"
          >
            Staff Login
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 pt-10 pb-16 lg:pt-14 lg:pb-24 text-left overflow-hidden border-b border-stone-200/80 bg-gradient-to-b from-stone-50/60 via-[#FAFAF7] to-[#FAFAF7]">
        {/* Ambient atmospheric backlight */}
        <div className="absolute top-0 left-1/4 w-[700px] h-[350px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Realistic High-End White Ceramic Plate with Native Transparent Seamless Blend */}
        <div className="absolute right-0 bottom-0 pointer-events-none select-none z-0 overflow-hidden w-full lg:w-[80%] xl:w-[75%] h-full max-h-[640px] flex items-end justify-end">
          <img
            id="hero-dish-img"
            src="/hero-plate.webp"
            alt="Artisan Seared Scallop with Puree and Microgreens"
            className="w-auto h-[88%] max-h-[540px] object-contain object-right-bottom drop-shadow-[0_20px_40px_rgba(0,0,0,0.18)]"
          />
        </div>

        {/* Realistic Culinary Steam Rising from Seared Scallop */}
        <CulinarySteam />

        <div className="max-w-7xl w-full mx-auto relative z-20">
          <div className="max-w-xl lg:max-w-2xl text-left">
            {/* Champagne Pill Badge */}
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-amber-50/90 border border-amber-300 text-amber-800 text-xs font-semibold mb-8 backdrop-blur-md shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="tracking-widest uppercase text-[10px]">
                Next-Generation Digital Hospitality
              </span>
              <span className="text-amber-300">•</span>
              <span className="text-stone-600 text-[10px] font-medium">Contactless Table Dining</span>
            </div>

            {/* Main Title */}
            <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl text-stone-900 leading-[1.08] tracking-tight font-normal">
              Taste the <br />
              <span className="italic font-normal text-amber-600">Extraordinary.</span> <br />
              <span className="text-stone-700 font-serif text-3xl sm:text-5xl">
                Elevate Every Table.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-stone-600 text-sm sm:text-base mt-6 max-w-xl font-normal leading-relaxed">
              A luxury digital dining and kitchen operations suite designed for prestigious restaurants,
              boutique hotels, and modern lounges. Guests scan a tabletop QR code to explore dishes,
              order instantaneously, and communicate directly with staff.
            </p>

            {/* Call to action buttons */}
            <div className="mt-10 flex flex-wrap items-center justify-start gap-4">
              <Link
                href="/dashboard/login"
                className="explore-menu-pill px-8 py-3.5 rounded-full text-xs font-bold tracking-[0.16em] uppercase flex items-center space-x-2.5 shadow-md group"
              >
                <ChefHat className="w-4 h-4 text-white" />
                <span>Operations Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>

              <a
                href="#experience"
                className="px-6 py-3.5 rounded-full dark-outline-btn text-stone-800 text-xs font-semibold tracking-wider uppercase flex items-center space-x-2 transition"
              >
                <span>Explore Platform</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Key Metric Highlights Bar */}
      <div className="border-b border-stone-200 bg-white relative z-20 py-8 px-6 lg:px-14">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
            <span className="text-xl sm:text-2xl font-serif text-stone-900 block">Instant</span>
            <span className="text-[11px] text-stone-500 font-medium">No App Download Needed</span>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/60">
            <span className="text-xl sm:text-2xl font-serif text-amber-600 block">Realtime</span>
            <span className="text-[11px] text-stone-500 font-medium">Instant Kitchen Alert</span>
          </div>
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
            <span className="text-xl sm:text-2xl font-serif text-stone-900 block">EN / NE</span>
            <span className="text-[11px] text-stone-500 font-medium">Bilingual Nepali Engine</span>
          </div>
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
            <span className="text-xl sm:text-2xl font-serif text-stone-900 block">3D Food</span>
            <span className="text-[11px] text-stone-500 font-medium">Interactive Preview</span>
          </div>
        </div>
      </div>

      {/* Interactive Role Portals Section */}
      <section id="experience" className="max-w-6xl w-full mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <span className="text-xs uppercase tracking-[0.3em] text-amber-600 font-semibold">
            Tailored Perspectives
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif font-normal text-stone-900 mt-2">
            Built for Discerning Guests & Busy Kitchens
          </h2>
        </div>

        {/* Role Switcher Tabs */}
        <div className="flex items-center justify-center p-1.5 bg-stone-100 border border-stone-200 rounded-2xl max-w-sm mx-auto mb-10 shadow-xs">
          {[
            { id: 'customer', label: '1. Diner Phone Menu', icon: Smartphone },
            { id: 'staff', label: '2. Kitchen Operations', icon: ChefHat },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeRoleTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveRoleTab(tab.id as any)}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold tracking-wider transition-all flex items-center justify-center space-x-2 ${
                  isActive
                    ? 'bronze-btn text-white shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Display Cards */}
        {activeRoleTab === 'customer' && (
          <div className="p-8 lg:p-12 rounded-3xl bg-white border border-stone-200 shadow-xl shadow-stone-900/5 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center animate-fade-in">
            <div className="space-y-6">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                <span>Zero Friction Table Experience</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-serif font-normal text-stone-900 leading-snug">
                Elegantly Designed Tabletop Ordering & Real-Time Waiter Chat
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed font-normal">
                Guests scan their tabletop QR to immediately open the restaurant’s custom branded digital menu.
                No passwords, no app store downloads — just smooth browsing, custom notes, live updates, and direct chat.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-stone-700">
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center space-x-2.5">
                  <Globe className="w-4 h-4 text-amber-600" />
                  <span>English & Nepali Engine</span>
                </div>
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center space-x-2.5">
                  <Box className="w-4 h-4 text-amber-600" />
                  <span>3D Food Interactive View</span>
                </div>
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center space-x-2.5">
                  <Activity className="w-4 h-4 text-amber-600" />
                  <span>Live Status Progression</span>
                </div>
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center space-x-2.5">
                  <Star className="w-4 h-4 text-amber-600" />
                  <span>Post-Dining Reviews</span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/dashboard/login"
                  className="px-6 py-3 rounded-xl bronze-btn text-xs font-semibold tracking-wider uppercase text-white inline-flex items-center space-x-2"
                >
                  <span>Access Operations Portal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Visual Preview Container */}
            <div className="p-6 rounded-2xl bg-amber-50/40 border border-amber-100 shadow-inner">
              <div className="text-center p-4 bg-white rounded-2xl border border-stone-200 mb-4 shadow-xs">
                <span className="text-[10px] uppercase font-serif text-amber-600 font-bold tracking-widest block">
                  RESTAURANT SHOWCASE
                </span>
                <h4 className="font-serif font-bold text-stone-900 text-lg">
                  Sitan Dabaka Sekuwa Cornor
                </h4>
                <div className="inline-block mt-2 px-3 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
                  DIGITAL TABLE ORDERING
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-white border border-stone-200 flex items-center justify-between shadow-xs">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-bold">
                      🍢
                    </div>
                    <div>
                      <span className="font-serif font-bold text-xs text-stone-900 block">
                        Special Mutton Sekuwa
                      </span>
                      <span className="text-[10px] text-stone-500">
                        Charcoal-grilled Himalayan herbs
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-700">Rs. 550</span>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-stone-200 flex items-center justify-between shadow-xs">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-bold">
                      🥟
                    </div>
                    <div>
                      <span className="font-serif font-bold text-xs text-stone-900 block">
                        Chicken C-Momo
                      </span>
                      <span className="text-[10px] text-stone-500">
                        Spicy bell pepper and chilli glaze
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-700">Rs. 320</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeRoleTab === 'staff' && (
          <div className="p-8 lg:p-12 rounded-3xl bg-white border border-stone-200 shadow-xl shadow-stone-900/5 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center animate-fade-in">
            <div className="space-y-6">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                <ChefHat className="w-3.5 h-3.5 text-amber-600" />
                <span>Kitchen Display & Staff Hub</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-serif font-normal text-stone-900 leading-snug">
                Real-Time Order Audio Chimes, KOT Slips, and Instant Status Control
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed font-normal">
                Empower your kitchen staff and managers with immediate audio notifications the second a diner
                places an order, printable kitchen order tickets (KOT), and live table communications.
              </p>

              <div className="pt-2">
                <Link
                  href="/dashboard/login"
                  className="px-6 py-3 rounded-xl bronze-btn text-xs font-semibold tracking-wider uppercase text-white inline-flex items-center space-x-2"
                >
                  <span>Enter Operations Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-amber-50/40 border border-amber-100 shadow-inner">
              <div className="p-4 rounded-xl bg-white border border-stone-200 mb-3 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider block">
                    NEW ORDER ALERT • TABLE #3
                  </span>
                  <span className="text-sm font-serif font-bold text-stone-900">
                    2x Sekuwa Platter, 1x C-Momo
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                  In Kitchen
                </span>
              </div>
              <p className="text-xs text-stone-500 text-center">
                Audio alerts fire automatically via WebSockets on kitchen screens.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-stone-100 border-t border-stone-200 py-8 text-center text-xs text-stone-500">
        <p>© {new Date().getFullYear()} RestroAstra. All rights reserved. • One platform. Every restaurant operation.</p>
      </footer>
    </div>
  );
}
