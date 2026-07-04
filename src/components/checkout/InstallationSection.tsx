/**
 * InstallationSection — Nivra checkout aesthetic
 *
 * White card, corporate blue #0066CC accents, matches CheckoutSection.
 * Two paths:
 *  1. Auto-installation → Equipment shipped, ALWAYS FREE, no appointment
 *  2. Technician → Coaxial questionnaire → Smart slot picker
 *
 * Zero business-logic changes vs previous version — props identical.
 */
import {
  Package, Wrench, CheckCircle2, Truck, ShieldCheck, Clock,
  Wifi, Cable, Info, Calendar, Star,
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
  /** Which phase to render — "choice" (tiles + cabling questionnaire) or "schedule" (calendar) */
  phase?: "choice" | "schedule";
  /** Forwarded from the scheduler so the parent can persist coaxial answers on the order */
  onCablingAnswered?: (answers: import("@/lib/installationLogic").CablingQuestionnaire) => void;
}

const AUTO_INSTALL_FEATURES = [
  { icon: Package, text: "Équipement livré à votre porte" },
  { icon: Wifi,    text: "Guide d'activation pas-à-pas inclus" },
  { icon: Clock,   text: "Livraison sous 2 à 5 jours ouvrables" },
  { icon: ShieldCheck, text: "Support technique disponible si besoin" },
];

