'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, X, QrCode, AlertCircle, RefreshCw, CheckCircle2, Sparkles } from 'lucide-react';

interface TableQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotelSlug?: string;
  expectedTableNumber?: string;
  onScanSuccess?: (tableNumber: string, url: string) => void;
}

export default function TableQRScannerModal({
  isOpen,
  onClose,
  hotelSlug,
  expectedTableNumber,
  onScanSuccess,
}: TableQRScannerModalProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setScannedResult(null);
      setIsProcessing(false);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCamera(false);
        setCameraError('Camera access is not supported by your browser. Please scan with your phone camera app.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        startDetection();
      }
    } catch (err: any) {
      console.warn('Camera start error:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access in your browser settings, or use your phone camera.'
          : 'Could not access camera. Please point your phone camera at the QR code directly.'
      );
    }
  };

  const startDetection = () => {
    // If BarcodeDetector is available natively (Chrome/Android/modern Safari)
    if ('BarcodeDetector' in window) {
      const barcodeDetector = new (window as any).BarcodeDetector({
        formats: ['qr_code'],
      });

      const detectFrame = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          animationFrameRef.current = requestAnimationFrame(detectFrame);
          return;
        }

        try {
          const barcodes = await barcodeDetector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            handleDetectedCode(rawValue);
            return;
          }
        } catch {}

        animationFrameRef.current = requestAnimationFrame(detectFrame);
      };

      animationFrameRef.current = requestAnimationFrame(detectFrame);
    }
  };

  const handleDetectedCode = (rawValue: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    stopCamera();

    try {
      // Parse QR URL or plain string
      let parsedTable = expectedTableNumber || '';
      let targetSlug = hotelSlug || '';

      if (rawValue.includes('table=')) {
        try {
          const urlObj = new URL(rawValue, window.location.origin);
          const tParam = urlObj.searchParams.get('table');
          if (tParam) parsedTable = tParam;

          const pathMatch = urlObj.pathname.match(/\/menu\/([^/?#]+)/);
          if (pathMatch && pathMatch[1]) targetSlug = pathMatch[1];
        } catch {
          const match = rawValue.match(/table=([^&]+)/);
          if (match && match[1]) parsedTable = decodeURIComponent(match[1]);
        }
      }

      setScannedResult(parsedTable || 'Table QR Verified');

      setTimeout(() => {
        if (typeof window !== 'undefined' && targetSlug && parsedTable) {
          try {
            sessionStorage.removeItem(`table_session_ended_${targetSlug}_${parsedTable}`);
            sessionStorage.setItem(`session_time_${targetSlug}_${parsedTable}`, new Date().toISOString());
            localStorage.setItem(`last_table_${targetSlug}`, parsedTable);
          } catch {}
        }

        if (onScanSuccess) {
          onScanSuccess(parsedTable, rawValue);
        } else if (targetSlug) {
          router.push(`/menu/${targetSlug}?table=${encodeURIComponent(parsedTable)}&qr=1&scan=true&t=${Date.now()}`);
        }
        onClose();
      }, 900);
    } catch (e) {
      console.error('Error parsing QR code:', e);
      setIsProcessing(false);
      startCamera();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm bg-white border border-stone-200 rounded-3xl p-6 text-center shadow-2xl space-y-4 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto border border-amber-300">
          <QrCode className="w-6 h-6 animate-pulse" />
        </div>

        <div>
          <h3 className="text-lg font-serif font-bold text-stone-900">Scan Table QR Code</h3>
          <p className="text-xs text-stone-600 mt-1 leading-relaxed">
            Point your camera at the physical QR code on your table to start a new dining session.
          </p>
        </div>

        {/* Viewfinder / Camera Window */}
        <div className="relative w-full aspect-square max-w-[260px] mx-auto rounded-2xl overflow-hidden bg-black border-2 border-amber-500 shadow-inner flex items-center justify-center">
          {cameraError ? (
            <div className="p-4 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-[11px] text-stone-300 leading-tight">{cameraError}</p>
            </div>
          ) : scannedResult ? (
            <div className="p-4 text-center space-y-2 animate-fade-in">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
              <p className="text-sm font-bold text-white">Verified!</p>
              <p className="text-xs text-amber-300">Table #{scannedResult}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Animated laser scan bar */}
              <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#f59e0b] animate-bounce" />
              <div className="absolute inset-3 border-2 border-white/30 border-dashed rounded-xl pointer-events-none" />
            </>
          )}
        </div>

        {/* Instructions / Alternative */}
        <div className="pt-2 text-left space-y-2 bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
          <div className="flex items-start space-x-2 text-[11px] text-stone-700">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>
              You can also open your phone camera app and point it at the table stand to refresh your session directly.
            </span>
          </div>
        </div>

        {/* Helper Note */}
        <p className="text-[11px] text-stone-500">
          Digital Table Verification • Restro Smart QR
        </p>
      </div>
    </div>
  );
}
