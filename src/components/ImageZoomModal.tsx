'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  Hand,
  Maximize2,
} from 'lucide-react';
import { formatNPR, getCategoryDetails } from '@/lib/utils';

interface ImageZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  itemName: string;
  price?: number;
  category?: string;
  description?: string | null;
  onAddToCart?: () => void;
}

export default function ImageZoomModal({
  isOpen,
  onClose,
  imageUrl,
  itemName,
  price,
  category,
  description,
  onAddToCart,
}: ImageZoomModalProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Refs for tracking drag and touch coordinates
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef({ x: 0, y: 0 });
  const initialTouchDistRef = useRef<number | null>(null);
  const initialScaleRef = useRef(1);
  const lastTapRef = useRef<number>(0);

  // Reset zoom & position whenever modal opens or image changes
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, imageUrl]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleReset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(5, Number((prev + 0.5).toFixed(1))));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(1, Number((prev - 0.5).toFixed(1)));
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Double click / Double tap handler
  const handleDoubleTap = (clientX: number, clientY: number) => {
    if (scale > 1.2) {
      handleReset();
    } else {
      setScale(2.5);
      // Center slightly on tapped location if container exists
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const offsetX = (rect.width / 2 - (clientX - rect.left)) * 1.2;
        const offsetY = (rect.height / 2 - (clientY - rect.top)) * 1.2;
        setPosition({ x: offsetX, y: offsetY });
      }
    }
  };

  // Mouse Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    startPosRef.current = { ...position };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    setPosition({
      x: startPosRef.current.x + deltaX,
      y: startPosRef.current.y + deltaY,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Mouse Wheel Zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    setScale((prev) => {
      const next = Math.min(5, Math.max(1, Number((prev + delta).toFixed(2))));
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // Touch Handlers for Mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Check for double-tap
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        handleDoubleTap(e.touches[0].clientX, e.touches[0].clientY);
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      setIsDragging(true);
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      startPosRef.current = { ...position };
    } else if (e.touches.length === 2) {
      // Pinch to zoom start
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialTouchDistRef.current = dist;
      initialScaleRef.current = scale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const deltaX = e.touches[0].clientX - dragStartRef.current.x;
      const deltaY = e.touches[0].clientY - dragStartRef.current.y;
      setPosition({
        x: startPosRef.current.x + deltaX,
        y: startPosRef.current.y + deltaY,
      });
    } else if (e.touches.length === 2 && initialTouchDistRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / initialTouchDistRef.current;
      const nextScale = Math.min(
        5,
        Math.max(1, Number((initialScaleRef.current * factor).toFixed(2)))
      );
      setScale(nextScale);
      if (nextScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    initialTouchDistRef.current = null;
    if (scale <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  };

  if (!isOpen) return null;

  const categoryInfo = category ? getCategoryDetails(category) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-900/60 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-2xl bg-white border border-stone-200 rounded-3xl shadow-2xl overflow-hidden text-stone-800 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200 bg-stone-50 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-300 shrink-0">
              <Maximize2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-serif font-bold text-stone-900 text-sm sm:text-base leading-tight truncate">
                {itemName}
              </h3>
              <div className="flex items-center space-x-2 text-xs">
                {price !== undefined && (
                  <span className="text-amber-700 font-bold">{formatNPR(price)}</span>
                )}
                {categoryInfo && (
                  <span className="text-stone-500 text-[11px] flex items-center space-x-1">
                    <span>•</span>
                    <span>{categoryInfo.icon}</span>
                    <span>{categoryInfo.label}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Image Viewport */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`relative w-full h-80 sm:h-[420px] bg-stone-100 overflow-hidden flex items-center justify-center ${
            isDragging ? 'cursor-grabbing' : scale > 1 ? 'cursor-grab' : 'cursor-zoom-in'
          }`}
        >
          {/* Draggable & Scalable Image */}
          <div
            style={{
              transform: `translate3d(${position.x}px, ${position.y}px, 0px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0, 0.2, 1)',
            }}
            className="relative max-w-full max-h-full flex items-center justify-center pointer-events-none"
          >
            <img
              src={imageUrl}
              alt={itemName}
              draggable={false}
              className="max-h-72 sm:max-h-[380px] max-w-full object-contain rounded-xl shadow-xl drop-shadow-[0_10px_25px_rgba(0,0,0,0.15)]"
            />
          </div>

          {/* Floating Instructions Banner */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 bg-white/90 backdrop-blur-md border border-stone-200 rounded-full flex items-center space-x-1.5 text-[11px] text-stone-700 pointer-events-none shadow-md">
            <Hand className="w-3.5 h-3.5 text-amber-600" />
            <span>Pinch / Scroll to zoom • Drag to look around</span>
          </div>

          {/* Zoom Control Bar (Bottom Overlay) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-white/95 backdrop-blur-xl border border-stone-200 rounded-2xl flex items-center space-x-3 shadow-xl text-xs z-10">
            <button
              onClick={handleZoomOut}
              disabled={scale <= 1}
              className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <span className="font-mono text-amber-700 font-bold min-w-[45px] text-center text-[11px]">
              {Math.round(scale * 100)}%
            </span>

            <button
              onClick={handleZoomIn}
              disabled={scale >= 5}
              className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-stone-300" />

            <button
              onClick={handleReset}
              className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition flex items-center space-x-1 text-[11px]"
              title="Reset Zoom (Double tap / 0)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Footer & Actions */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            {description ? (
              <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                {description}
              </p>
            ) : (
              <p className="text-[11px] text-stone-500 uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>High-Definition Digital Culinary View</span>
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {onAddToCart && price !== undefined && (
              <button
                onClick={() => {
                  onAddToCart();
                  onClose();
                }}
                className="px-5 py-2 rounded-xl gold-btn text-xs font-bold shadow-gold-glow flex items-center space-x-1.5"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Add to Cart • {formatNPR(price)}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl dark-btn text-stone-700 border border-stone-200 text-xs font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