const TECH_INSTALL_FEATURES = [
  { icon: Wrench,     text: "Technicien certifié à domicile" },
  { icon: Cable,      text: "Vérification et configuration du câblage" },
  { icon: Wifi,       text: "Activation et test de tous les services" },
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
  phase = "choice",
  onCablingAnswered,
}: Props) {
  const showChoice = phase === "choice";
  const showSchedule = phase === "schedule";
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
      {/* Header — matches Nivra checkout shell */}
      <div className="px-5 sm:px-6 py-4 border-b border-[#E5E7EB]" style={{ background: '#F0F6FC' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#0066CC]/10 flex items-center justify-center flex-shrink-0">
            {showSchedule ? <Calendar className="w-5 h-5 text-[#0066CC]" /> : <Wrench className="w-5 h-5 text-[#0066CC]" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-[#1A1A2E] leading-tight">
              {showSchedule ? "Choisissez votre rendez-vous" : "Mode d'installation"}
            </h3>
            <p className="text-sm text-[#6B7280] mt-0.5">
              {showSchedule
                ? "Sélectionnez la date et la plage horaire du passage du technicien"
                : "Choisissez comment activer vos services Internet et TV"}
            </p>
          </div>
          {installationChoice && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00A651]/10 text-[#00A651] text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {installationChoice === "auto" ? "Auto-installation" : "Technicien"}
            </span>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        {/* ── Choice tiles (phase=choice only) ── */}
        {showChoice && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Auto-installation */}
          <button
            type="button"
            onClick={() => {
              onInstallationChoiceChange("auto");
              onDateTimeChange("", "");
              onAppointmentConfirmedChange(false);
            }}
            className={`relative text-left p-5 rounded-xl border-2 transition-all duration-200 ${
              installationChoice === "auto"
                ? "border-[#0066CC] bg-[#0066CC]/[0.04] shadow-sm"
                : "border-[#E5E7EB] bg-white hover:border-[#0066CC]/40 hover:shadow-sm"
            }`}
          >
            <div className="absolute -top-2.5 left-4">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#0066CC] text-white text-[10px] font-semibold shadow-sm">
                <Star className="w-3 h-3" />
                Populaire
              </span>
            </div>

            <div className="flex items-start gap-3 mt-1">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                installationChoice === "auto"
                  ? "bg-[#0066CC] text-white"
                  : "bg-[#F5F7FA] text-[#0066CC]"
              }`}>
                <Package className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="font-semibold text-[#1A1A2E]">Auto-installation</h4>
                  <span className="text-sm font-bold text-[#00A651] whitespace-nowrap">
                    Gratuit
                  </span>
                </div>
                <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">
                  Recevez l'équipement et branchez-le vous-même en quelques minutes.
                </p>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F5F7FA] text-[#6B7280] border border-[#E5E7EB]">
                    <Truck className="w-3 h-3" /> 2-5 jours
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F5F7FA] text-[#6B7280] border border-[#E5E7EB]">
                    Simple
                  </span>
                </div>
              </div>
            </div>

            <div className={`absolute top-5 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              installationChoice === "auto"
                ? "border-[#0066CC] bg-[#0066CC]"
                : "border-[#E5E7EB]"
            }`}>
              {installationChoice === "auto" && (
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              )}
            </div>
          </button>

          {/* Technician */}
          <button
            type="button"
            onClick={() => onInstallationChoiceChange("technician")}
            className={`relative text-left p-5 rounded-xl border-2 transition-all duration-200 ${
              installationChoice === "technician"
                ? "border-[#0066CC] bg-[#0066CC]/[0.04] shadow-sm"
                : "border-[#E5E7EB] bg-white hover:border-[#0066CC]/40 hover:shadow-sm"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                installationChoice === "technician"
                  ? "bg-[#0066CC] text-white"
                  : "bg-[#F5F7FA] text-[#0066CC]"
              }`}>
                <Wrench className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="font-semibold text-[#1A1A2E]">Technicien à domicile</h4>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#6B7280] line-through">50,00 $</span>
                    <span className="text-sm font-bold text-[#0066CC] whitespace-nowrap">25,00 $</span>
                  </div>
                </div>
                <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">
                  Un technicien certifié installe et configure tout chez vous.
                </p>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F5F7FA] text-[#6B7280] border border-[#E5E7EB]">
                    <Calendar className="w-3 h-3" /> Sur rendez-vous
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F5F7FA] text-[#6B7280] border border-[#E5E7EB]">
                    <ShieldCheck className="w-3 h-3" /> Garanti
                  </span>
                </div>
              </div>
            </div>

            <div className={`absolute top-5 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              installationChoice === "technician"
                ? "border-[#0066CC] bg-[#0066CC]"
                : "border-[#E5E7EB]"
            }`}>
              {installationChoice === "technician" && (
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              )}
            </div>
          </button>
        </div>
        )}

        {/* ── Expanded panels ── */}
        <AnimatePresence mode="wait">
          {showChoice && installationChoice === "auto" && (
            <motion.div
              key="auto"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <div className="rounded-xl border border-[#0066CC]/20 bg-[#0066CC]/[0.04] p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#00A651]" />
                  <h5 className="font-semibold text-[#1A1A2E]">Auto-installation sélectionnée</h5>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {AUTO_INSTALL_FEATURES.map((f, i) => {
                    const Icon = f.icon;
                    return (
                      <div key={i} className="flex items-center gap-2.5 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 border border-[#E5E7EB]">
                          <Icon className="w-4 h-4 text-[#0066CC]" />
                        </div>
                        <span className="text-[#1A1A2E]">{f.text}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="h-px bg-[#0066CC]/15" />

                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-white border border-[#E5E7EB]">
                  <Info className="w-4 h-4 text-[#6B7280] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#6B7280] leading-relaxed">
                    L'équipement sera expédié à votre adresse de service. Vous recevrez un courriel avec les
                    instructions d'installation et un lien de suivi. Si l'activation ne fonctionne pas,
                    notre équipe planifiera une visite technique sans frais supplémentaires.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {installationChoice === "technician" && (
            <motion.div
              key="technician"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <div className="space-y-4">
                {showChoice && (
                  <div className="rounded-xl border border-[#0066CC]/20 bg-[#0066CC]/[0.04] p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {TECH_INSTALL_FEATURES.map((f, i) => {
                        const Icon = f.icon;
                        return (
                          <div key={i} className="flex items-center gap-2.5 text-sm">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 border border-[#E5E7EB]">
                              <Icon className="w-4 h-4 text-[#0066CC]" />
                            </div>
                            <span className="text-[#1A1A2E]">{f.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

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
                  phase={phase}
                  onCablingAnswered={onCablingAnswered}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {showChoice && !installationChoice && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-[#F5F7FA] border border-[#E5E7EB]">
            <Info className="w-4 h-4 text-[#6B7280]" />
            <p className="text-sm text-[#6B7280]">
              Veuillez sélectionner un mode d'installation pour continuer.
            </p>
          </div>
        )}

        {showSchedule && installationChoice === "auto" && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#ECFDF5] border border-[#10B981]">
            <CheckCircle2 className="w-5 h-5 text-[#047857] shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#065F46]">Aucun rendez-vous nécessaire</p>
              <p className="text-xs text-[#047857]">Votre auto-installation ne requiert pas de passage technicien.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
