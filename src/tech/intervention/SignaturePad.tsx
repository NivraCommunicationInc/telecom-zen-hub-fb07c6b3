import { useEffect, useRef, useState } from "react";

type Props = {
  onSubmit: (dataUrl: string) => void;
  disabled?: boolean;
};

export function SignaturePad({ onSubmit, disabled }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.strokeStyle = "#0b1220";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  const pos = (e: PointerEvent | React.PointerEvent) => {
    const canvas = ref.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDown = (e: React.PointerEvent) => {
    if (disabled) return;
    const canvas = ref.current!; canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath(); ctx.moveTo(x, y);
    setDrawing(true);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing || disabled) return;
    const ctx = ref.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y); ctx.stroke();
    setHasInk(true);
  };
  const onUp = () => setDrawing(false);

  const clear = () => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  const submit = () => {
    const url = ref.current!.toDataURL("image/png");
    onSubmit(url);
  };

  return (
    <div>
      <canvas
        ref={ref}
        className="tk-sig-canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button type="button" className="tk-btn tk-btn--ghost tk-btn--sm" onClick={clear} disabled={disabled || !hasInk}>Effacer</button>
        <button type="button" className="tk-btn tk-btn--sm" onClick={submit} disabled={disabled || !hasInk}>Enregistrer la signature</button>
      </div>
    </div>
  );
}
