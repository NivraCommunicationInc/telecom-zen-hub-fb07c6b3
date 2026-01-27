/**
 * SignatureCanvas - Touch-optimized signature capture for field sales
 * Captures customer signature on mobile/tablet devices
 */
import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PenTool, RotateCcw, Check, X } from "lucide-react";

interface SignatureCanvasProps {
  onSave: (signatureData: string) => void;
  onCancel?: () => void;
  customerName: string;
}

export function SignatureCanvas({ onSave, onCancel, customerName }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size for high DPI displays
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Set drawing styles
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Add signature line
    ctx.beginPath();
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.moveTo(20, rect.height - 40);
    ctx.lineTo(rect.width - 20, rect.height - 40);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;

    // Add "X" marker
    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px sans-serif";
    ctx.fillText("X", 20, rect.height - 45);
  }, []);

  const getCoordinates = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Redraw signature line
    ctx.beginPath();
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.moveTo(20, rect.height - 40);
    ctx.lineTo(rect.width - 20, rect.height - 40);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;

    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px sans-serif";
    ctx.fillText("X", 20, rect.height - 45);

    setHasSignature(false);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const signatureData = canvas.toDataURL("image/png");
    onSave(signatureData);
  };

  return (
    <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <PenTool className="h-5 w-5 text-orange-400" />
          Signature du client
        </CardTitle>
        <p className="text-sm text-slate-400">
          {customerName}, veuillez signer ci-dessous pour confirmer votre commande
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative bg-white rounded-lg overflow-hidden touch-none">
          <canvas
            ref={canvasRef}
            className="w-full h-48 cursor-crosshair"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearSignature}
            className="border-slate-600 text-slate-300"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Effacer
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="text-slate-400"
            >
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
          )}
          <Button
            type="button"
            onClick={saveSignature}
            disabled={!hasSignature}
            className="ml-auto bg-orange-500 hover:bg-orange-400 text-white"
          >
            <Check className="h-4 w-4 mr-2" />
            Confirmer
          </Button>
        </div>

        <p className="text-xs text-slate-500 text-center">
          En signant, le client accepte les termes et conditions du service Nivra Telecom
        </p>
      </CardContent>
    </Card>
  );
}
