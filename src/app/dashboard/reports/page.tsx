'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Award,
  RefreshCw,
  Printer,
  Calendar,
  Sparkles,
  Plus,
  Trash2,
  Receipt,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Layers,
  FileText,
  X,
  Edit3,
  Save,
  Calculator,
  Percent,
  Search,
  Eye,
  UtensilsCrossed,
  Banknote,
  Smartphone,
} from 'lucide-react';
import { formatNPR, formatTime, formatDate } from '@/lib/utils';
import ReceiptModal from '@/components/ReceiptModal';
import { OrderData } from '@/lib/types';

export interface OrderRecordItem {
  id: string;
  type: 'active' | 'historical';
  tableNumber: string;
  customerName: string;
  customerPhone?: string | null;
  totalAmount: number;
  discountAmount: number;
  paymentMethod?: string;
  items: string;
  notes?: string | null;
  status: string;
  createdAt: string;
}

const EXPENSE_CATEGORIES = [
  { id: 'Meat & Poultry', label: 'Meat & Sekuwa', emoji: '🥩' },
  { id: 'Groceries & Rice', label: 'Rice & Groceries', emoji: '🍚' },
  { id: 'Vegetables & Produce', label: 'Fresh Vegetables', emoji: '🥬' },
  { id: 'Beverages & Dairy', label: 'Beverages & Dairy', emoji: '🥤' },
  { id: 'Staff Salaries', label: 'Salaries & Wages', emoji: '👥' },
  { id: 'Utilities & Gas', label: 'LPG Gas & Utilities', emoji: '🔥' },
  { id: 'Maintenance & Cleaning', label: 'Repairs & Cleaning', emoji: '🛠️' },
  { id: 'Other Miscellaneous', label: 'Other Expenses', emoji: '🏷️' },
];

