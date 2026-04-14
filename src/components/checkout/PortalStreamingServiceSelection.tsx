import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Play, Music, Film, Check } from "lucide-react";
import { 
  usePortalStreamingCatalogActive, 
  StreamingCatalogItem, 
  calculateStreamingTotal 
} from "@/hooks/usePortalStreamingCatalog";

interface PortalStreamingServiceSelectionProps {
  selectedServices: StreamingCatalogItem[];
  onServicesChange: (services: StreamingCatalogItem[]) => void;
  isFrench: boolean;
}

/**
 * Portal-only Streaming Service Selection.
 * Uses portal streaming catalog hook to avoid session conflicts with admin.
 */
export const PortalStreamingServiceSelection = ({
  selectedServices,
  onServicesChange,
  isFrench,
}: PortalStreamingServiceSelectionProps) => {
  const { data: services = [], isLoading, error } = usePortalStreamingCatalogActive();

  const toggleService = (service: StreamingCatalogItem) => {
    const isSelected = selectedServices.some(s => s.id === service.id);
    if (isSelected) {
      onServicesChange(selectedServices.filter(s => s.id !== service.id));
    } else {
      onServicesChange([...selectedServices, service]);
    }
  };

  const totalMonthly = calculateStreamingTotal(selectedServices);

  // Group services by category
  const videoServices = services.filter(s => s.category === "video");
  const musicServices = services.filter(s => s.category === "music");

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-8 text-center">
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {isFrench ? "Chargement des services..." : "Loading services..."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error || services.length === 0) {
    return null; // Don't show section if no streaming services available
  }

  return (
    <Card className="bg-card border-cyan-500/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
              <Play className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <CardTitle>
                {isFrench ? "Services de Streaming" : "Streaming Services"}
              </CardTitle>
              <CardDescription>
                {isFrench 
                  ? "Ajoutez des services de streaming à votre forfait mensuel."
                  : "Add streaming services to your monthly plan."}
              </CardDescription>
            </div>
          </div>
          {totalMonthly > 0 && (
            <Badge className="bg-cyan-500">
              +${totalMonthly.toFixed(2)}/{isFrench ? "mois" : "mo"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Video Streaming */}
        {videoServices.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-muted-foreground" />
              <h4 className="font-medium text-sm text-muted-foreground">
                {isFrench ? "Vidéo & Films" : "Video & Movies"}
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {videoServices.map(service => {
                const isSelected = selectedServices.some(s => s.id === service.id);
                const features = Array.isArray(service.features) ? service.features : [];
                
                return (
                  <button 
                    key={service.id}
                    type="button"
                    className={`p-4 rounded-lg border-2 transition-all cursor-pointer text-left w-full ${
                      isSelected 
                        ? "border-cyan-500 bg-cyan-500/5" 
                        : "border-border hover:border-cyan-500/50"
                    }`}
                    onClick={() => toggleService(service)}
                    aria-pressed={isSelected}
                    aria-label={`${service.name} — $${service.price_monthly.toFixed(2)}/mois`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox 
                        checked={isSelected} 
                        className="pointer-events-none mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{service.name}</span>
                          <span className="font-bold text-cyan-600">
                            ${service.price_monthly.toFixed(2)}/{isFrench ? "mois" : "mo"}
                          </span>
                        </div>
                        {service.description && (
                          <p className="text-xs text-muted-foreground mt-1">{service.description}</p>
                        )}
                        {features.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {features.slice(0, 3).map((feature, idx) => (
                              <Badge key={idx} variant="outline" className="text-[10px] px-1.5">
                                {feature}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Music Streaming */}
        {musicServices.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-medium text-sm text-muted-foreground">
                  {isFrench ? "Musique" : "Music"}
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {musicServices.map(service => {
                  const isSelected = selectedServices.some(s => s.id === service.id);
                  const features = Array.isArray(service.features) ? service.features : [];
                  
                  return (
                    <button 
                      key={service.id}
                      type="button"
                      className={`p-4 rounded-lg border-2 transition-all cursor-pointer text-left w-full ${
                        isSelected 
                          ? "border-cyan-500 bg-cyan-500/5" 
                          : "border-border hover:border-cyan-500/50"
                      }`}
                      onClick={() => toggleService(service)}
                      aria-pressed={isSelected}
                      aria-label={`${service.name} — $${service.price_monthly.toFixed(2)}/mois`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox 
                          checked={isSelected} 
                          className="pointer-events-none mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">{service.name}</span>
                            <span className="font-bold text-cyan-600">
                              ${service.price_monthly.toFixed(2)}/{isFrench ? "mois" : "mo"}
                            </span>
                          </div>
                          {service.description && (
                            <p className="text-xs text-muted-foreground mt-1">{service.description}</p>
                          )}
                          {features.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {features.slice(0, 3).map((feature, idx) => (
                                <Badge key={idx} variant="outline" className="text-[10px] px-1.5">
                                  {feature}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Selection summary */}
        {selectedServices.length > 0 && (
          <>
            <Separator />
            <div className="flex items-center justify-between p-3 bg-cyan-500/10 rounded-lg">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-cyan-500" />
                <span className="text-sm font-medium">
                  {selectedServices.length} {isFrench ? "service(s) sélectionné(s)" : "service(s) selected"}
                </span>
              </div>
              <span className="font-bold text-cyan-600">
                +${totalMonthly.toFixed(2)}/{isFrench ? "mois" : "mo"}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
