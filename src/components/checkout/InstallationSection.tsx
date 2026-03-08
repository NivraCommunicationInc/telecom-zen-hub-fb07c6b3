/**
 * InstallationSection — Telecom-grade installation choice for checkout
 * Professional UI matching Rogers/Bell/Vidéotron quality.
 * 
 * Two paths:
 * 1. Auto-installation → Equipment shipped, no appointment needed
 * 2. Technician → Coaxial questionnaire → Smart slot picker
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Package, Wrench, CheckCircle2, Truck, ShieldCheck, Clock, 
  Wifi, Cable, ArrowRight, Star, Zap, Info, MapPin, Calendar
} from "lucide-react";
import { InstallationScheduler } from "@/components/installation/InstallationScheduler";
import type { InstallationDecision } from "@/lib/installationLogic";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  installationChoice: "auto" | "technician" | null;
  onInstallationChoiceChange: (choice: "auto" | "technician") => void;
  selectedDate: string;
  selectedTime: string;
  onDateTimeChange: (date: string, time: string) => void;
  appointmentConfirmed: boolean;
  onAppointmentConfirmedChange: (confirmed: boolean) => void;
  onDecisionMade?: (decision: InstallationDecision) => void;
}

const AUTO_INSTALL_FEATURES = [
  { icon: Package, text: "Équipement livré à votre porte" },
  { icon: Wifi, text: "Guide d'activation pas-à-pas inclus" },
  { icon: Clock, text: "Livraison sous 2 à 5 jours ouvrables" },
  { icon: ShieldCheck, text: "Support technique disponible si besoin" },
];

const TECH_INSTALL_FEATURES = [
  { icon: Wrench, text: "Technicien certifié à domicile" },
  { icon: Cable, text: "Vérification et configuration du câblage" },
  { icon: Wifi, text: "Activation et test de tous les services" },
  { icon: ShieldCheck, text: "Garantie d'installation complète" },
];

export function InstallationSection({
  installationChoice,
  onInstallationChoiceChange,
  selectedDate,
  selectedTime,
  onDateTimeChange,
  appointmentConfirmed,
  onAppointmentConfirmedChange,
  onDecisionMade,
}: Props) {
  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Mode d'installation</CardTitle>
              <CardDescription className="text-sm">
                Choisissez comment activer vos services Internet et TV
              </CardDescription>
            </div>
          </div>
          {installationChoice && (
            <Badge variant="outline" className="gap-1.5 text-xs font-medium">
              <CheckCircle2 className="w-3 h-3 text-primary" />
              {installationChoice === "auto" ? "Auto-installation" : "Technicien"}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-0">
        {/* ── Choice Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Auto-installation */}
          <button
            type="button"
            onClick={() => {
              onInstallationChoiceChange("auto");
              onDateTimeChange("", "");
              onAppointmentConfirmedChange(false);
            }}
            className={`relative text-left p-5 rounded-xl border-2 transition-all duration-200 group ${
              installationChoice === "auto"
                ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]"
                : "border-border hover:border-primary/40 hover:shadow-sm"
            }`}
          >
            {/* Popular badge */}
            <div className="absolute -top-2.5 left-4">
              <Badge className="bg-primary text-primary-foreground text-[10px] font-semibold px-2.5 py-0.5 shadow-sm">
                <Star className="w-3 h-3 mr-1" />
                Populaire
              </Badge>
            </div>

            <div className="flex items-start gap-3 mt-1">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                installationChoice === "auto" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
              }`}>
                <Package className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-foreground">Auto-installation</h3>
                  <span className="text-sm font-bold text-primary whitespace-nowrap">30,00 $</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Recevez l'équipement et branchez-le vous-même en quelques minutes.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Truck className="w-3 h-3" />
                    2-5 jours
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Zap className="w-3 h-3" />
                    Simple
                  </Badge>
                </div>
              </div>
            </div>

            {/* Radio indicator */}
            <div className={`absolute top-5 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              installationChoice === "auto" 
                ? "border-primary bg-primary" 
                : "border-muted-foreground/30"
            }`}>
              {installationChoice === "auto" && (
                <CheckCircle2 className="w-3.5 h-3.5 text-primary-foreground" />
              )}
            </div>
          </button>

          {/* Technician installation */}
          <button
            type="button"
            onClick={() => onInstallationChoiceChange("technician")}
            className={`relative text-left p-5 rounded-xl border-2 transition-all duration-200 group ${
              installationChoice === "technician"
                ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]"
                : "border-border hover:border-primary/40 hover:shadow-sm"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                installationChoice === "technician" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
              }`}>
                <Wrench className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-foreground">Technicien à domicile</h3>
                  <span className="text-sm font-bold text-primary whitespace-nowrap">50,00 $</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Un technicien certifié installe et configure tout chez vous.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Calendar className="w-3 h-3" />
                    Sur rendez-vous
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Garanti
                  </Badge>
                </div>
              </div>
            </div>

            {/* Radio indicator */}
            <div className={`absolute top-5 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              installationChoice === "technician" 
                ? "border-primary bg-primary" 
                : "border-muted-foreground/30"
            }`}>
              {installationChoice === "technician" && (
                <CheckCircle2 className="w-3.5 h-3.5 text-primary-foreground" />
              )}
            </div>
          </button>
        </div>

        {/* ── Expanded sections ── */}
        <AnimatePresence mode="wait">
          {/* Auto-installation expanded */}
          {installationChoice === "auto" && (
            <motion.div
              key="auto"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <h4 className="font-semibold text-foreground">Auto-installation sélectionnée</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {AUTO_INSTALL_FEATURES.map((feature, i) => {
                    const Icon = feature.icon;
                    return (
                      <div key={i} className="flex items-center gap-2.5 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center shrink-0 border border-border">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-foreground">{feature.text}</span>
                      </div>
                    );
                  })}
                </div>

                <Separator />

                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-background border border-border">
                  <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    L'équipement sera expédié à votre adresse de service. Vous recevrez un courriel avec les 
                    instructions d'installation et un lien de suivi. Si l'activation ne fonctionne pas, 
                    notre équipe planifiera une visite technique sans frais supplémentaires.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Technician installation expanded — full questionnaire + scheduler */}
          {installationChoice === "technician" && (
            <motion.div
              key="technician"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <div className="space-y-4">
                {/* Feature list */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {TECH_INSTALL_FEATURES.map((feature, i) => {
                      const Icon = feature.icon;
                      return (
                        <div key={i} className="flex items-center gap-2.5 text-sm">
                          <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center shrink-0 border border-border">
                            <Icon className="w-4 h-4 text-primary" />
                          </div>
                          <span className="text-foreground">{feature.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Installation Scheduler (questionnaire + decision + slot picker) */}
                <InstallationScheduler
                  isFrench={true}
                  fallbackDistanceKm={20}
                  selectedDate={selectedDate}
                  selectedTime={selectedTime}
                  onDateTimeChange={onDateTimeChange}
                  onInstallationTypeChange={(type, level) => {
                    console.log("[InstallationSection] Type:", type, "Level:", level);
                  }}
                  onDecisionMade={onDecisionMade}
                  confirmedAppointment={appointmentConfirmed}
                  onAppointmentConfirmedChange={onAppointmentConfirmedChange}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* No selection prompt */}
        {!installationChoice && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <Info className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Veuillez sélectionner un mode d'installation pour continuer.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