export default function HotelReportsPage() {
  const [reports, setReports] = useState<{
    summary: {
      totalRevenue: number;
      grossSales?: number;
      cashRevenue?: number;
      onlineRevenue?: number;
      totalDiscounts?: number;
      totalExpenses: number;
      netProfit: number;
      totalOrdersCount: number;
      completedCount: number;
      pendingCount: number;
      cancelledCount: number;
      averageOrderValue: number;
    };
    topItems: Array<{ name: string; quantity: number; revenue: number }>;
    dailyTrends: Array<{ date: string; sales: number; count: number }>;
    expenses: Array<{
      id: string;
      category: string;
      title: string;
      amount: number;
      paymentMethod: string;
      date: string;
      notes?: string | null;
    }>;
    categoryBreakdown: Array<{
      category: string;
      amount: number;
      percentage: number;
    }>;
    orderRecords?: OrderRecordItem[];
  } | null>(null);

  // Daily Register (Opening & Closing Balance) state
  const [register, setRegister] = useState<{
    date: string;
    openingBalance: number;
    income: number;
    expenses: number;
    closingBalance: number;
    cashSales?: number;
    onlineSales?: number;
    cashExpenses?: number;
    notes: string;
    isClosed?: boolean;
  } | null>(null);

  const [selectedRange, setSelectedRange] = useState<'today' | 'yesterday' | '7days' | 'month' | 'all'>('today');
  const [loading, setLoading] = useState(true);

  // Register editing inputs (Staff only types opening balance)
  const [openingInput, setOpeningInput] = useState('');
  const [registerNotes, setRegisterNotes] = useState('');
  const [isSavingRegister, setIsSavingRegister] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(false);

  // Expense modal state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState(EXPENSE_CATEGORIES[0].id);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<'cash' | 'online' | 'bank'>('cash');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [isSavingExpense, setIsSavingExpense] = useState(false);

  // Order Records & Receipt Modal state
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [recordPaymentFilter, setRecordPaymentFilter] = useState<'all' | 'cash' | 'online'>('all');
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<OrderData | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [hotelName, setHotelName] = useState('RestroAstra Restaurant');

  const parseOrderItems = (rawItems: any): Array<{ name: string; quantity: number; price?: number }> => {
    if (!rawItems) return [];
    if (Array.isArray(rawItems)) return rawItems;
    try {
      const parsed = JSON.parse(rawItems);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
  };

  const handleOpenSlip = (record: OrderRecordItem) => {
    const orderData: OrderData = {
      id: record.id,
      hotelId: '',
      tableNumber: record.tableNumber,
      customerName: record.customerName,
      customerPhone: record.customerPhone || undefined,
      items: record.items,
      totalAmount: record.totalAmount,
      discountAmount: record.discountAmount,
      paymentMethod: record.paymentMethod || 'cash',
      notes: record.notes || undefined,
      status: (record.status === 'settled' ? 'done' : record.status) as any,
      createdAt: record.createdAt,
      updatedAt: record.createdAt,
    };
    setSelectedReceiptOrder(orderData);
    setIsReceiptModalOpen(true);
  };

  // Fetch Reports
  const fetchReports = async (range: string = selectedRange) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/hotel/reports?range=${range}`);
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to get yesterday date string in Asia/Kathmandu
  const getYesterdayNepalString = () => {
    const now = new Date();
    const nepalToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu' }).format(now);
    const startOfToday = new Date(`${nepalToday}T00:00:00+05:45`);
    const yesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu' }).format(yesterday);
  };

  // Fetch Daily Register
  const fetchRegister = async (targetDate?: string) => {
    try {
      const url = targetDate ? `/api/hotel/register?date=${targetDate}` : '/api/hotel/register';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRegister(data);
        setOpeningInput(data.openingBalance ? String(data.openingBalance) : '');
        setRegisterNotes(data.notes || '');
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetch('/api/auth/hotel/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.hotel?.name) setHotelName(data.hotel.name);
      })
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    fetchReports(selectedRange);
    if (selectedRange === 'yesterday') {
      fetchRegister(getYesterdayNepalString());
    } else {
      fetchRegister();
    }
  }, [selectedRange]);

  // Save Opening Balance (Staff only types opening balance)
  const handleSaveRegister = async () => {
    try {
      setIsSavingRegister(true);
      const parsedOpening = Math.max(parseFloat(openingInput) || 0, 0);
      const targetDate = selectedRange === 'yesterday' ? (register?.date || getYesterdayNepalString()) : register?.date;

      const res = await fetch('/api/hotel/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: targetDate,
          openingBalance: parsedOpening,
          notes: registerNotes,
        }),
      });

      if (res.ok) {
        setSaveSuccessMessage(true);
        setTimeout(() => setSaveSuccessMessage(false), 3500);
        if (selectedRange === 'yesterday') {
          await fetchRegister(getYesterdayNepalString());
        } else {
          await fetchRegister();
        }
        await fetchReports(selectedRange);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingRegister(false);
    }
  };

  // Add Expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle.trim() || !expenseAmount || parseFloat(expenseAmount) <= 0) return;

    try {
      setIsSavingExpense(true);
      const res = await fetch('/api/hotel/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: expenseCategory,
          title: expenseTitle.trim(),
          amount: parseFloat(expenseAmount),
          paymentMethod: expensePaymentMethod,
          notes: expenseNotes.trim() || undefined,
        }),
      });

      if (res.ok) {
        setExpenseTitle('');
        setExpenseAmount('');
        setExpenseNotes('');
        setIsExpenseModalOpen(false);
        await fetchReports(selectedRange);
        await fetchRegister();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingExpense(false);
    }
  };

  // Delete Expense
  const handleDeleteExpense = async (id: string, title: string) => {
    if (!confirm(`Delete expense "${title}"?`)) return;

    try {
      const res = await fetch(`/api/hotel/expenses?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchReports(selectedRange);
        await fetchRegister();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  if (loading || !reports) {
    return (
      <div className="p-16 text-center">
        <RefreshCw className="w-8 h-8 text-gold-400 animate-spin mx-auto mb-2 shadow-gold-glow" />
        <p className="text-xs text-stone-400">Compiling financial performance & register balances...</p>
      </div>
    );
  }

  const { summary, topItems, dailyTrends, expenses = [], categoryBreakdown = [], orderRecords = [] } = reports;
  const maxDailySale = Math.max(...dailyTrends.map((d) => d.sales), 100);

  // Filter order records based on payment filter & search query
  const filteredOrderRecords = orderRecords.filter((record) => {
    const isOnline = (record.paymentMethod || '').toLowerCase().includes('online');
    if (recordPaymentFilter === 'cash' && isOnline) return false;
    if (recordPaymentFilter === 'online' && !isOnline) return false;

    if (!orderSearchQuery.trim()) return true;
    const q = orderSearchQuery.toLowerCase().trim();
    const matchTable = `table ${record.tableNumber}`.toLowerCase().includes(q) || record.tableNumber.toLowerCase().includes(q);
    const matchCustomer = record.customerName?.toLowerCase().includes(q);
    const matchPhone = record.customerPhone?.toLowerCase().includes(q);
    const matchId = record.id.toLowerCase().includes(q);
    const matchItems = record.items?.toLowerCase().includes(q);
    const matchPayment = (record.paymentMethod || '').toLowerCase().includes(q);
    return matchTable || matchCustomer || matchPhone || matchId || matchItems || matchPayment;
  });

  const totalRecordsRevenue = filteredOrderRecords.reduce((sum, r) => sum + r.totalAmount, 0);
  const totalRecordsDiscounts = filteredOrderRecords.reduce((sum, r) => sum + (r.discountAmount || 0), 0);
  const totalRecordsGross = totalRecordsRevenue + totalRecordsDiscounts;
  const totalRecordsCash = filteredOrderRecords
    .filter((r) => !(r.paymentMethod || '').toLowerCase().includes('online'))
    .reduce((sum, r) => sum + r.totalAmount, 0);
  const totalRecordsOnline = filteredOrderRecords
    .filter((r) => (r.paymentMethod || '').toLowerCase().includes('online'))
    .reduce((sum, r) => sum + r.totalAmount, 0);

  const allCashCount = orderRecords.filter((r) => !(r.paymentMethod || '').toLowerCase().includes('online')).length;
  const allOnlineCount = orderRecords.filter((r) => (r.paymentMethod || '').toLowerCase().includes('online')).length;

  // Dynamic automatic register calculations: Closing = Opening + Income - Expenses
  const currentOpening = parseFloat(openingInput) || 0;
  const currentIncome = register?.income ?? summary.totalRevenue ?? 0;
  const currentExpenses = register?.expenses ?? summary.totalExpenses ?? 0;
  const calculatedClosing = Math.round(currentOpening + currentIncome - currentExpenses);

  return (
    <div className="space-y-8 print:p-4 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-3xl font-serif font-extrabold text-stone-900">Sales & Financial Reports</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-800 border border-amber-500/30">
              Register & Expenses
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Track daily revenue, expenses (meat, rice, salaries), opening/closing cash till, and net profit.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="px-3.5 py-2 rounded-xl gold-btn text-xs font-bold flex items-center space-x-1.5 shadow-sm text-black"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Expense</span>
          </button>

          <button
            onClick={() => {
              fetchReports(selectedRange);
              fetchRegister();
            }}
            className="px-3.5 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            onClick={handlePrintReport}
            className="px-4 py-2 rounded-xl bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 text-xs font-bold flex items-center space-x-1.5 shadow-sm transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Financial Statement</span>
          </button>
        </div>
      </div>

      {/* Time Period Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-stone-200 pb-4 print:hidden overflow-x-auto">
        {(['today', 'yesterday', '7days', 'month', 'all'] as const).map((range) => {
          const labels = {
            today: "Today's Ledger",
            yesterday: "Yesterday's Ledger",
            '7days': 'Last 7 Days',
            month: 'Last 30 Days',
            all: 'All Time Records',
          };
          const isSelected = selectedRange === range;
          return (
            <button
              key={range}
              onClick={() => setSelectedRange(range)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                isSelected
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'bg-white text-stone-700 hover:bg-stone-50 border border-stone-200 shadow-sm'
              }`}
            >
              {labels[range]}
            </button>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/* 1. EXECUTIVE FINANCIAL SUMMARY CARDS                         */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Net Revenue */}
        <div className="bg-white border border-stone-200 rounded-3xl p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Net Sales Revenue</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center border border-amber-500/30">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-serif font-black text-stone-900">
              {formatNPR(summary.totalRevenue)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-stone-500 flex items-center space-x-1.5">
            <span className="text-emerald-700 font-bold">{summary.completedCount} Settled Orders</span>
            <span>•</span>
            <span>AOV: {formatNPR(summary.averageOrderValue)}</span>
          </div>
        </div>

        {/* Discounts Given */}
        <div className="bg-white border border-stone-200 rounded-3xl p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Discounts Given</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center border border-amber-500/30">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-serif font-black text-amber-700">
              {formatNPR(summary.totalDiscounts || 0)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-stone-500 flex items-center space-x-1.5">
            <span>Gross: {formatNPR(summary.grossSales || summary.totalRevenue)}</span>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white border border-stone-200 rounded-3xl p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total Expenses</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-700 flex items-center justify-center border border-rose-500/30">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-serif font-black text-rose-700">
              {formatNPR(summary.totalExpenses)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-stone-500 flex items-center space-x-1.5">
            <span>Meat, Groceries, Wages & Utilities</span>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white border border-stone-200 rounded-3xl p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Net Profit</span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                summary.netProfit >= 0
                  ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
                  : 'bg-red-500/15 text-red-700 border-red-500/30'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`text-2xl sm:text-3xl font-serif font-black ${
                summary.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {formatNPR(summary.netProfit)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-stone-500 flex items-center space-x-1">
            <span>Sales ({formatNPR(summary.totalRevenue)}) − Expenses ({formatNPR(summary.totalExpenses)})</span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. DAILY CASH REGISTER & AUTOMATIC CLOSING BALANCE          */}
      {/* ============================================================ */}
      <div className="bg-white border border-amber-400/50 rounded-3xl p-6 shadow-md relative overflow-hidden">
        {/* Subtle accent header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-stone-100 pb-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-700 flex items-center justify-center border border-amber-500/30 font-bold shadow-sm">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-serif font-bold text-stone-900">Daily Cash Register & Till Reconciliation</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-800 border border-amber-500/30 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 animate-pulse text-amber-600" />
                  <span>Auto-Calculated</span>
                </span>
              </div>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Staff only enters the Morning Opening Balance. The Closing Balance is automatically calculated in real-time as: <span className="text-amber-800 font-semibold">Opening Balance + Income − Expenses</span>.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold text-stone-700 px-3 py-1 bg-stone-100 rounded-xl border border-stone-200">
              Date: {register?.date || (selectedRange === 'yesterday' ? getYesterdayNepalString() : 'Today')}
            </span>
          </div>
        </div>

        {/* Live Equation Breakdown Flow Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 rounded-2xl bg-stone-50 border border-stone-200 mb-6">
          {/* 1. Opening Balance */}
          <div className="p-4 rounded-xl bg-white border border-stone-200 flex flex-col justify-between relative shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-stone-500">
                ① Opening Balance
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                Staff Typed
              </span>
            </div>
            <div className="my-2">
              <span className="text-xl sm:text-2xl font-serif font-black text-stone-900">
                {formatNPR(currentOpening)}
              </span>
            </div>
            <span className="text-[10px] text-stone-500">Morning drawer starting cash</span>
          </div>

          {/* 2. Income (Sales) */}
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-emerald-800">
                + ② Income (Sales)
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                Auto
              </span>
            </div>
            <div className="my-2">
              <span className="text-xl sm:text-2xl font-serif font-black text-emerald-700">
                +{formatNPR(currentIncome)}
              </span>
            </div>
            <span className="text-[10px] text-stone-500">Total settled food & drink sales</span>
          </div>

          {/* 3. Expenses */}
          <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 flex flex-col justify-between relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-rose-800">
                − ③ Expenses
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                Auto
              </span>
            </div>
            <div className="my-2">
              <span className="text-xl sm:text-2xl font-serif font-black text-rose-700">
                −{formatNPR(currentExpenses)}
              </span>
            </div>
            <span className="text-[10px] text-stone-500">Meat, rice, wages & utilities</span>
          </div>

          {/* 4. Closing Balance */}
          <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-400 shadow-sm flex flex-col justify-between relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-amber-800">
                = ④ Closing Balance
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                Live Result
              </span>
            </div>
            <div className="my-2">
              <span className="text-2xl sm:text-3xl font-serif font-black text-amber-800">
                {formatNPR(calculatedClosing)}
              </span>
            </div>
            <span className="text-[10px] text-stone-600 font-medium">Opening + Income − Expenses</span>
          </div>
        </div>

        {/* Inputs & Live Calculation Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Left: Set Opening Balance Input */}
          <div className="space-y-4 p-5 rounded-2xl bg-stone-50 border border-stone-200/80 shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-stone-800">
                  Morning Opening Balance (NPR) <span className="text-amber-600">*</span>
                </label>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Only Field To Type
                </span>
              </div>
              <p className="text-[11px] text-stone-600 mb-2">
                Type the cash amount placed in the drawer at the start of the day. Everything else is automatically computed from incoming sales and logged expenses.
              </p>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 font-bold text-xs">
                  NPR
                </span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  placeholder="e.g. 5000"
                  value={openingInput}
                  onChange={(e) => setOpeningInput(e.target.value)}
                  className="w-full pl-14 pr-3.5 py-2.5 bg-white border border-stone-200 rounded-xl text-sm font-bold text-stone-900 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Register Notes / Settlement Remarks (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Morning float verified by Manager."
                value={registerNotes}
                onChange={(e) => setRegisterNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center space-x-3 pt-1">
              <button
                onClick={handleSaveRegister}
                disabled={isSavingRegister}
                className="px-5 py-2.5 rounded-xl gold-btn text-xs font-bold flex items-center space-x-2 shadow-sm text-stone-950 disabled:opacity-50"
              >
                {isSavingRegister ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isSavingRegister ? 'Saving...' : 'Save Opening Balance'}</span>
              </button>

              {saveSuccessMessage && (
                <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-600 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Saved successfully!</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Live Automatic Closing Balance Summary */}
          <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 shadow-sm flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-stone-200 pb-2">
                <span className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center space-x-1.5">
                  <Calculator className="w-3.5 h-3.5 text-amber-600" />
                  <span>Automatic Closing Calculation</span>
                </span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Live Sync Active
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-stone-700">
                  <span>Opening Starting Balance (Typed):</span>
                  <span className="font-mono font-bold text-stone-900">{formatNPR(currentOpening)}</span>
                </div>
                <div className="flex items-center justify-between text-emerald-700">
                  <span>+ Total Sales Income (Orders):</span>
                  <span className="font-mono font-bold">+{formatNPR(currentIncome)}</span>
                </div>
                <div className="flex items-center justify-between text-rose-700">
                  <span>− Total Operational Expenses:</span>
                  <span className="font-mono font-bold">−{formatNPR(currentExpenses)}</span>
                </div>

                <div className="border-t border-stone-200 pt-3 mt-2 flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase font-bold text-amber-700 block">
                      Calculated Closing Balance
                    </span>
                    <span className="text-[10px] text-stone-500 block">
                      Formula: Opening + Income − Expenses
                    </span>
                  </div>
                  <span className="text-2xl font-serif font-black text-amber-700">
                    {formatNPR(calculatedClosing)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-200 text-[11px] text-stone-600 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Add food/drink orders or record expenses (meat, rice, wages) anytime; the closing balance updates instantly.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. DAILY ORDER RECORDS                                       */}
      {/* ============================================================ */}
      <div className="bg-white border border-stone-200/80 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20 shadow-sm">
                <FileText className="w-4 h-4" />
              </div>
              <h3 className="text-xl font-serif font-bold text-stone-900">Order Records</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20">
                {filteredOrderRecords.length} of {orderRecords.length} Orders
              </span>
            </div>
            <p className="text-xs text-stone-600 mt-1">
              {selectedRange === 'yesterday'
                ? "Yesterday's complete guest order records"
                : selectedRange === 'today'
                ? "Today's complete guest order records"
                : 'Complete guest order records for this time period'}{' '}
              with table numbers, itemized food & drinks, discounts given, total settlements, and receipt slips.
            </p>
          </div>

          {/* Quick Filters: Cash vs Online + Search */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Payment Method Filter Pills */}
            <div className="flex items-center p-1 bg-stone-100 border border-stone-200 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setRecordPaymentFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  recordPaymentFilter === 'all'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                All ({orderRecords.length})
              </button>
              <button
                type="button"
                onClick={() => setRecordPaymentFilter('cash')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition ${
                  recordPaymentFilter === 'cash'
                    ? 'bg-emerald-100 text-emerald-800 shadow-sm'
                    : 'text-stone-600 hover:text-emerald-700'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>Cash ({allCashCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setRecordPaymentFilter('online')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition ${
                  recordPaymentFilter === 'online'
                    ? 'bg-cyan-100 text-cyan-800 shadow-sm'
                    : 'text-stone-600 hover:text-cyan-700'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Online Payment ({allOnlineCount})</span>
              </button>
            </div>

            {/* Quick Search Bar */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search table, guest, cash/online..."
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500"
              />
              {orderSearchQuery && (
                <button
                  onClick={() => setOrderSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mini metric summary banner with Cash vs Online breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80">
          <div className="px-3 py-1.5">
            <span className="text-[10px] uppercase font-bold text-stone-500 block">Orders Shown</span>
            <span className="text-base font-serif font-black text-stone-900">{filteredOrderRecords.length}</span>
          </div>
          <div className="px-3 py-1.5 border-l border-stone-200">
            <span className="text-[10px] uppercase font-bold text-stone-500 block">Gross Value</span>
            <span className="text-base font-serif font-bold text-stone-700">{formatNPR(totalRecordsGross)}</span>
          </div>
          <div className="px-3 py-1.5 border-l border-stone-200">
            <span className="text-[10px] uppercase font-bold text-emerald-700 block">Cash Sales</span>
            <span className="text-base font-serif font-bold text-emerald-700">{formatNPR(totalRecordsCash)}</span>
          </div>
          <div className="px-3 py-1.5 border-l border-stone-200">
            <span className="text-[10px] uppercase font-bold text-cyan-700 block">Online Payment Sales</span>
            <span className="text-base font-serif font-bold text-cyan-700">{formatNPR(totalRecordsOnline)}</span>
          </div>
          <div className="px-3 py-1.5 border-l border-stone-200">
            <span className="text-[10px] uppercase font-bold text-amber-700 block">Total Collected</span>
            <span className="text-base font-serif font-black text-amber-700">{formatNPR(totalRecordsRevenue)}</span>
          </div>
        </div>

        {/* Order Records Table */}
        {filteredOrderRecords.length === 0 ? (
          <div className="py-12 text-center text-xs text-stone-500 bg-stone-50 rounded-2xl border border-stone-200">
            <ShoppingBag className="w-8 h-8 text-stone-400 mx-auto mb-2" />
            <p className="font-semibold text-stone-600">
              {orderRecords.length === 0
                ? 'No guest order records found for this time period.'
                : 'No orders match your search filter.'}
            </p>
            {orderSearchQuery && (
              <button
                onClick={() => setOrderSearchQuery('')}
                className="mt-2 text-amber-700 hover:underline text-xs"
              >
                Clear search filter
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700">
              <thead>
                <tr className="border-b border-stone-200 text-[10px] uppercase tracking-wider text-stone-500 font-bold bg-stone-50/50">
                  <th className="py-3 px-3">Time & ID</th>
                  <th className="py-3 px-3">Table</th>
                  <th className="py-3 px-3">Guest / Contact</th>
                  <th className="py-3 px-3">Ordered Items Breakdown</th>
                  <th className="py-3 px-3 text-right">Subtotal</th>
                  <th className="py-3 px-3 text-right">Discount</th>
                  <th className="py-3 px-3 text-right">Total Paid</th>
                  <th className="py-3 px-3 text-center">Payment</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right print:hidden">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200/70">
                {filteredOrderRecords.map((record) => {
                  const itemsList = parseOrderItems(record.items);
                  const orderSubtotal = (record.totalAmount || 0) + (record.discountAmount || 0);
                  const isOnlinePayment = String(record.paymentMethod || '').toLowerCase().includes('online');

                  return (
                    <tr key={record.id} className="hover:bg-amber-50/40 transition">
                      {/* Time & ID */}
                      <td className="py-3.5 px-3 font-mono text-stone-600 whitespace-nowrap">
                        <div className="font-bold text-stone-900 text-xs">{formatTime(record.createdAt)}</div>
                        <div className="text-[10px] text-stone-500 flex items-center space-x-1 mt-0.5">
                          <span>{formatDate(record.createdAt)}</span>
                          <span>•</span>
                          <span className="text-amber-700 font-semibold">#{record.id.slice(-6).toUpperCase()}</span>
                        </div>
                      </td>

                      {/* Table */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 font-bold text-xs inline-flex items-center space-x-1">
                          <span>T-{record.tableNumber}</span>
                        </span>
                      </td>

                      {/* Guest */}
                      <td className="py-3.5 px-3">
                        <div className="font-medium text-stone-900">{record.customerName}</div>
                        {record.customerPhone && (
                          <div className="text-[10px] font-mono text-stone-500">{record.customerPhone}</div>
                        )}
                      </td>

                      {/* Ordered Items Breakdown */}
                      <td className="py-3.5 px-3 max-w-xs">
                        <div className="flex flex-wrap gap-1.5">
                          {itemsList.map((item, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-stone-100 border border-stone-200 text-[11px] text-stone-800"
                            >
                              <span className="font-bold text-amber-700 font-mono">{item.quantity}×</span>
                              <span className="truncate max-w-[120px]">{item.name}</span>
                            </span>
                          ))}
                        </div>
                        {record.notes && (
                          <div className="text-[10px] text-stone-500 italic mt-1 truncate">
                            Note: {record.notes}
                          </div>
                        )}
                      </td>

                      {/* Subtotal */}
                      <td className="py-3.5 px-3 text-right font-mono text-stone-600 whitespace-nowrap">
                        {formatNPR(orderSubtotal)}
                      </td>

                      {/* Discount */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap font-mono">
                        {record.discountAmount > 0 ? (
                          <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            -{formatNPR(record.discountAmount)}
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>

                      {/* Total Paid */}
                      <td className="py-3.5 px-3 text-right font-serif font-black text-emerald-700 text-sm whitespace-nowrap">
                        {formatNPR(record.totalAmount)}
                      </td>

                      {/* Payment Method Badge */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {isOnlinePayment ? (
                          <span className="px-2.5 py-1 rounded-xl bg-cyan-50 text-cyan-800 border border-cyan-200 font-bold text-[11px] inline-flex items-center space-x-1.5 shadow-sm">
                            <Smartphone className="w-3 h-3 text-cyan-600" />
                            <span>Online Payment</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[11px] inline-flex items-center space-x-1.5 shadow-sm">
                            <Banknote className="w-3 h-3 text-emerald-600" />
                            <span>Cash</span>
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {record.status}
                        </span>
                      </td>

                      {/* Action - Receipt Slip */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap print:hidden">
                        <button
                          onClick={() => handleOpenSlip(record)}
                          className="px-2.5 py-1.5 rounded-xl dark-btn text-xs font-bold text-stone-700 hover:text-amber-700 border border-stone-200 hover:border-amber-400 inline-flex items-center space-x-1.5 transition"
                          title="View / Print Order Receipt Slip"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-600" />
                          <span>Slip</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 4. EXPENSES & INVENTORY PURCHASES LEDGER                     */}
      {/* ============================================================ */}
      <div className="bg-white border border-stone-200/80 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xl font-serif font-bold text-stone-900">Daily Operational Expenses</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                {expenses.length} Entries
              </span>
            </div>
            <p className="text-xs text-stone-600 mt-1">
              Meat, rice, fresh produce, staff salaries, gas cylinders, and kitchen materials.
            </p>
          </div>

          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="px-4 py-2.5 rounded-xl gold-btn text-xs font-bold flex items-center space-x-2 shadow-sm text-stone-950 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Record New Expense</span>
          </button>
        </div>

        {/* Category Breakdown Progress Bars */}
        {categoryBreakdown.length > 0 && (
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-3">
            <span className="text-[10px] uppercase tracking-wider font-bold text-stone-500 block">
              Expense Spending Breakdown
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {categoryBreakdown.map((cat) => {
                const itemConfig = EXPENSE_CATEGORIES.find((c) => c.id === cat.category);
                return (
                  <div key={cat.category} className="p-3 bg-white rounded-xl border border-stone-200/80 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-bold text-stone-900 mb-1">
                      <span className="flex items-center space-x-1.5 truncate">
                        <span>{itemConfig?.emoji || '🏷️'}</span>
                        <span className="truncate">{cat.category}</span>
                      </span>
                      <span className="text-rose-600 font-mono text-[11px]">{cat.percentage}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden my-1.5">
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-stone-600 font-mono block">
                      {formatNPR(cat.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Expenses List Table */}
        {expenses.length === 0 ? (
          <div className="py-12 text-center text-xs text-stone-500">
            No expenses recorded for this time period. Click "Record New Expense" to add meat, rice, or staff wage expenses.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700">
              <thead>
                <tr className="border-b border-stone-200 text-[10px] uppercase tracking-wider text-stone-500 font-bold bg-stone-50/50">
                  <th className="pb-3 px-3">Date & Time</th>
                  <th className="pb-3 px-3">Category</th>
                  <th className="pb-3 px-3">Description / Item</th>
                  <th className="pb-3 px-3">Payment</th>
                  <th className="pb-3 px-3 text-right">Amount</th>
                  <th className="pb-3 px-3 text-right print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200/70">
                {expenses.map((exp) => {
                  const catConfig = EXPENSE_CATEGORIES.find((c) => c.id === exp.category);
                  return (
                    <tr key={exp.id} className="hover:bg-amber-50/40 transition">
                      <td className="py-3 px-3 font-mono text-stone-600 whitespace-nowrap">
                        {formatDate(exp.date)} <span className="text-[10px] opacity-75">{formatTime(exp.date)}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200 text-[11px] font-semibold text-stone-800 inline-flex items-center space-x-1.5">
                          <span>{catConfig?.emoji || '🏷️'}</span>
                          <span>{exp.category}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-stone-900">
                        <div>{exp.title}</div>
                        {exp.notes && (
                          <div className="text-[10px] text-stone-500 italic mt-0.5">{exp.notes}</div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 text-[10px] uppercase font-mono text-stone-600 border border-stone-200">
                          {exp.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-serif font-bold text-rose-600 text-sm whitespace-nowrap">
                        {formatNPR(exp.amount)}
                      </td>
                      <td className="py-3 px-3 text-right print:hidden">
                        <button
                          onClick={() => handleDeleteExpense(exp.id, exp.title)}
                          title="Delete expense entry"
                          className="p-1.5 text-stone-400 hover:text-red-500 rounded-lg hover:bg-stone-100 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 4. DAILY SALES TRENDS & POPULAR DISHES                       */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Sales Bar Chart */}
        <div className="lg:col-span-2 bg-white border border-stone-200/80 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-serif font-bold text-stone-900">Daily Revenue Progression</h3>
              <p className="text-xs text-stone-600">Order revenue trends for the selected timeframe</p>
            </div>
            <BarChart3 className="w-5 h-5 text-amber-600" />
          </div>

          <div className="h-48 flex items-end justify-between gap-2 pt-6 border-b border-stone-200 px-2">
            {dailyTrends.map((trend, idx) => {
              const heightPercent = maxDailySale > 0 ? (trend.sales / maxDailySale) * 100 : 0;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center group h-full justify-end">
                  <div className="text-[9px] font-mono text-amber-700 mb-1 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                    {trend.sales > 0 ? formatNPR(trend.sales) : ''}
                  </div>
                  <div
                    style={{ height: `${Math.max(heightPercent, 4)}%` }}
                    className={`w-full max-w-[36px] rounded-t-lg transition-all duration-300 ${
                      trend.sales > 0
                        ? 'bg-gradient-to-t from-amber-500 to-amber-400 shadow-sm group-hover:brightness-110'
                        : 'bg-stone-200'
                    }`}
                  />
                  <span className="text-[10px] text-stone-500 mt-2 font-mono truncate w-full text-center">
                    {trend.date}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Performing Dishes */}
        <div className="bg-white border border-stone-200/80 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-serif font-bold text-stone-900">Best Selling Dishes</h3>
              <p className="text-xs text-stone-600">Top dishes ranked by order volume</p>
            </div>
            <Award className="w-5 h-5 text-amber-600" />
          </div>

          <div className="space-y-3 mt-4">
            {topItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-stone-500">No dishes recorded yet</div>
            ) : (
              topItems.slice(0, 5).map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-stone-50 border border-stone-200/80 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-white border border-stone-200 text-amber-700 font-serif font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-stone-900 truncate">{item.name}</h4>
                      <span className="text-[10px] text-stone-500">{item.quantity} orders sold</span>
                    </div>
                  </div>
                  <span className="text-xs font-serif font-bold text-amber-700 shrink-0">
                    {formatNPR(item.revenue)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL: RECORD NEW EXPENSE                                    */}
      {/* ============================================================ */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white border border-stone-200 rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setIsExpenseModalOpen(false)}
              className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-stone-900">Record Restaurant Expense</h3>
                <p className="text-[11px] text-stone-600">Meat, rice, fresh produce, wages, or supplies.</p>
              </div>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4">
              {/* Category selector chips */}
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-2">
                  Select Category <span className="text-amber-600">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {EXPENSE_CATEGORIES.map((cat) => {
                    const isSelected = expenseCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setExpenseCategory(cat.id)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center text-center space-y-1 transition ${
                          isSelected
                            ? 'bg-amber-500 text-stone-950 border-amber-500 font-bold shadow-sm'
                            : 'bg-stone-50 border-stone-200 text-stone-700 hover:border-amber-400 hover:text-stone-900'
                        }`}
                      >
                        <span className="text-base">{cat.emoji}</span>
                        <span className="text-[10px] leading-tight truncate w-full">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Description / Item <span className="text-amber-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 5kg Mutton Sekuwa meat, 1 Sack Rice, Cook Wage"
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Amount (NPR) <span className="text-amber-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="1"
                    placeholder="e.g. 3500"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 font-bold font-mono"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Paid From / Method
                  </label>
                  <select
                    value={expensePaymentMethod}
                    onChange={(e) => setExpensePaymentMethod(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-500"
                  >
                    <option value="cash">Cash from Register / Till</option>
                    <option value="online">Online (Fonepay / eSewa / Khalti)</option>
                    <option value="bank">Bank Transfer / Cheque</option>
                  </select>
                  <span className="text-[10px] text-stone-500 mt-1 block">
                    Cash from till automatically deducts from daily register closing.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Vendor / Note (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Local butcher Banasthali"
                    value={expenseNotes}
                    onChange={(e) => setExpenseNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl dark-btn text-xs font-semibold text-stone-700 hover:text-stone-900 border border-stone-200 hover:border-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingExpense}
                  className="px-5 py-2.5 rounded-xl gold-btn text-xs font-bold flex items-center space-x-1.5 shadow-sm text-stone-950 disabled:opacity-50"
                >
                  {isSavingExpense ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{isSavingExpense ? 'Recording...' : 'Record Expense'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: VIEW / PRINT THERMAL RECEIPT SLIP                     */}
      {/* ============================================================ */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        order={selectedReceiptOrder}
        hotelName={hotelName}
        onOrderUpdated={() => {
          fetchReports(selectedRange);
          if (selectedRange === 'yesterday') {
            fetchRegister(getYesterdayNepalString());
          } else {
            fetchRegister();
          }
        }}
      />

      {/* ============================================================ */}
      {/* PRINT-ONLY FINANCIAL STATEMENT SHEET                         */}
      {/* ============================================================ */}
      <div className="hidden print:block text-black p-4 space-y-6">
        <div className="text-center border-b-2 border-black pb-4">
          <h1 className="text-2xl font-serif font-black uppercase">
            {selectedRange === 'yesterday'
              ? 'Yesterday Financial Settlement & Sales Report'
              : 'Daily Financial Settlement & Sales Report'}
          </h1>
          <p className="text-xs text-gray-600 mt-1">RestroAstra Multi-Tenant Restaurant Operations</p>
          <div className="text-xs font-mono font-bold mt-2">
            Date: {register?.date || (selectedRange === 'yesterday' ? getYesterdayNepalString() : formatDate(new Date()))}
          </div>
        </div>

        {/* Financial Totals */}
        <div className="grid grid-cols-4 gap-4 border border-black p-4 text-center">
          <div>
            <span className="text-xs font-bold block uppercase text-gray-700">Gross Sales</span>
            <span className="text-xl font-bold">{formatNPR(summary.grossSales || summary.totalRevenue)}</span>
          </div>
          <div>
            <span className="text-xs font-bold block uppercase text-gray-700">Discounts Given</span>
            <span className="text-xl font-bold text-amber-800">−{formatNPR(summary.totalDiscounts || 0)}</span>
          </div>
          <div>
            <span className="text-xs font-bold block uppercase text-gray-700">Net Sales</span>
            <span className="text-xl font-bold">{formatNPR(summary.totalRevenue)}</span>
          </div>
          <div>
            <span className="text-xs font-bold block uppercase text-gray-700">Net Profit</span>
            <span className="text-xl font-bold">{formatNPR(summary.netProfit)}</span>
          </div>
        </div>

        {/* Cash Register Daily Balance Statement */}
        <div className="border border-black p-4 space-y-2">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1">
            Cash Register & Daily Balance Statement
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Opening Balance (Morning Starting Cash):</div>
            <div className="text-right font-bold">{formatNPR(currentOpening)}</div>
            <div>+ Total Income (Gross Sales Revenue):</div>
            <div className="text-right font-bold text-green-700">+{formatNPR(currentIncome)}</div>
            <div>− Total Operational Expenses:</div>
            <div className="text-right font-bold text-red-700">−{formatNPR(currentExpenses)}</div>
            <div className="border-t-2 border-black font-bold pt-2 text-sm">
              = Closing Balance (Opening + Income − Expenses):
            </div>
            <div className="border-t-2 border-black text-right font-bold pt-2 text-sm">
              {formatNPR(calculatedClosing)}
            </div>
          </div>
        </div>

        {/* Expense List */}
        <div className="border border-black p-4">
          <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-2">Itemized Expenses</h3>
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-400">
                <th className="py-1">Category</th>
                <th className="py-1">Description</th>
                <th className="py-1">Method</th>
                <th className="py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-gray-200">
                  <td className="py-1">{e.category}</td>
                  <td className="py-1">{e.title}</td>
                  <td className="py-1 uppercase">{e.paymentMethod}</td>
                  <td className="py-1 text-right font-bold">{formatNPR(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Daily Order Records Print List */}
        {orderRecords.length > 0 && (
          <div className="border border-black p-4">
            <h3 className="font-bold text-sm uppercase border-b border-black pb-1 mb-2">
              Daily Order Records ({orderRecords.length} Settled Orders)
            </h3>
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-gray-400">
                  <th className="py-1">Time & ID</th>
                  <th className="py-1">Table</th>
                  <th className="py-1">Guest</th>
                  <th className="py-1">Dishes Ordered</th>
                  <th className="py-1 text-center">Payment</th>
                  <th className="py-1 text-right">Gross</th>
                  <th className="py-1 text-right">Discount</th>
                  <th className="py-1 text-right">Total Paid</th>
                </tr>
              </thead>
              <tbody>
                {orderRecords.map((rec) => {
                  const recItems = parseOrderItems(rec.items);
                  const subtotalVal = (rec.totalAmount || 0) + (rec.discountAmount || 0);
                  const isOnline = String(rec.paymentMethod || '').toLowerCase().includes('online');
                  return (
                    <tr key={rec.id} className="border-b border-gray-200">
                      <td className="py-1 font-mono">
                        {formatTime(rec.createdAt)} <span className="text-[10px]">#{rec.id.slice(-6).toUpperCase()}</span>
                      </td>
                      <td className="py-1 font-bold">Table {rec.tableNumber}</td>
                      <td className="py-1">{rec.customerName}</td>
                      <td className="py-1 max-w-[220px] truncate">
                        {recItems.map((it) => `${it.quantity}x ${it.name}`).join(', ') || 'Items'}
                      </td>
                      <td className="py-1 text-center font-bold uppercase text-[10px]">
                        {isOnline ? 'Online Payment' : 'Cash'}
                      </td>
                      <td className="py-1 text-right font-mono">{formatNPR(subtotalVal)}</td>
                      <td className="py-1 text-right font-mono text-amber-800">
                        {rec.discountAmount > 0 ? `-${formatNPR(rec.discountAmount)}` : '—'}
                      </td>
                      <td className="py-1 text-right font-mono font-bold">{formatNPR(rec.totalAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Signatures */}
        <div className="pt-12 flex justify-between text-xs border-t border-gray-400">
          <div>Prepared By: ___________________</div>
          <div>Manager Approval: ___________________</div>
        </div>
      </div>
    </div>
  );
}
