/**
 * QRScanner — Live camera QR/barcode scanner using jsQR (pure JS).
 * Mobile-first, full-screen overlay, environment-facing camera.
 * Falls back to file input (gallery photo) if camera unavailable.
 */
import React, { useRef, useState, useEffect, useCallback } from "react";
import { QrCode, X, Upload } from "lucide-react";

const BARCODE_FORMATS = ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "codabar", "data_matrix"];

export interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animRef = useRef<number | undefined>(undefined);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = undefined;
    }
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
      }
    } catch {
      setError("Caméra non accessible. Vérifiez les permissions ou utilisez une photo.");
    }
  }, []);

  const scan = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !scanning) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx || video.readyState !== 4) {
      animRef.current = requestAnimationFrame(scan);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    try {
      const BarcodeDetectorCtor = (window as any).BarcodeDetector;
      if (BarcodeDetectorCtor) {
        const detector = new BarcodeDetectorCtor({ formats: BARCODE_FORMATS });
        const codes = await detector.detect(canvas);
        const value = codes?.[0]?.rawValue;
        if (value) {
          stopCamera();
          onScan(value);
          return;
        }
      }

      const jsQR = (await import("jsqr")).default;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        stopCamera();
        onScan(code.data);
        return;
      }
    } catch {
      // jsQR import failed — keep looping; user can use file fallback
    }
    animRef.current = requestAnimationFrame(scan);
  }, [scanning, stopCamera, onScan]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  useEffect(() => {
    if (scanning) {
      animRef.current = requestAnimationFrame(scan);
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [scanning, scan]);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.onload = async () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      try {
        const BarcodeDetectorCtor = (window as any).BarcodeDetector;
        if (BarcodeDetectorCtor) {
          const detector = new BarcodeDetectorCtor({ formats: BARCODE_FORMATS });
          const codes = await detector.detect(canvas);
          const value = codes?.[0]?.rawValue;
          if (value) {
            stopCamera();
            onScan(value);
            return;
          }
        }

        const jsQR = (await import("jsqr")).default;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          stopCamera();
          onScan(code.data);
        } else {
          setError("Aucun code détecté sur cette photo. Entrez le numéro manuellement.");
        }
      } catch {
        setError("Lecture impossible. Entrez le numéro manuellement.");
      }
    };
    img.src = URL.createObjectURL(file);
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 bg-slate-950/95 border-b border-slate-800">
        <div className="flex items-center gap-2 text-white font-semibold">
          <QrCode className="h-5 w-5 text-sky-400" />
          Scanner l'équipement
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="min-h-[44px] min-w-[44px] rounded-full text-white flex items-center justify-center"
          aria-label="Fermer le scanner"
        >
          <X className="h-6 w-6" />
        </button>
      </header>

      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-white text-sm">{error}</p>
          <label className="min-h-[56px] px-6 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center gap-2 cursor-pointer">
            <Upload className="h-5 w-5" />
            Scanner depuis une photo
            <input type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
          </label>
        </div>
      ) : (
        <div className="relative flex-1 bg-black overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 border-4 border-sky-400 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
          </div>
          <p className="absolute bottom-24 left-0 right-0 text-center text-white text-sm font-semibold drop-shadow">
            Centrez le QR code dans le cadre
          </p>
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <label
              className="min-h-[48px] px-5 rounded-full bg-slate-900/90 border border-slate-700 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              Utiliser une photo
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileInput}
              />
            </label>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
