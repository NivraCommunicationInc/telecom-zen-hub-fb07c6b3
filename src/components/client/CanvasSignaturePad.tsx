/**
 * CanvasSignaturePad — Lightweight touch/mouse canvas signature.
 * Returns base64 PNG via onConfirm. No external library needed.
 */
import { useRef, useEffect, useState } from "react";
import { Eraser, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CanvasSignaturePadProps {
  onConfirm: (base64Png: string) => void;
}

export default function CanvasSignaturePad({ onConfirm }: CanvasSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = parent.clientWidth;
      canvas.height = 200;
      ctx.putImageData(imageData, 0, 0);
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    };
    resize();
    window.addEventListener("resize", resize);

    const getPos = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const src = "touches" in e ? e.touches[0] : e;
      return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    };

    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      drawing.current = true;
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!drawing.current) return;
      e.preventDefault();
      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      setIsEmpty(false);
    };
    const stop = () => { drawing.current = false; };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", stop);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", stop);

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseup", stop);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", stop);
    };
  }, []);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  };

  const confirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) return;
    onConfirm(canvas.toDataURL("image/png"));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Dessinez votre signature ci-dessous</p>
      <div className="rounded-lg overflow-hidden border border-border bg-white cursor-crosshair">
        <canvas ref={canvasRef} className="touch-none block w-full" style={{ height: 200 }} />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clear} disabled={isEmpty} className="flex-1">
          <Eraser className="h-4 w-4 mr-1" /> Effacer
        </Button>
        <Button type="button" variant="hero" size="sm" onClick={confirm} disabled={isEmpty} className="flex-1">
          <Check className="h-4 w-4 mr-1" /> Confirmer
        </Button>
      </div>
    </div>
  );
}
