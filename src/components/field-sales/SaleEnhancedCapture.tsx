/**
 * SaleEnhancedCapture - GPS, Photos, and Signature capture for field sales
 * Used in the confirmation step before final submission
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Camera, PenTool, Check, ChevronDown, ChevronUp } from "lucide-react";
import { GPSCapture } from "./GPSCapture";
import { PhotoCapture } from "./PhotoCapture";
import { SignatureCanvas } from "./SignatureCanvas";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface GPSData {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
}

interface EnhancedCaptureData {
  gps: GPSData | null;
  idPhotoUrl: string | null;
  locationPhotoUrl: string | null;
  signatureData: string | null;
}

interface SaleEnhancedCaptureProps {
  customerName: string;
  onDataChange: (data: EnhancedCaptureData) => void;
  initialData?: Partial<EnhancedCaptureData>;
}

export function SaleEnhancedCapture({ 
  customerName, 
  onDataChange, 
  initialData 
}: SaleEnhancedCaptureProps) {
  const [captureData, setCaptureData] = useState<EnhancedCaptureData>({
    gps: initialData?.gps || null,
    idPhotoUrl: initialData?.idPhotoUrl || null,
    locationPhotoUrl: initialData?.locationPhotoUrl || null,
    signatureData: initialData?.signatureData || null,
  });

  const [showSignature, setShowSignature] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState({
    gps: true,
    photos: true,
    signature: true,
  });

  const updateData = (partial: Partial<EnhancedCaptureData>) => {
    const newData = { ...captureData, ...partial };
    setCaptureData(newData);
    onDataChange(newData);
  };

  const completionStatus = {
    gps: !!captureData.gps,
    idPhoto: !!captureData.idPhotoUrl,
    locationPhoto: !!captureData.locationPhotoUrl,
    signature: !!captureData.signatureData,
  };

  const totalCompleted = Object.values(completionStatus).filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
        <span className="text-sm text-slate-400">Données capturées</span>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[completionStatus.gps, completionStatus.idPhoto, completionStatus.signature].map((done, i) => (
              <div 
                key={i} 
                className={cn(
                  "w-2 h-2 rounded-full",
                  done ? "bg-emerald-400" : "bg-slate-600"
                )}
              />
            ))}
          </div>
          <span className="text-xs text-slate-500">{totalCompleted}/4</span>
        </div>
      </div>

      {/* GPS Section */}
      <Collapsible 
        open={sectionsOpen.gps} 
        onOpenChange={(open) => setSectionsOpen(s => ({ ...s, gps: open }))}
      >
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700 hover:bg-slate-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <MapPin className={cn(
                "h-5 w-5",
                completionStatus.gps ? "text-emerald-400" : "text-slate-500"
              )} />
              <span className="text-white font-medium">Localisation GPS</span>
              {completionStatus.gps && <Check className="h-4 w-4 text-emerald-400" />}
            </div>
            {sectionsOpen.gps ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <GPSCapture 
            onCapture={(data) => updateData({ gps: data })}
            capturedData={captureData.gps}
          />
        </CollapsibleContent>
      </Collapsible>

      {/* Photos Section */}
      <Collapsible 
        open={sectionsOpen.photos} 
        onOpenChange={(open) => setSectionsOpen(s => ({ ...s, photos: open }))}
      >
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700 hover:bg-slate-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <Camera className={cn(
                "h-5 w-5",
                (completionStatus.idPhoto || completionStatus.locationPhoto) ? "text-emerald-400" : "text-slate-500"
              )} />
              <span className="text-white font-medium">Photos</span>
              {completionStatus.idPhoto && completionStatus.locationPhoto && <Check className="h-4 w-4 text-emerald-400" />}
            </div>
            {sectionsOpen.photos ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 space-y-3">
          <PhotoCapture
            label="Pièce d'identité client"
            description="Photo de la carte d'identité du client"
            onUpload={(url) => updateData({ idPhotoUrl: url })}
            currentUrl={captureData.idPhotoUrl}
            folder="field-sales/id-photos"
          />
          <PhotoCapture
            label="Photo de l'adresse"
            description="Photo de la façade ou du numéro civique"
            onUpload={(url) => updateData({ locationPhotoUrl: url })}
            currentUrl={captureData.locationPhotoUrl}
            folder="field-sales/location-photos"
          />
        </CollapsibleContent>
      </Collapsible>

      {/* Signature Section */}
      <Collapsible 
        open={sectionsOpen.signature} 
        onOpenChange={(open) => setSectionsOpen(s => ({ ...s, signature: open }))}
      >
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700 hover:bg-slate-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <PenTool className={cn(
                "h-5 w-5",
                completionStatus.signature ? "text-emerald-400" : "text-slate-500"
              )} />
              <span className="text-white font-medium">Signature client</span>
              {completionStatus.signature && <Check className="h-4 w-4 text-emerald-400" />}
            </div>
            {sectionsOpen.signature ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          {captureData.signatureData ? (
            <Card className="border-emerald-500/50 bg-emerald-500/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-emerald-400 font-medium">Signature capturée</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateData({ signatureData: null })}
                    className="text-slate-400 hover:text-white h-8"
                  >
                    Modifier
                  </Button>
                </div>
                <img 
                  src={captureData.signatureData} 
                  alt="Signature" 
                  className="max-h-24 bg-white rounded"
                />
              </CardContent>
            </Card>
          ) : (
            <SignatureCanvas
              customerName={customerName}
              onSave={(data) => updateData({ signatureData: data })}
            />
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
