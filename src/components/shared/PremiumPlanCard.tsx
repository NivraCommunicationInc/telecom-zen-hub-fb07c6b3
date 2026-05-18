/**
 * PremiumPlanCard — Fizz/Koodo-style premium plan card used on Internet, TV
 * and Mobile public pages. Light theme, rounded-full CTA, recommended state
 * gets a gradient, glow and floating badge.
 */
import { ReactNode } from "react";
import { Check, ArrowRight, Star } from "lucide-react";
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

const PURPLE = "#7C3AED";

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
      className="group relative text-left transition-all duration-300 hover:-translate-y-1 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      style={{
        background: featured ? "linear-gradient(180deg, #FFFFFF 0%, #FBF8FF 100%)" : "#FFFFFF",
        border: featured ? `2px solid ${PURPLE}` : "1px solid #ECECEC",
        borderRadius: 24,
        boxShadow: featured
          ? "0 20px 60px -15px rgba(124,58,237,0.35), 0 4px 12px rgba(0,0,0,0.04)"
          : "0 4px 24px rgba(0,0,0,0.06)",
        overflow: "hidden",
      }}
    >
      {featured && (
        <>
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "radial-gradient(600px circle at 50% -20%, rgba(124,58,237,0.10), transparent 50%)",
            }}
          />
          {badge && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
              <div
                className="flex items-center gap-1.5 text-white uppercase px-4 py-1.5"
                style={{
                  background: PURPLE,
                  borderRadius: "0 0 12px 12px",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "1.2px",
                  boxShadow: "0 4px 12px rgba(124,58,237,0.4)",
                }}
              >
                <Star className="w-3 h-3 fill-current" />
                {badge}
              </div>
            </div>
          )}
        </>
      )}
      {!featured && badge && (
        <div className="absolute top-4 right-4 z-10">
          <span
            className="inline-flex items-center px-2.5 py-1 uppercase"
            style={{
              background: "#F3EEFF",
              color: PURPLE,
              borderRadius: 50,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "1px",
            }}
          >
            {badge}
          </span>
        </div>
      )}

      <div className="p-7 sm:p-8 flex flex-col h-full relative">
        <div className={featured ? "pt-3" : ""}>
          <h3
            className="font-bold mb-1"
            style={{ color: "#0D0D0D", fontSize: 20, letterSpacing: "-0.3px" }}
          >
            {name}
          </h3>
          {subtitle && (
            <p
              className="font-semibold mb-6"
              style={{ color: PURPLE, fontSize: 13, letterSpacing: "0.5px" }}
            >
              {subtitle}
            </p>
          )}
        </div>

        <div className="mb-6 flex items-baseline gap-1">
          {previousPrice != null && previousPrice !== "" && (
            <span
              className="mr-2 line-through"
              style={{ color: "#999", fontSize: 18, fontWeight: 500 }}
            >
              {typeof previousPrice === "number"
                ? `${previousPrice.toFixed(0)}$`
                : previousPrice}
            </span>
          )}
          <span
            className="font-extrabold leading-none"
            style={{ color: "#0D0D0D", fontSize: 56, letterSpacing: "-2px" }}
          >
            {priceNumber}
          </span>
          <span className="font-bold" style={{ color: "#0D0D0D", fontSize: 24 }}>
            $
          </span>
          <span className="ml-1" style={{ color: "#888", fontSize: 15, fontWeight: 500 }}>
            {priceUnit}
          </span>
        </div>

        {description && (
          <p style={{ color: "#555", fontSize: 14, lineHeight: 1.55, marginBottom: 16 }}>
            {description}
          </p>
        )}

        <div
          className="h-px w-full mb-6"
          style={{ background: "linear-gradient(90deg, transparent, #EEE, transparent)" }}
        />

        {extra && <div className="mb-6">{extra}</div>}

        <div className="space-y-3 mb-7 flex-1">
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-2.5" style={{ fontSize: 14.5 }}>
              <div
                className="shrink-0 flex items-center justify-center mt-0.5"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 50,
                  background: featured ? PURPLE : "#F3EEFF",
                }}
              >
                <Check
                  className="w-3 h-3"
                  strokeWidth={3}
                  style={{ color: featured ? "#FFFFFF" : PURPLE }}
                />
              </div>
              <span style={{ color: "#333", lineHeight: 1.5 }}>{f}</span>
            </div>
          ))}
        </div>

        {equipmentType && <EquipmentRequiredBox type={equipmentType} />}

        <div
          className="w-full flex items-center justify-center gap-2 font-bold mt-5 transition-all group-hover:gap-3"
          style={{
            height: 52,
            borderRadius: 50,
            background: featured ? PURPLE : "#0D0D0D",
            color: "#FFFFFF",
            fontSize: 15,
            boxShadow: featured
              ? "0 10px 24px -8px rgba(124,58,237,0.5)"
              : "0 6px 16px -6px rgba(0,0,0,0.3)",
          }}
        >
          {ctaLabel}
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </button>
  );
}
