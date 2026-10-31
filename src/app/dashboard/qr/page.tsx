'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  QrCode,
  Download,
  Printer,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  Plus,
  Trash2,
  Users,
  Search,
  Layers,
  Sparkles,
  AlertCircle,
  X,
  Compass,
  ArrowRight,
} from 'lucide-react';

interface TableQRItem {
  id: string;
  tableNumber: string;
  name: string | null;
  capacity: number;
  isActive: boolean;
  targetUrl: string;
  qrDataUrl: string;
  createdAt: string;
}

function normalizeQRInput(val: string, section?: string | null): string {
  if (!val) return '';
  let clean = val.trim();
  clean = clean.replace(/^table\s*#?/i, '').trim();
  clean = clean.replace(/^#+/, '').trim();
  clean = clean.replace(/^room\s+(\d+)/i, (_, num) => `room${num}`);

  const sec = String(section || '').trim().toLowerCase();
  if (/room/i.test(sec) && !clean.toLowerCase().startsWith('room')) {
    clean = `room${clean}`;
  } else if (sec) {
    const lodgingTypes = ['cabana', 'cottage', 'villa', 'suite', 'vip'];
    for (const t of lodgingTypes) {
      if (sec.includes(t) && !clean.toLowerCase().startsWith(t)) {
        clean = `${t}${clean}`;
        break;
      }
    }
  }

  return clean;
}

function getQRCardDisplay(tableNumber: string, sectionName?: string | null): {
  sectionLabel: string | null;
  mainTitle: string;
} {
  const cleanNumber = String(tableNumber || '').trim();
  const section = String(sectionName || '').trim();
  const lowerSec = section.toLowerCase();
  const lowerNum = cleanNumber.toLowerCase();

  // If it is a room
  if (lowerNum.startsWith('room') || /room/i.test(lowerSec)) {
    const numPart = cleanNumber.replace(/^room\s*#?/i, '').replace(/^#+/, '').trim();
    return {
      sectionLabel: null, // Don't show duplicate section tag above
      mainTitle: `Rooms #${numPart}`,
    };
  }

  // Other lodging (Cabana, Villa, Cottage, Suite, VIP)
  const lodgings = ['cabana', 'cottage', 'villa', 'suite', 'vip'];
  for (const t of lodgings) {
    if (lowerNum.startsWith(t) || lowerSec.includes(t)) {
      const numPart = cleanNumber.replace(new RegExp(`^${t}\\s*#?`, 'i'), '').replace(/^#+/, '').trim();
      const prefix = t.toUpperCase() === 'VIP' ? 'VIP' : t.charAt(0).toUpperCase() + t.slice(1);
      return {
        sectionLabel: null,
        mainTitle: `${prefix} #${numPart}`,
      };
    }
  }

  // Standard dining table
  const numPart = cleanNumber.replace(/^table\s*#?/i, '').replace(/^#+/, '').trim();
  return {
    sectionLabel: section || 'Dining Area',
    mainTitle: `#${numPart}`,
  };
}

function formatQRBadge(val: string, section?: string | null): string {
  if (!val) return '';
  return getQRCardDisplay(val, section).mainTitle;
}

export default function HotelQRGeneratorPage() {
  const [activeTab, setActiveTab] = useState<'tables' | 'master'>('tables');

  // Per-Table State
  const [tables, setTables] = useState<TableQRItem[]>([]);
  const [hotelName, setHotelName] = useState('Restaurant Menu');
  const [hotelSlug, setHotelSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Master QR State
  const [masterQR, setMasterQR] = useState<{
    targetUrl: string;
    qrDataUrl: string;
    hotelName: string;
  } | null>(null);
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterCopied, setMasterCopied] = useState(false);

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [printTable, setPrintTable] = useState<TableQRItem | null>(null);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);

  // Single Add Form
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableName, setNewTableName] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('4');
  const [isSavingTable, setIsSavingTable] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Bulk Generator Form
  const [bulkPrefix, setBulkPrefix] = useState('');
  const [bulkStart, setBulkStart] = useState('1');
  const [bulkCount, setBulkCount] = useState('10');
  const [bulkSection, setBulkSection] = useState('Main Dining');
  const [bulkCapacity, setBulkCapacity] = useState('4');
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // Fetch all tables with QRs
  const fetchTables = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/hotel/tables');
      if (res.ok) {
        const data = await res.json();
        setTables(data.tables || []);
        if (data.hotelName) setHotelName(data.hotelName);
        if (data.hotelSlug) setHotelSlug(data.hotelSlug);
      }
    } catch (err) {
      console.error('Failed to load tables:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch master universal QR
  const fetchMasterQR = async () => {
    try {
      setMasterLoading(true);
      const res = await fetch('/api/hotel/qr');
      if (res.ok) {
        const data = await res.json();
        setMasterQR(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMasterLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
    fetchMasterQR();
  }, []);

  // Filtered tables
  // Filtered tables / QRs
  const filteredTables = useMemo(() => {
    if (!searchQuery.trim()) return tables;
    const q = searchQuery.toLowerCase().trim();
    return tables.filter(
      (t) =>
        t.tableNumber.toLowerCase().includes(q) ||
        formatQRBadge(t.tableNumber, t.name).toLowerCase().includes(q) ||
        (t.name && t.name.toLowerCase().includes(q))
    );
  }, [tables, searchQuery]);

  // Single QR Creation
  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber.trim()) {
      setFormError('QR number or label is required');
      return;
    }

    try {
      setIsSavingTable(true);
      setFormError(null);
      const cleanNumber = normalizeQRInput(newTableNumber, newTableName);

      const res = await fetch('/api/hotel/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: cleanNumber,
          name: newTableName.trim() || undefined,
          capacity: parseInt(newTableCapacity, 10) || 4,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to add QR');
        return;
      }

      setNewTableNumber('');
      setNewTableName('');
      setNewTableCapacity('4');
      setIsAddModalOpen(false);
      await fetchTables();
    } catch (err: any) {
      setFormError(err?.message || 'Network error');
    } finally {
      setIsSavingTable(false);
    }
  };

  // Bulk Tables Creation
  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsBulkSaving(true);
      setFormError(null);
      let prefix = bulkPrefix.trim();
      if (!prefix && bulkSection && /room/i.test(bulkSection)) {
        prefix = 'room';
      }

      const res = await fetch('/api/hotel/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bulk: true,
          prefix,
          start: parseInt(bulkStart, 10) || 1,
          count: parseInt(bulkCount, 10) || 10,
          sectionName: bulkSection.trim() || undefined,
          capacity: parseInt(bulkCapacity, 10) || 4,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to generate tables');
        return;
      }

      setIsBulkModalOpen(false);
      await fetchTables();
    } catch (err: any) {
      setFormError(err?.message || 'Network error');
    } finally {
      setIsBulkSaving(false);
    }
  };

  // Delete Table / QR
  const handleDeleteTable = async (id: string, tableNumber: string) => {
    if (!confirm(`Are you sure you want to delete QR "${formatQRBadge(tableNumber)}"?`)) return;

    try {
      const res = await fetch(`/api/hotel/tables?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setTables((prev) => prev.filter((t) => t.id !== id));
      } else {
        alert('Failed to delete QR');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting QR');
    }
  };

  // Download Single QR
  const handleDownload = (qrDataUrl: string, fileName: string) => {
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = fileName;
    a.click();
  };

  // Copy Link
  const handleCopy = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Trigger Print for Single Stand
  const triggerSinglePrint = (table: TableQRItem) => {
    setPrintTable(table);
    setIsBulkPrinting(false);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Trigger Print for All Stands
  const triggerBulkPrint = () => {
    setPrintTable(null);
    setIsBulkPrinting(true);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-3xl font-serif font-bold text-stone-900">Menu QR Codes & Tables</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              Per-Table QR
            </span>
          </div>
          <p className="text-xs text-stone-600 mt-1">
            Generate separate QR codes for each table. Guests scan their exact table stand to open the menu with verified table tracking.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-1 p-1 bg-stone-100 border border-stone-200 rounded-2xl">
          <button
            onClick={() => setActiveTab('tables')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'tables'
                ? 'bg-amber-500 text-stone-950 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Table QRs ({tables.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('master')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'master'
                ? 'bg-amber-500 text-stone-950 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Master Menu QR</span>
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: PER-TABLE QR CODES & MANAGEMENT                       */}
      {/* ============================================================ */}
      {activeTab === 'tables' && (
        <div className="space-y-6 print:hidden">
          {/* Action Bar & Quick Stats */}
          <div className="p-4 bg-white border border-stone-200/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            {/* Search and Table Count */}
            <div className="flex items-center space-x-3 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search table number or section..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500"
                />
              </div>
              <span className="text-[11px] font-semibold text-stone-700 whitespace-nowrap px-2.5 py-1.5 bg-stone-100 rounded-lg border border-stone-200">
                {filteredTables.length} {filteredTables.length === 1 ? 'Table' : 'Tables'}
              </span>
            </div>

            {/* Buttons: Add QR, Bulk Generate, Print All */}
            <div className="flex items-center flex-wrap gap-2.5">
              <button
                onClick={() => {
                  setFormError(null);
                  setIsAddModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl dark-btn text-stone-700 text-xs font-semibold flex items-center space-x-1.5 hover:text-stone-900 border border-stone-200"
              >
                <Plus className="w-3.5 h-3.5 text-amber-600" />
                <span>Add QR</span>
              </button>

              <button
                onClick={() => {
                  setFormError(null);
                  setIsBulkModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl dark-btn text-amber-700 text-xs font-semibold flex items-center space-x-1.5 hover:border-amber-400 border border-stone-200"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Bulk Generate</span>
              </button>

              <button
                onClick={triggerBulkPrint}
                disabled={tables.length === 0}
                className="px-4 py-2 rounded-xl gold-btn text-xs font-bold flex items-center space-x-2 shadow-sm text-stone-950 disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>Print All Table Stands</span>
              </button>
            </div>
          </div>

          {/* Quick Notice Banner */}
          <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-50/50 to-stone-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-stone-700">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 flex-shrink-0">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-stone-900 block">Unique Table QR Isolation</span>
                <span className="text-stone-600 text-[11px]">
                  Each table stand has its own unique QR code. When diners scan it, the system automatically detects their table number and locks it during ordering.
                </span>
              </div>
            </div>
            <button
              onClick={fetchTables}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-600' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Table QR Cards Grid */}
          {loading ? (
            <div className="py-24 text-center">
              <RefreshCw className="w-8 h-8 text-amber-600 animate-spin mx-auto mb-3" />
              <p className="text-xs font-semibold text-stone-600">Loading tables & generating QR codes...</p>
            </div>
          ) : filteredTables.length === 0 ? (
            <div className="p-12 text-center bg-stone-50 border border-dashed border-stone-200 rounded-3xl">
              <QrCode className="w-12 h-12 text-stone-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-stone-900 mb-1">No Tables Found</h3>
              <p className="text-xs text-stone-600 max-w-sm mx-auto mb-4">
                {searchQuery
                  ? `No tables match your search "${searchQuery}".`
                  : 'Start by adding your dining tables or click Bulk Generate to create tables 1 to 10 in seconds.'}
              </p>
              <button
                onClick={() => setIsBulkModalOpen(true)}
                className="px-4 py-2 rounded-xl gold-btn text-xs font-bold inline-flex items-center space-x-2 text-stone-950 shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                <span>Bulk Generate Tables</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredTables.map((table) => (
                <div
                  key={table.id}
                  className="bg-white border border-stone-200/80 hover:border-amber-400/50 rounded-3xl p-5 flex flex-col justify-between transition-all duration-200 group shadow-sm hover:shadow-md relative overflow-hidden"
                >
                  {/* Decorative top accent line */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400/50 to-transparent opacity-0 group-hover:opacity-100 transition" />

                  {/* Header: Table Number, Section & Capacity */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        {getQRCardDisplay(table.tableNumber, table.name).sectionLabel && (
                          <span className="text-[10px] uppercase tracking-wider font-bold text-amber-700 block">
                            {getQRCardDisplay(table.tableNumber, table.name).sectionLabel}
                          </span>
                        )}
                        <h3 className="text-xl font-serif font-black text-stone-900">
                          {getQRCardDisplay(table.tableNumber, table.name).mainTitle}
                        </h3>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-200 flex items-center space-x-1">
                          <Users className="w-2.5 h-2.5 text-amber-600" />
                          <span>{table.capacity}</span>
                        </span>
                        <button
                          onClick={() => handleDeleteTable(table.id, table.tableNumber)}
                          title="Delete Table"
                          className="p-1.5 text-stone-400 hover:text-red-500 rounded-lg hover:bg-stone-100 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* QR Code Container */}
                    <div className="bg-stone-50 p-3.5 rounded-2xl shadow-inner border border-amber-200/60 flex justify-center my-2 group-hover:border-amber-400 transition">
                      <img
                        src={table.qrDataUrl}
                        alt={`QR Code ${formatQRBadge(table.tableNumber, table.name)}`}
                        className="w-44 h-44 object-contain rounded-lg"
                      />
                    </div>

                    {/* Direct URL preview */}
                    <div className="mt-3 px-2.5 py-1.5 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-between text-[11px] font-mono text-stone-600">
                      <span className="truncate max-w-[170px]">{table.targetUrl.replace(/^https?:\/\//, '')}</span>
                      <a
                        href={table.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Test Guest Menu"
                        className="text-amber-700 hover:text-amber-600 ml-1 flex-shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-4 pt-3.5 border-t border-stone-100 flex items-center justify-between gap-1.5">
                    <button
                      onClick={() => handleCopy(table.targetUrl, table.id)}
                      title="Copy Direct Link"
                      className="p-2 rounded-xl bg-stone-50 border border-stone-200 text-stone-700 hover:text-stone-900 hover:border-amber-300 transition text-xs flex items-center justify-center flex-1 shadow-sm"
                    >
                      {copiedId === table.id ? (
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>Copied!</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-stone-700 flex items-center space-x-1">
                          <Copy className="w-3 h-3" />
                          <span>Link</span>
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() =>
                        handleDownload(
                          table.qrDataUrl,
                          `${hotelSlug || 'restaurant'}-qr-${normalizeQRInput(table.tableNumber).toLowerCase().replace(/\s+/g, '-')}.png`
                        )
                      }
                      title="Download PNG QR"
                      className="p-2 rounded-xl bg-stone-50 border border-stone-200 text-amber-800 hover:text-amber-700 hover:border-amber-300 transition text-xs flex items-center justify-center space-x-1 flex-1 font-semibold shadow-sm"
                    >
                      <Download className="w-3 h-3" />
                      <span className="text-[10px]">PNG</span>
                    </button>

                    <button
                      onClick={() => triggerSinglePrint(table)}
                      title="Print Luxury Stand Card"
                      className="p-2 rounded-xl gold-btn text-xs font-bold flex items-center justify-center space-x-1 flex-1 shadow-sm text-stone-950"
                    >
                      <Printer className="w-3 h-3" />
                      <span className="text-[10px]">Print</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: MASTER / GENERAL MENU QR                             */}
      {/* ============================================================ */}
      {activeTab === 'master' && (
        <div className="space-y-6 print:hidden">
          <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-stone-700">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 flex-shrink-0">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <span className="font-semibold text-stone-900 block">Universal Counter & Marketing QR</span>
                <span className="text-stone-600 text-[11px]">
                  Does not specify any table. Ideal for reception counters, takeout flyers, social media, or door stands. Diners enter their table manually.
                </span>
              </div>
            </div>
            {masterQR?.targetUrl && (
              <a
                href={masterQR.targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 text-amber-700 text-xs font-semibold transition shadow-sm"
              >
                <span>Preview</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <div className="flex justify-center">
            <div className="w-full max-w-sm bg-white border-2 border-amber-300 rounded-3xl p-8 text-center shadow-xl relative overflow-hidden">
              <div className="border border-amber-200 rounded-2xl p-6 bg-stone-50/40">
                <span className="text-[10px] uppercase tracking-[0.3em] text-amber-700 font-serif font-bold">
                  SCAN • BROWSE • ORDER
                </span>
                <h2 className="text-2xl font-serif font-bold text-stone-900 mt-1.5 uppercase tracking-wide">
                  {masterQR?.hotelName || hotelName}
                </h2>

                <div className="inline-block my-3 px-4 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 font-bold text-xs shadow-sm">
                  UNIVERSAL DIGITAL MENU
                </div>

                <div className="my-4 p-3.5 bg-white rounded-2xl shadow-sm inline-block border-2 border-amber-200">
                  {masterLoading ? (
                    <div className="w-56 h-56 flex items-center justify-center">
                      <RefreshCw className="w-8 h-8 text-amber-600 animate-spin" />
                    </div>
                  ) : masterQR?.qrDataUrl ? (
                    <img
                      src={masterQR.qrDataUrl}
                      alt="Universal Menu QR Code"
                      className="w-56 h-56 object-contain rounded-xl"
                    />
                  ) : (
                    <div className="w-56 h-56 flex items-center justify-center text-xs text-stone-500">
                      QR unavailable
                    </div>
                  )}
                </div>

                <p className="text-xs font-medium text-stone-700 mt-2">
                  Scan to browse our digital menu, 3D dishes, and place your order.
                </p>

                <div className="mt-5 pt-4 border-t border-stone-200 flex items-center justify-center space-x-3">
                  <button
                    onClick={() => {
                      if (!masterQR?.targetUrl) return;
                      navigator.clipboard.writeText(masterQR.targetUrl);
                      setMasterCopied(true);
                      setTimeout(() => setMasterCopied(false), 2000);
                    }}
                    className="px-3.5 py-2 rounded-xl dark-btn text-xs font-semibold text-stone-700 flex items-center space-x-1.5 border border-stone-200"
                  >
                    {masterCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{masterCopied ? 'Copied!' : 'Copy Link'}</span>
                  </button>

                  <button
                    onClick={() => {
                      if (!masterQR?.qrDataUrl) return;
                      handleDownload(masterQR.qrDataUrl, `${hotelSlug || 'restaurant'}-universal-qr.png`);
                    }}
                    className="px-3.5 py-2 rounded-xl gold-btn text-xs font-bold flex items-center space-x-1.5 text-stone-950 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PNG</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: ADD SINGLE QR                                       */}
      {/* ============================================================ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white border border-stone-200 rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-stone-900">Add New QR</h3>
                <p className="text-[11px] text-stone-600">Creates a QR stand and generates its unique menu link.</p>
              </div>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddTable} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  QR Number or Label <span className="text-amber-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2, room 2, VIP-1"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-stone-500 mt-1 block">
                  This exact label will be printed on the stand and linked to guest orders (e.g. #2, #room2).
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Section / Area Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rooms, Main Dining"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {['Main Dining', 'Rooms', 'Terrace', 'VIP'].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setNewTableName(sec)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition ${
                          newTableName.toLowerCase() === sec.toLowerCase()
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-stone-100 text-stone-600 border-stone-200 hover:text-stone-900'
                        }`}
                      >
                        {sec}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Seating Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    placeholder="4"
                    value={newTableCapacity}
                    onChange={(e) => setNewTableCapacity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Dynamic Live QR Badge Preview */}
              {newTableNumber.trim() && (
                <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-stone-500 block">
                      QR Stand Preview
                    </span>
                    <span className="text-[11px] text-stone-700">
                      {newTableName.trim() ? `Section: ${newTableName.trim()}` : 'Dining Area'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-serif font-black text-amber-800 bg-white border border-amber-300 px-3 py-1 rounded-xl shadow-sm inline-block">
                      {formatQRBadge(newTableNumber, newTableName)}
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl dark-btn text-xs font-semibold text-stone-700 hover:text-stone-900 border border-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTable}
                  className="px-5 py-2.5 rounded-xl gold-btn text-xs font-bold flex items-center space-x-1.5 shadow-sm text-stone-950 disabled:opacity-50"
                >
                  {isSavingTable && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSavingTable ? 'Creating...' : 'Add QR'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: BULK TABLE GENERATOR                                */}
      {/* ============================================================ */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white border border-stone-200 rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setIsBulkModalOpen(false)}
              className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-stone-900">Bulk Table Generator</h3>
                <p className="text-[11px] text-stone-600">Generate a series of tables with 1 click.</p>
              </div>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleBulkGenerate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Start Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={bulkStart}
                    onChange={(e) => setBulkStart(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    How Many Tables?
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={bulkCount}
                    onChange={(e) => setBulkCount(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Prefix (Optional)
                </label>
                <input
                  type="text"
                  placeholder={bulkSection && /room/i.test(bulkSection) ? "Default: 'room'" : "e.g. 'T-' or 'room'"}
                  value={bulkPrefix}
                  onChange={(e) => setBulkPrefix(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-stone-500 mt-1 block">
                  Preview: #{bulkPrefix || (bulkSection && /room/i.test(bulkSection) ? 'room' : '')}{bulkStart}, #{bulkPrefix || (bulkSection && /room/i.test(bulkSection) ? 'room' : '')}{parseInt(bulkStart, 10) + 1} ...
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Section Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Main Dining, Rooms"
                    value={bulkSection}
                    onChange={(e) => setBulkSection(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {['Main Dining', 'Rooms', 'Terrace', 'VIP'].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => {
                          setBulkSection(sec);
                          if (!bulkPrefix && /room/i.test(sec)) {
                            setBulkPrefix('room');
                          }
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition ${
                          bulkSection.toLowerCase() === sec.toLowerCase()
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-stone-100 text-stone-600 border-stone-200 hover:text-stone-900'
                        }`}
                      >
                        {sec}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={bulkCapacity}
                    onChange={(e) => setBulkCapacity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl dark-btn text-xs font-semibold text-stone-700 hover:text-stone-900 border border-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBulkSaving}
                  className="px-5 py-2.5 rounded-xl gold-btn text-xs font-bold flex items-center space-x-1.5 shadow-sm text-stone-950 disabled:opacity-50"
                >
                  {isBulkSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isBulkSaving ? 'Generating...' : `Generate ${bulkCount} Tables`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* PRINT-ONLY AREA: SINGLE OR BULK TABLE TENT CARDS             */}
      {/* ============================================================ */}
      <div className="hidden print:block print:w-full">
        {/* Case A: Single Table Print */}
        {printTable && (
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="w-[340px] border-2 border-black rounded-3xl p-6 text-center text-black bg-white">
              <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-gray-700 block">
                SCAN • ORDER • LIVE CHAT
              </span>
              <h2 className="text-xl font-serif font-black uppercase tracking-wide mt-1">
                {hotelName}
              </h2>

              <div className="my-3 py-1.5 px-4 rounded-full border border-black bg-gray-100 font-bold text-sm tracking-wider inline-block">
                {getQRCardDisplay(printTable.tableNumber, printTable.name).mainTitle.toUpperCase()}
              </div>

              <span className="text-[11px] font-semibold text-gray-600 block mb-2">
                {getQRCardDisplay(printTable.tableNumber, printTable.name).sectionLabel ? `${getQRCardDisplay(printTable.tableNumber, printTable.name).sectionLabel} • ` : ''}Capacity: {printTable.capacity} Guests
              </span>

              <div className="my-3 p-3 border-2 border-black rounded-2xl inline-block bg-white">
                <img
                  src={printTable.qrDataUrl}
                  alt={`QR Code ${getQRCardDisplay(printTable.tableNumber, printTable.name).mainTitle}`}
                  className="w-52 h-52 object-contain"
                />
              </div>

              <p className="text-xs font-semibold text-gray-800 mt-2 leading-relaxed">
                Scan with your phone camera to view the menu, 3D dishes, and place your order.
              </p>
              <p className="text-[10px] font-bold text-gray-500 mt-3 uppercase tracking-wider">
                RestroAstra • One platform. Every restaurant operation.
              </p>
            </div>
          </div>
        )}

        {/* Case B: Bulk Print All Tables (Formatted 2-per-row sheet) */}
        {isBulkPrinting && (
          <div className="grid grid-cols-2 gap-6 p-4">
            {tables.map((table) => {
              const display = getQRCardDisplay(table.tableNumber, table.name);
              return (
                <div
                  key={table.id}
                  className="border-2 border-black rounded-3xl p-5 text-center text-black bg-white flex flex-col justify-between break-inside-avoid page-break-inside-avoid my-2"
                >
                  <div>
                    <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-gray-700 block">
                      SCAN • ORDER • LIVE CHAT
                    </span>
                    <h2 className="text-lg font-serif font-black uppercase tracking-wide mt-0.5 truncate">
                      {hotelName}
                    </h2>

                    <div className="my-2 py-1 px-4 rounded-full border border-black bg-gray-100 font-bold text-xs tracking-wider inline-block">
                      {display.mainTitle.toUpperCase()}
                    </div>

                    {display.sectionLabel && (
                      <span className="text-[10px] font-semibold text-gray-600 block mb-1">
                        {display.sectionLabel}
                      </span>
                    )}
                  </div>

                <div className="my-2 p-2 border-2 border-black rounded-xl inline-block mx-auto bg-white">
                  <img
                    src={table.qrDataUrl}
                    alt={`QR Code ${formatQRBadge(table.tableNumber, table.name)}`}
                    className="w-40 h-40 object-contain"
                  />
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-gray-800 mt-1 leading-snug">
                    Scan with phone camera to order directly.
                  </p>
                  <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-wider">
                    RestroAstra
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}
