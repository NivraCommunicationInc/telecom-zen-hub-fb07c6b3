/**
 * PremiumPlanCard — Enterprise dark glass card for Internet, TV, Mobile plans.
 * Deep violet theme matching Nivra enterprise design system.
 */
import { ReactNode } from "react";
import { Check, ArrowRight, Star, Zap } from "lucide-react";
import { EquipmentRequiredBox } from "@/components/shared/EquipmentRequiredBox";

export interface PremiumPlanCardProps {
  name: string;
  subtitle?: string;
  price: number | string;
  priceUnit?: string;
  previousPrice?: number | string | null;
  features: string[];
  featured?: boolean;
  badge?: string;
  equipmentType?: "internet" | "tv" | "combo" | "mobile";
  ctaLabel: string;
  onClick?: () => void;
  disabled?: boolean;
  extra?: ReactNode;
  description?: string;
}

const P = "#7C3AED";
const PL = "#8B5CF6";
const PE = "#A78BFA";

export default function PremiumPlanCard({
  name,
  subtitle,
  price,
  priceUnit = "/mois",
  previousPrice,
  features,
  featured = false,
  badge,
  equipmentType,
  ctaLabel,
  onClick,
  disabled = false,
  extra,
  description,
}: PremiumPlanCardProps) {
  const priceNumber = typeof price === "number" ? price.toFixed(0) : String(price);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative text-left transition-all duration-300 hover:-translate-y-1.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 cursor-pointer"
      style={{
        background: featured
          ? "linear-gradient(145deg, #1E1040 0%, #1A1A2E 60%, #130D2A 100%)"
          : "#1A1A2E",
        border: featured ? `1.5px solid ${P}` : "1px solid rgba(124,58,237,0.18)",
        borderRadius: 24,
        boxShadow: featured
          ? `0 0 0 1px rgba(124,58,237,0.15), 0 24px 60px -16px rgba(124,58,237,0.5), 0 8px 32px rgba(0,0,0,0.5)`
          : "0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(124,58,237,0.05)",
        overflow: "hidden",
        transition: "transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease",
      }}
      onMouseEnter={(e) => {
        if (!featured) {
          e.currentTarget.style.borderColor = "rgba(124,58,237,0.4)";
          e.currentTarget.style.boxShadow = "0 8px 40px rgba(0,0,0,0.5), 0 0 24px rgba(124,58,237,0.2)";
        }
      }}
      onMouseLeave={(e) => {
        if (!featured) {
          e.currentTarget.style.borderColor = "rgba(124,58,237,0.18)";
          e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(124,58,237,0.05)";
        }
      }}
    >
      {/* Featured glow layer */}
      {featured && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: "radial-gradient(ellipse 80% 40% at 50% -10%, rgba(124,58,237,0.18) 0%, transparent 60%)",
          }}
        />
      )}

      {/* Popular badge — top center */}
      {featured && badge && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
          <div
            className="flex items-center gap-1.5 text-white px-4 py-1.5"
            style={{
              background: `linear-gradient(90deg, ${P}, ${PL})`,
              borderRadius: "0 0 14px 14px",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              boxShadow: "0 4px 16px rgba(124,58,237,0.5)",
            }}
          >
            <Star className="w-3 h-3 fill-current" />
            {badge}
          </div>
        </div>
      )}
      {!featured && badge && (
        <div className="absolute top-4 right-4 z-10">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 12px",
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.35)",
              color: PE,
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            {badge}
          </span>
        </div>
      )}

      <div className="p-6 sm:p-8 flex flex-col h-full relative" style={{ paddingTop: featured && badge ? 40 : undefined }}>
        {/* Plan name + subtitle */}
        <div className="mb-5">
          <h3 className="font-bold text-white mb-1" style={{ fontSize: 20, letterSpacing: "-0.3px" }}>
            {name}
          </h3>
          {subtitle && (
            <p className="font-semibold" style={{ color: PE, fontSize: 13 }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1 mb-5">
          {previousPrice != null && previousPrice !== "" && (
            <span className="mr-2 line-through" style={{ color: "rgba(255,255,255,0.35)", fontSize: 20, fontWeight: 500 }}>
              {typeof previousPrice === "number" ? `${previousPrice.toFixed(0)}$` : previousPrice}
            </span>
          )}
          <span className="font-extrabold text-white leading-none" style={{ fontSize: 56, letterSpacing: "-2.5px" }}>
            {priceNumber}
          </span>
          <span className="font-bold text-white" style={{ fontSize: 22 }}>$</span>
          <span className="ml-1" style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, fontWeight: 500 }}>
            {priceUnit}
          </span>
        </div>

        {description && (
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
            {description}
          </p>
        )}

        <div className="h-px w-full mb-5" style={{ background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.3), transparent)" }} />

        {extra && <div className="mb-5">{extra}</div>}

        {/* Features */}
        <div className="space-y-2.5 mb-6 flex-1">
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-3" style={{ fontSize: 14 }}>
              <div
                className="shrink-0 flex items-center justify-center mt-0.5"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: featured ? P : "rgba(124,58,237,0.2)",
                  border: featured ? "none" : "1px solid rgba(124,58,237,0.4)",
                  flexShrink: 0,
                }}
              >
                <Check className="w-2.5 h-2.5" strokeWidth={3} style={{ color: featured ? "#fff" : PE }} />
              </div>
              <span style={{ color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>{f}</span>
            </div>
          ))}
        </div>

        {equipmentType && <EquipmentRequiredBox type={equipmentType} />}

        {/* CTA */}
        <div
          className="w-full flex items-center justify-center gap-2 font-bold mt-4 transition-all group-hover:gap-3"
          style={{
            height: 52,
            borderRadius: 999,
            background: featured ? `linear-gradient(135deg, ${P}, ${PL})` : "rgba(124,58,237,0.12)",
            border: featured ? "none" : `1px solid rgba(124,58,237,0.35)`,
            color: "#fff",
            fontSize: 15,
            boxShadow: featured ? "0 8px 24px rgba(124,58,237,0.45)" : "none",
          }}
        >
          <Zap className="w-4 h-4" style={{ opacity: featured ? 1 : 0.7 }} />
          {ctaLabel}
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </button>
  );
}
