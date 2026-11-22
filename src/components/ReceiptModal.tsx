'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Printer,
  CheckCircle2,
  Percent,
  Tag,
  RefreshCw,
  AlertCircle,
  ChefHat,
  Receipt,
  Building2,
  Phone,
  FileText,
  Sliders,
  Scissors,
} from 'lucide-react';
import { OrderData, OrderItem } from '@/lib/types';
import { formatNPR, formatDate } from '@/lib/utils';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderData | null;
  hotelName?: string;
  hotelAddress?: string;
  hotelPhone?: string;
  hotelPan?: string;
  isTableBill?: boolean;
  onOrderUpdated?: (updatedOrder?: any) => void;
}

export default function ReceiptModal({
  isOpen,
  onClose,
  order,
  hotelName = 'Fine Dining Restaurant',
  hotelAddress = '',
  hotelPhone = '',
  hotelPan = '',
  isTableBill = false,
  onOrderUpdated,
}: ReceiptModalProps) {
  // Print Mode: 'bill' (Customer Bill / Tax Invoice) or 'kot' (Kitchen Order Ticket)
  const [printMode, setPrintMode] = useState<'bill' | 'kot'>('bill');

  // Discount States
  const [discountMode, setDiscountMode] = useState<'percent' | 'fixed'>('percent');
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [discountReason, setDiscountReason] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedDiscount, setSavedDiscount] = useState<number>(0);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // PAN / VAT and Cashier Config
  const [customPan, setCustomPan] = useState<string>('');
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [activeStaffName, setActiveStaffName] = useState<string>('Counter Cashier');

  // Load custom PAN & Active Staff from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPan = localStorage.getItem('restroastra_hotel_pan') || hotelPan || '';
      setCustomPan(storedPan);

      try {
        const staffJson = localStorage.getItem('restroastra_active_staff');
        if (staffJson) {
          const parsed = JSON.parse(staffJson);
          if (parsed?.name) {
            setActiveStaffName(parsed.name);
          }
        }
      } catch {}
    }
  }, [hotelPan]);

  // Set default mode when order or isTableBill changes
  useEffect(() => {
    if (order) {
      const isSettledOrDone =
        order.status === 'done' ||
        (order.status as string) === 'settled' ||
        (order.status as string) === 'completed';
      if (isTableBill || isSettledOrDone) {
        setPrintMode('bill');
      } else {
        setPrintMode('kot');
      }
    }
  }, [order, isTableBill]);

  // Parse items
  const items: OrderItem[] = useMemo(() => {
    if (!order) return [];
    try {
      return typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    } catch {
      return [];
    }
  }, [order]);

  // Compute raw subtotal from item lines
  const subtotal = useMemo(() => {
    if (!order) return 0;
    const raw = items.reduce(
      (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
      0
    );
    if (raw > 0) return raw;
    return (order.totalAmount || 0) + (order.discountAmount || 0);
  }, [order, items]);

  // Total quantity of items for summary
  const totalItemCount = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
  }, [items]);

  // Initialize or reset discount state when order changes
  useEffect(() => {
    if (order) {
      const initialDiscount = order.discountAmount || 0;
      setSavedDiscount(initialDiscount);
      if (initialDiscount > 0 && subtotal > 0) {
        const pct = Math.round((initialDiscount / subtotal) * 100);
        if (Math.abs((subtotal * pct) / 100 - initialDiscount) < 1) {
          setDiscountMode('percent');
          setDiscountInput(String(pct));
        } else {
          setDiscountMode('fixed');
          setDiscountInput(String(initialDiscount));
        }
      } else {
        setDiscountMode('percent');
        setDiscountInput('0');
      }
      setDiscountReason('');
      setSaveMessage(null);
    }
  }, [order, subtotal]);

  // Add/remove printing-thermal-receipt class on body
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('printing-thermal-receipt');
    } else {
      document.body.classList.remove('printing-thermal-receipt');
    }
    return () => {
      document.body.classList.remove('printing-thermal-receipt');
    };
  }, [isOpen]);

  // Compute calculated discount and final payable
  const { calculatedDiscount, discountPercent, finalTotal } = useMemo(() => {
    const rawVal = parseFloat(discountInput) || 0;
    let disc = 0;
    let pct = 0;

    if (discountMode === 'percent') {
      pct = Math.min(100, Math.max(0, rawVal));
      disc = Math.round((subtotal * pct) / 100);
    } else {
      disc = Math.min(subtotal, Math.max(0, rawVal));
      pct = subtotal > 0 ? Math.round((disc / subtotal) * 100) : 0;
    }

    const total = Math.max(0, Math.round(subtotal - disc));
    return { calculatedDiscount: disc, discountPercent: pct, finalTotal: total };
  }, [subtotal, discountMode, discountInput]);

  const hasUnsavedDiscountChanges = calculatedDiscount !== savedDiscount;

  // Apply & Save Discount to Order(s)
  const handleSaveDiscount = async (): Promise<boolean> => {
    if (!order) return false;
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch('/api/hotel/orders/discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          tableNumber: order.tableNumber,
          isTableBill: !!isTableBill,
          discountAmount: calculatedDiscount,
          discountPercent,
          reason: discountReason.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSavedDiscount(calculatedDiscount);
        setSaveMessage('Discount saved successfully!');
        setTimeout(() => setSaveMessage(null), 3000);
        if (onOrderUpdated) {
          onOrderUpdated(data.order || data.orders);
        }
        return true;
      } else {
        setSaveMessage(data.error || 'Failed to save discount');
        return false;
      }
    } catch (err) {
      console.error(err);
      setSaveMessage('Error saving discount');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePan = (val: string) => {
    setCustomPan(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('restroastra_hotel_pan', val.trim());
    }
  };

  // Print slip handler targeted to xLab XTKP-607UL
  const handlePrint = async () => {
    if (printMode === 'bill' && hasUnsavedDiscountChanges) {
      const saved = await handleSaveDiscount();
      if (!saved) {
        if (!confirm('Could not save discount to database. Print anyway?')) {
          return;
        }
      }
    }

    // Ensure class is on body for print styles
    document.body.classList.add('printing-thermal-receipt');

    // Give browser event loop a moment before opening print dialog
    setTimeout(() => {
      window.print();
    }, 60);
  };

  if (!isOpen || !order) return null;

  const displayTable = order.tableNumber.toLowerCase().includes('room')
    ? `ROOM #${order.tableNumber.replace(/^room\s*#?/i, '')}`
    : `TABLE #${order.tableNumber.replace(/^#/, '')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white print:static overflow-y-auto">
      {/* Dynamic Scoped Print Stylesheet for xLab Thermal Kitchen Printer XTKP-607UL */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: 80mm auto !important;
                margin: 0mm !important;
              }
              html, body {
                width: 80mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              /* Strict print isolation: Hide all non-receipt elements */
              body * {
                visibility: hidden !important;
              }
              #printable-receipt,
              #printable-receipt * {
                visibility: visible !important;
              }
              #printable-receipt {
                display: block !important;
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 72mm !important;
                max-width: 72mm !important;
                margin: 0 4mm !important;
                padding: 2mm 1mm 20mm 1mm !important;
                background: #ffffff !important;
                color: #000000 !important;
                font-family: 'Courier New', Courier, 'Lucida Console', Monaco, monospace !important;
                font-size: 11px !important;
                line-height: 1.3 !important;
                box-shadow: none !important;
                border: none !important;
                overflow: visible !important;
              }
              .xlab-thermal-hidden {
                display: none !important;
              }
            }
          `,
        }}
      />

      <div className="relative w-full max-w-xl bg-white text-stone-900 rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:w-full print:max-w-full border border-stone-200 my-auto">
        
        {/* ==================================================================== */}
        {/* MODAL CONTROL HEADER (Hidden in Print)                               */}
        {/* ==================================================================== */}
        <div className="px-5 py-3.5 bg-stone-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-serif font-bold text-xs tracking-wider uppercase text-white">
                  xLab Thermal Printer (XTKP-607UL)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  80mm Roll
                </span>
              </div>
              <p className="text-[10px] text-stone-400">Calibrated for 72mm printable width • Auto-Cutter ready</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              disabled={isSaving}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl transition flex items-center space-x-1.5 shadow-md active:scale-95"
              title="Send to xLab XTKP-607UL Thermal Printer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print to xLab</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* PRINTER SETTINGS & MODE SELECTOR TABS (Hidden in Print)              */}
        {/* ==================================================================== */}
        <div className="bg-stone-50 border-b border-stone-200 px-5 py-2.5 print:hidden flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Slip Mode Switcher: Bill vs KOT */}
          <div className="flex items-center bg-stone-200 p-0.5 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setPrintMode('bill')}
              className={`px-3 py-1 rounded-lg transition flex items-center space-x-1.5 ${
                printMode === 'bill'
                  ? 'bg-white text-stone-900 font-bold shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 text-amber-600" />
              <span>Customer Bill (Receipt)</span>
            </button>
            <button
              type="button"
              onClick={() => setPrintMode('kot')}
              className={`px-3 py-1 rounded-lg transition flex items-center space-x-1.5 ${
                printMode === 'kot'
                  ? 'bg-amber-600 text-white font-bold shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>Kitchen Ticket (KOT)</span>
            </button>
          </div>

          {/* Quick Toggle for Hotel PAN / VAT & Info */}
          <button
            type="button"
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className="flex items-center space-x-1 text-stone-600 hover:text-amber-700 font-medium text-[11px]"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isConfigOpen ? 'Hide Bill Header Config' : 'Configure PAN / Details'}</span>
          </button>
        </div>

        {/* Header Config Panel (Hidden in Print) */}
        {isConfigOpen && (
          <div className="p-3 bg-amber-50/60 border-b border-amber-200 print:hidden text-xs space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-stone-600 block mb-1">
                  Restaurant PAN / VAT No:
                </label>
                <input
                  type="text"
                  value={customPan}
                  onChange={(e) => handleSavePan(e.target.value)}
                  placeholder="e.g. 601234567"
                  className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1 text-xs text-stone-900 font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-600 block mb-1">
                  Active Billed By (Cashier):
                </label>
                <input
                  type="text"
                  value={activeStaffName}
                  onChange={(e) => setActiveStaffName(e.target.value)}
                  placeholder="e.g. Sunita Rai"
                  className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1 text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
            <p className="text-[10px] text-stone-500">
              * PAN / VAT is auto-saved in local browser memory and printed on customer tax invoices.
            </p>
          </div>
        )}

        {/* ==================================================================== */}
        {/* DISCOUNT CONTROL PANEL (Customer Bill Only - Hidden in Print)        */}
        {/* ==================================================================== */}
        {printMode === 'bill' && (
          <div className="px-5 py-3.5 bg-stone-50/70 border-b border-stone-200 print:hidden space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-stone-700">
                <Tag className="w-3.5 h-3.5 text-amber-600" />
                <span>Bill Discount</span>
                {savedDiscount > 0 && (
                  <span className="ml-1.5 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-md font-bold">
                    Active: -{formatNPR(savedDiscount)}
                  </span>
                )}
              </div>

              {/* Mode Switcher (% vs Rs) */}
              <div className="flex items-center bg-stone-200/80 p-0.5 rounded-lg border border-stone-300 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setDiscountMode('percent')}
                  className={`px-2.5 py-0.5 rounded-md transition ${
                    discountMode === 'percent'
                      ? 'bg-amber-600 text-white font-bold shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  % Percent
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountMode('fixed')}
                  className={`px-2.5 py-0.5 rounded-md transition ${
                    discountMode === 'fixed'
                      ? 'bg-amber-600 text-white font-bold shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Rs Flat (NPR)
                </button>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[0, 5, 10, 15, 20].map((pct) => {
                const isSelected = discountMode === 'percent' && parseFloat(discountInput) === pct;
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      setDiscountMode('percent');
                      setDiscountInput(String(pct));
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                      isSelected
                        ? 'bg-amber-50 border-amber-400 text-amber-800 shadow-xs'
                        : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {pct === 0 ? 'No Discount (0%)' : `${pct}% Off`}
                  </button>
                );
              })}
            </div>

            {/* Custom Discount Input + Reason + Save */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-0.5">
              <div className="sm:col-span-4 relative">
                <input
                  type="number"
                  min="0"
                  max={discountMode === 'percent' ? 100 : subtotal}
                  step="any"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder={discountMode === 'percent' ? 'e.g. 10' : 'e.g. 150'}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-1.5 text-xs text-stone-900 font-mono focus:outline-none focus:border-amber-500 placeholder:text-stone-400"
                />
                <span className="absolute right-3 top-1.5 text-xs font-bold text-stone-400 pointer-events-none">
                  {discountMode === 'percent' ? '%' : 'NPR'}
                </span>
              </div>

              <div className="sm:col-span-5">
                <input
                  type="text"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="Reason (e.g. Regular, Promo)"
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-1.5 text-xs text-stone-900 focus:outline-none focus:border-amber-500 placeholder:text-stone-400"
                />
              </div>

              <div className="sm:col-span-3 flex items-center">
                <button
                  type="button"
                  onClick={() => handleSaveDiscount()}
                  disabled={isSaving}
                  className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition ${
                    hasUnsavedDiscountChanges
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 active:scale-95'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {isSaving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>{hasUnsavedDiscountChanges ? 'Save' : 'Saved'}</span>
                </button>
              </div>
            </div>

            {saveMessage && (
              <div className="text-[11px] font-medium text-emerald-700 flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{saveMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* THERMAL RECEIPT DISPLAY CONTAINER (Target: xLab XTKP-607UL 80mm)      */}
        {/* On screen: Styled preview (320px). In print: Exact 72mm width.       */}
        {/* ==================================================================== */}
        <div className="bg-stone-200/70 p-3 sm:p-5 max-h-[65vh] overflow-y-auto print:max-h-none print:p-0 print:bg-white print:overflow-visible flex justify-center">
          
          <div
            id="printable-receipt"
            className="w-full max-w-[340px] bg-white text-black p-4 rounded-lg shadow-md border border-stone-300 print:shadow-none print:border-none print:rounded-none font-mono text-xs leading-tight"
            style={{
              color: '#000000',
              fontFamily: "'Courier New', Courier, 'Lucida Console', Monaco, monospace",
            }}
          >

            {/* ================================================================ */}
            {/* VIEW A: CUSTOMER BILL / TAX INVOICE (xLab XTKP-607UL Calibrated) */}
            {/* ================================================================ */}
            {printMode === 'bill' && (
              <div>
                {/* Restaurant Brand Header */}
                <div className="text-center pb-2">
                  <h1 className="text-base font-black tracking-wider uppercase leading-snug">
                    {hotelName}
                  </h1>
                  {hotelAddress && (
                    <p className="text-[11px] text-black mt-0.5 leading-tight">{hotelAddress}</p>
                  )}
                  {hotelPhone && (
                    <p className="text-[11px] text-black mt-0.5 leading-tight">Tel: {hotelPhone}</p>
                  )}
                  {customPan && (
                    <p className="text-[11px] font-bold text-black mt-0.5 tracking-wider">
                      PAN / VAT NO: {customPan}
                    </p>
                  )}
                  <div className="mt-1.5 py-0.5 px-2 inline-block border border-black font-bold text-[11px] tracking-widest uppercase">
                    {isTableBill ? 'FINAL TABLE INVOICE' : 'TAX INVOICE / RECEIPT'}
                  </div>
                </div>

                {/* Dashed Divider */}
                <div className="border-t border-dashed border-black my-2" />

                {/* Receipt Metadata */}
                <div className="text-[11px] space-y-1">
                  <div className="flex justify-between font-bold text-xs">
                    <span>{displayTable}</span>
                    <span>#{order.id.slice(-6).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date: {formatDate(order.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Billed By: {activeStaffName}</span>
                  </div>
                  {order.customerName && (
                    <div className="flex justify-between">
                      <span>Guest: {order.customerName}</span>
                    </div>
                  )}
                  {order.customerPhone && (
                    <div className="flex justify-between">
                      <span>Phone: {order.customerPhone}</span>
                    </div>
                  )}
                </div>

                {/* Double Dashed Divider */}
                <div className="border-t border-dashed border-black my-2" />

                {/* Line Items Table Header */}
                <div className="flex justify-between font-bold text-[11px] uppercase pb-1 border-b border-black">
                  <span className="w-8">QTY</span>
                  <span className="flex-1 px-1">ITEM</span>
                  <span className="w-12 text-right">RATE</span>
                  <span className="w-14 text-right">TOTAL</span>
                </div>

                {/* Items List */}
                <div className="divide-y divide-dashed divide-stone-300 py-1">
                  {items.map((item, idx) => {
                    const lineTotal = Number(item.price) * Number(item.quantity);
                    return (
                      <div key={idx} className="py-1 text-[11px]">
                        <div className="flex justify-between items-start font-medium">
                          <span className="w-8 font-bold text-black">{item.quantity}x</span>
                          <span className="flex-1 px-1 font-bold text-black leading-tight">
                            {item.name}
                          </span>
                          <span className="w-12 text-right text-black whitespace-nowrap">
                            {item.price}
                          </span>
                          <span className="w-14 text-right font-bold text-black whitespace-nowrap">
                            {lineTotal}
                          </span>
                        </div>
                        {item.notes && (
                          <p className="text-[10px] pl-8 mt-0.5 italic text-black">
                            * {item.notes}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Special Instructions (if any) */}
                {order.notes && (
                  <div className="my-1.5 p-1 border border-dashed border-black text-[10px]">
                    <span className="font-bold">NOTE: </span>
                    {order.notes}
                  </div>
                )}

                {/* Dashed Divider */}
                <div className="border-t border-dashed border-black my-2" />

                {/* Financial Summary */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Total Items ({totalItemCount}):</span>
                    <span>{formatNPR(subtotal)}</span>
                  </div>

                  {calculatedDiscount > 0 && (
                    <div className="flex justify-between font-bold">
                      <span>Discount ({discountPercent}%{discountReason ? ` - ${discountReason}` : ''}):</span>
                      <span>-{formatNPR(calculatedDiscount)}</span>
                    </div>
                  )}

                  {/* Grand Net Total */}
                  <div className="border-t-2 border-b-2 border-black py-1 my-1 flex justify-between items-baseline font-black text-sm">
                    <span className="tracking-wider uppercase">NET PAYABLE:</span>
                    <span className="text-base">{formatNPR(finalTotal)}</span>
                  </div>

                  {/* Payment Details */}
                  <div className="flex justify-between text-[11px] pt-0.5">
                    <span className="font-bold">PAYMENT:</span>
                    <span className="font-black uppercase">
                      {order.status === 'done' ||
                      (order.status as string) === 'settled' ||
                      (order.status as string) === 'completed'
                        ? String(order.paymentMethod || '').toLowerCase().includes('online')
                          ? 'PAID VIA ONLINE (QR)'
                          : 'PAID VIA CASH'
                        : 'PENDING SETTLEMENT'}
                    </span>
                  </div>
                </div>

                {/* Bill Footer */}
                <div className="text-center pt-3 mt-2 border-t border-dashed border-black text-[10px]">
                  <p className="font-bold uppercase tracking-widest">
                    Thank You For Dining With Us!
                  </p>
                  <p className="mt-0.5">Please Visit Again</p>
                  <p className="text-[9px] mt-1 text-black font-mono">
                    RestroAstra POS • xLab XTKP-607UL
                  </p>
                </div>
              </div>
            )}

            {/* ================================================================ */}
            {/* VIEW B: KITCHEN ORDER TICKET (KOT) (xLab XTKP-607UL Calibrated)  */}
            {/* ================================================================ */}
            {printMode === 'kot' && (
              <div>
                {/* KOT Header */}
                <div className="text-center pb-2">
                  <div className="text-xs font-black tracking-widest uppercase py-0.5 px-2 border-2 border-black inline-block">
                    *** KITCHEN ORDER TICKET ***
                  </div>
                  <p className="text-[10px] mt-1 font-bold">{hotelName}</p>
                </div>

                {/* Big Table / Room Banner */}
                <div className="border-2 border-black p-1.5 text-center my-2 bg-black text-white print:bg-white print:text-black print:border-black">
                  <span className="text-base font-black tracking-widest uppercase">
                    &gt;&gt;&gt; {displayTable} &lt;&lt;&lt;
                  </span>
                </div>

                {/* KOT Metadata */}
                <div className="text-[11px] space-y-1 mb-2">
                  <div className="flex justify-between font-bold">
                    <span>KOT TOKEN: #{order.id.slice(-6).toUpperCase()}</span>
                    <span>{formatDate(order.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Waiter / Captain: {activeStaffName}</span>
                    <span>Status: {order.status.toUpperCase()}</span>
                  </div>
                </div>

                {/* Solid Divider */}
                <div className="border-t-2 border-black my-2" />

                {/* Kitchen Items - Bold & Big for Rapid Chef Reading */}
                <div className="space-y-2 py-1">
                  {items.map((item, idx) => (
                    <div key={idx} className="border-b border-dashed border-stone-400 pb-1.5">
                      <div className="flex items-start text-xs font-black leading-snug">
                        <span className="w-10 text-sm font-black mr-1">[ {item.quantity}x ]</span>
                        <span className="flex-1 uppercase">{item.name}</span>
                      </div>
                      {item.notes && (
                        <div className="mt-1 pl-11 text-[11px] font-bold text-black italic">
                          *** PREP NOTE: {item.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Kitchen Order Instructions */}
                {order.notes && (
                  <div className="my-2 p-1.5 border-2 border-black text-xs font-bold bg-stone-100 print:bg-white">
                    <span className="uppercase">CHEF INSTRUCTION: </span>
                    <span>{order.notes}</span>
                  </div>
                )}

                {/* KOT Footer */}
                <div className="border-t-2 border-black mt-3 pt-2 text-center text-[10px] font-bold uppercase tracking-wider">
                  *** DISPATCH TO KITCHEN / BAR ***
                  <p className="text-[9px] font-normal mt-0.5">Printed on xLab XTKP-607UL (80mm)</p>
                </div>
              </div>
            )}

            {/* ================================================================ */}
            {/* AUTO-CUTTER FEED MARGIN (Crucial for xLab XTKP-607UL)            */}
            {/* Advance paper 18mm so cutter blade slices below the footer!      */}
            {/* ================================================================ */}
            <div className="pt-6 mt-3 text-center border-t border-dashed border-stone-400 text-[10px] text-stone-500 print:text-black">
              <div className="flex items-center justify-center space-x-1 font-mono text-[9px]">
                <Scissors className="w-3 h-3 inline" />
                <span>- - - - - - - - - - - - - - - - - - - - ✂</span>
              </div>
              <p className="text-[8px] mt-1 text-stone-400 print:hidden">
                xLab XTKP-607UL Auto-Cutter Clearance Area (18mm)
              </p>
            </div>

          </div>
        </div>

        {/* Modal Footer Controls (Hidden in Print) */}
        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 print:hidden flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5 text-stone-500 text-[11px]">
            <Printer className="w-3.5 h-3.5 text-amber-600" />
            <span>Target: xLab XTKP-607UL (80mm Roll • 72mm Width)</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isSaving}
              className="px-4 py-1.5 bronze-btn text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-sm active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print {printMode === 'kot' ? 'KOT' : 'Bill'} (xLab)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
