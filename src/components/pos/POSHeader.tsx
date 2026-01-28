import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface POSHeaderProps {
  repName?: string;
}

export function POSHeader({ repName }: POSHeaderProps) {
  const navigate = useNavigate();
  
  return (
    <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-slate-400">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <div>
              <h1 className="text-white font-bold">NIVRA <span className="text-orange-400 text-sm">POS</span></h1>
              <p className="text-slate-400 text-xs">Point de Vente</p>
            </div>
          </div>
        </div>
        {repName && <span className="text-sm text-slate-400">{repName}</span>}
      </div>
    </div>
  );
}
