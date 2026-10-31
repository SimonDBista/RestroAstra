'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Printer, CheckCircle2, Percent, Tag, RefreshCw, AlertCircle } from 'lucide-react';
import { OrderData, OrderItem } from '@/lib/types';
import { formatNPR, formatDate } from '@/lib/utils';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderData | null;
  hotelName?: string;
  isTableBill?: boolean;
  onOrderUpdated?: (updatedOrder?: any) => void;
}

export default function ReceiptModal({
  isOpen,
  onClose,
  order,
  hotelName = 'Fine Dining Restaurant',
  isTableBill = false,
  onOrderUpdated,
}: ReceiptModalProps) {
  // Discount States
  const [discountMode, setDiscountMode] = useState<'percent' | 'fixed'>('percent');
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [discountReason, setDiscountReason] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedDiscount, setSavedDiscount] = useState<number>(0);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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

  // Print slip handler: auto-save if unsaved changes exist
  const handlePrint = async () => {
    if (hasUnsavedDiscountChanges) {
      const saved = await handleSaveDiscount();
      if (!saved) {
        if (!confirm('Could not save discount to database. Print anyway?')) {
          return;
        }
      }
    }
    window.print();
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white text-stone-900 rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:w-full print:max-w-full border border-stone-200 my-auto">
        
        {/* Modal Header (Hidden in Print) */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-stone-50 border-b border-stone-200 print:hidden">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-serif font-bold text-xs tracking-wider uppercase text-stone-900">
                  {isTableBill ? 'Table Billing Slip' : 'Order Receipt / KOT'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                  {order.tableNumber.toLowerCase().includes('room')
                    ? `Rooms #${order.tableNumber.replace(/^room\s*#?/i, '')}`
                    : `#${order.tableNumber.replace(/^#/, '')}`}
                </span>
              </div>
              <p className="text-[10px] text-stone-500">Review bill, apply discounts, or print thermal slip</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              disabled={isSaving}
              className="px-3.5 py-1.5 bronze-btn text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-sm active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Slip</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Discount Control Panel (Hidden in Print) */}
        <div className="px-5 py-4 bg-stone-50/70 border-b border-stone-200 print:hidden space-y-3">
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
                className={`px-2.5 py-1 rounded-md transition ${
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
                className={`px-2.5 py-1 rounded-md transition ${
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
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1">
            <div className="sm:col-span-4 relative">
              <input
                type="number"
                min="0"
                max={discountMode === 'percent' ? 100 : subtotal}
                step="any"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder={discountMode === 'percent' ? 'e.g. 10' : 'e.g. 150'}
                className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-900 font-mono focus:outline-none focus:border-amber-500 placeholder:text-stone-400"
              />
              <span className="absolute right-3 top-2 text-xs font-bold text-stone-400 pointer-events-none">
                {discountMode === 'percent' ? '%' : 'NPR'}
              </span>
            </div>

            <div className="sm:col-span-5">
              <input
                type="text"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="Reason (e.g. Regular, Promo)"
                className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-amber-500 placeholder:text-stone-400"
              />
            </div>

            <div className="sm:col-span-3 flex items-center">
              <button
                type="button"
                onClick={() => handleSaveDiscount()}
                disabled={isSaving}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition ${
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

          {/* Feedback message banner */}
          {saveMessage && (
            <div className="text-[11px] font-medium text-emerald-700 flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{saveMessage}</span>
            </div>
          )}
        </div>

        {/* Printable Thermal Receipt Paper Container */}
        <div className="p-4 sm:p-6 bg-stone-100 text-stone-900 font-mono text-xs leading-relaxed max-h-[70vh] overflow-y-auto print:max-h-none print:p-2 print:overflow-visible" id="printable-receipt">
          
          {/* Slip Header */}
          <div className="text-center border-b-2 border-dashed border-stone-400 pb-3 mb-3">
            <h2 className="text-base font-serif font-black tracking-wider uppercase text-stone-900">
              {hotelName}
            </h2>
            <p className="text-[10px] text-stone-600 mt-0.5 tracking-wide">
              {isTableBill ? 'FINAL TABLE BILL' : 'GUEST ORDER RECEIPT'}
            </p>
            <div className="mt-2 inline-block px-3 py-0.5 bg-stone-900 text-white rounded-md text-xs font-bold tracking-widest uppercase">
              {order.tableNumber.toLowerCase().includes('room')
                ? `ROOMS #${order.tableNumber.replace(/^room\s*#?/i, '')}`
                : `TABLE #${order.tableNumber}`}
            </div>
          </div>

          {/* Meta Info */}
          <div className="text-[11px] text-stone-700 space-y-1 mb-3">
            <div className="flex justify-between">
              <span className="text-stone-500">Bill / Order ID:</span>
              <span className="font-bold text-stone-900">
                #{order.id.slice(-6).toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Date & Time:</span>
              <span>{formatDate(order.createdAt)}</span>
            </div>
            {order.customerName && (
              <div className="flex justify-between">
                <span className="text-stone-500">Guest Name:</span>
                <span className="font-semibold text-stone-900">{order.customerName}</span>
              </div>
            )}
            {order.customerPhone && (
              <div className="flex justify-between">
                <span className="text-stone-500">Phone:</span>
                <span>{order.customerPhone}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-stone-500">Order Status:</span>
              <span className="uppercase font-bold text-stone-900">{order.status}</span>
            </div>
            {order.paymentMethod && (
              <div className="flex justify-between">
                <span className="text-stone-500">Payment Mode:</span>
                <span className="uppercase font-bold text-stone-900">
                  {String(order.paymentMethod || '').toLowerCase().includes('online')
                    ? 'Online (Fonepay/QR)'
                    : 'Cash'}
                </span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="border-t-2 border-dashed border-stone-400 pt-2.5 mb-3">
            <div className="flex justify-between text-[10px] font-bold text-stone-500 uppercase pb-1.5 border-b border-stone-300">
              <span className="w-8">Qty</span>
              <span className="flex-1 px-1.5">Item Name</span>
              <span className="text-right">Amount</span>
            </div>
            <div className="divide-y divide-stone-200/60 py-1">
              {items.map((item, idx) => (
                <div key={idx} className="py-1.5 text-[11px]">
                  <div className="flex justify-between items-start font-medium">
                    <span className="w-8 font-bold text-stone-900">{item.quantity}x</span>
                    <span className="flex-1 px-1.5 text-stone-900 leading-snug">{item.name}</span>
                    <span className="text-right font-semibold text-stone-900 whitespace-nowrap">
                      {formatNPR(Number(item.price) * Number(item.quantity))}
                    </span>
                  </div>
                  {item.notes && (
                    <p className="text-[10px] text-amber-800 pl-8 mt-0.5 italic">
                      * {item.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Special Instructions */}
          {order.notes && (
            <div className="p-2 bg-stone-200/70 border border-stone-300 rounded text-[10px] text-stone-800 mb-3">
              <span className="font-bold">Instructions: </span>
              {order.notes}
            </div>
          )}

          {/* Financial Breakdown (Subtotal, Discount, Net Total) */}
          <div className="border-t-2 border-dashed border-stone-400 pt-2.5 space-y-1.5">
            {/* Subtotal */}
            <div className="flex justify-between text-xs text-stone-700">
              <span>Subtotal:</span>
              <span className="font-semibold">{formatNPR(subtotal)}</span>
            </div>

            {/* Discount Line (if > 0) */}
            {calculatedDiscount > 0 && (
              <div className="flex justify-between text-xs text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                <span className="flex items-center space-x-1">
                  <span>Discount ({discountPercent}%):</span>
                  {discountReason && (
                    <span className="text-[10px] font-normal italic text-emerald-700">
                      ({discountReason})
                    </span>
                  )}
                </span>
                <span>-{formatNPR(calculatedDiscount)}</span>
              </div>
            )}

            {/* Final Amount Payable */}
            <div className="border-t-2 border-stone-900 pt-2 mt-1.5 flex justify-between items-baseline">
              <span className="text-xs font-black tracking-wider uppercase text-stone-900">
                TOTAL PAYABLE:
              </span>
              <span className="font-serif text-base font-black text-stone-950">
                {formatNPR(finalTotal)}
              </span>
            </div>

            {order.paymentMethod && (
              <div className="flex justify-between items-center text-[10px] text-stone-600 pt-1 border-t border-stone-200">
                <span>PAID VIA:</span>
                <span className="font-bold uppercase tracking-wider text-stone-900">
                  {String(order.paymentMethod || '').toLowerCase().includes('online')
                    ? 'Online Payment (QR/Card)'
                    : 'Cash Payment'}
                </span>
              </div>
            )}
          </div>

          {/* Thermal Slip Footer */}
          <div className="text-center pt-4 mt-4 border-t border-dashed border-stone-300 text-[10px] text-stone-600">
            <p className="font-bold text-stone-800 uppercase tracking-widest">
              Thank You For Dining With Us!
            </p>
            <p className="text-[9px] mt-0.5 text-stone-500">Digital Bill Generated via RestroAstra</p>
          </div>

        </div>

      </div>
    </div>
  );
}
