/**
 * SignaturePad — Touch/mouse signature canvas.
 * Saves as base64 PNG. Mobile-first with large touch surface.
 */
import React, { useRef, useState, useEffect } from "react";
import { Eraser, Check } from "lucide-react";
import SignaturePadLib from "signature_pad";

export interface SignaturePadProps {
  onConfirm: (base64Png: string) => void;
}

export default function SignaturePad({ onConfirm }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const width = parent.clientWidth;
      const height = 220;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(ratio, ratio);
      padRef.current?.clear();
      setEmpty(true);
    };

    const pad = new SignaturePadLib(canvas, {
      backgroundColor: "rgba(255,255,255,1)",
      penColor: "rgb(15, 23, 42)",
    });
    padRef.current = pad;
    pad.addEventListener("endStroke", () => setEmpty(pad.isEmpty()));

    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      pad.off();
    };
  }, []);

  const clear = () => {
    padRef.current?.clear();
    setEmpty(true);
  };

  const confirm = () => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) return;
    const dataUrl = pad.toDataURL("image/png");
    onConfirm(dataUrl);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Veuillez demander au client de signer ci-dessous pour confirmer l'installation.
      </p>
      <div className="rounded-2xl overflow-hidden border-2 border-slate-700 bg-white">
        <canvas ref={canvasRef} className="touch-none block w-full" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={clear}
          disabled={empty}
          className="min-h-[48px] rounded-full bg-slate-800 border border-slate-700 text-slate-200 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Eraser className="h-4 w-4" /> Effacer
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={empty}
          className="min-h-[48px] rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Check className="h-4 w-4" /> Confirmer la signature
        </button>
      </div>
    </div>
  );
}
