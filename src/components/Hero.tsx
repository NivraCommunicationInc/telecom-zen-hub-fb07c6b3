import { ArrowRight, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { usePublicServices } from "@/hooks/usePublicServices";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";

const Hero = () => {
  const { t, language } = useLanguage();
  const isFr = language === "fr";
  const { data: services, isLoading } = usePublicServices({
    surface: "website",
    categories: ["Internet"],
  });

  const internetPrice = (() => {
    if (!services || services.length === 0) return null;
    return Math.min(...services.map((s) => Number(s.price))).toFixed(0);
  })();

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "#0A0A1A", color: "#FFFFFF" }}
    >
      {/* Ambient glows */}
      <div
        aria-hidden
        className="absolute pointer-events-none rounded-full"
        style={{
          top: "-20%",
          right: "-10%",
          width: 900,
          height: 900,
          background:
            "radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 60%)",
          filter: "blur(120px)",
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none rounded-full"
        style={{
          bottom: "-30%",
          left: "-10%",
          width: 600,
          height: 600,
          background:
            "radial-gradient(circle, rgba(167,139,250,0.10) 0%, transparent 60%)",
          filter: "blur(120px)",
        }}
      />

      <div className="relative max-w-[1180px] mx-auto px-5 sm:px-10 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* LEFT — content */}
          <div className="z-10 max-w-xl">
            {/* Eyebrow chip with pulse */}
            <div
              className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full"
              style={{
                background: "rgba(124,58,237,0.10)",
                border: "1px solid rgba(124,58,237,0.30)",
              }}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                  style={{ background: "#A78BFA" }}
                />
                <span
                  className="relative inline-flex h-2 w-2 rounded-full"
                  style={{ background: "#7C3AED" }}
                />
              </span>
              <span
                className="uppercase font-bold"
                style={{
                  color: "#A78BFA",
                  fontSize: 11,
                  letterSpacing: "0.18em",
                }}
              >
                {t("xhero.eyebrow")}
              </span>
            </div>

            {/* Editorial headline with gradient accent */}
            <h1
              className="font-bold mb-7"
              style={{
                fontSize: "clamp(40px, 7vw, 76px)",
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                color: "#FFFFFF",
              }}
            >
              {t("xhero.title")}{" "}
              <span
                style={{
                  background:
                    "linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {t("xhero.titleAccent")}
              </span>
            </h1>

            {/* Subtitle */}
            <p
              className="mb-8 max-w-[520px]"
              style={{
                color: "rgba(255,255,255,0.65)",
                fontSize: 18,
                lineHeight: 1.6,
              }}
            >
              {t("xhero.subtitle")}
            </p>

            {/* Price line */}
            <div className="mb-8 flex items-baseline gap-2">
              {isLoading || internetPrice === null ? (
                <Skeleton className="h-16 w-40 rounded-lg bg-white/5" />
              ) : (
                <>
                  <span
                    style={{ color: "rgba(255,255,255,0.55)", fontSize: 18 }}
                  >
                    {isFr ? "Dès" : "From"}
                  </span>
                  <span
                    className="font-bold leading-none"
                    style={{
                      color: "#FFFFFF",
                      fontSize: "clamp(56px, 10vw, 84px)",
                      letterSpacing: "-0.04em",
                    }}
                  >
                    {internetPrice}$
                  </span>
                  <span
                    style={{ color: "rgba(255,255,255,0.55)", fontSize: 16 }}
                  >
                    /{isFr ? "mois" : "mo"}
                  </span>
                </>
              )}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <Link
                to="/forfaits"
                className="group inline-flex items-center justify-center gap-2 font-bold transition-all hover:scale-[1.02]"
                style={{
                  height: 56,
                  paddingLeft: 32,
                  paddingRight: 32,
                  borderRadius: 999,
                  background: "#FFFFFF",
                  color: "#0A0A1A",
                  fontSize: 15,
                  boxShadow: "0 20px 50px -12px rgba(167,139,250,0.35)",
                }}
              >
                {t("xhero.cta")}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/forfaits"
                className="inline-flex items-center justify-center gap-2 font-bold transition-all hover:bg-white/10"
                style={{
                  height: 56,
                  paddingLeft: 28,
                  paddingRight: 28,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.05)",
                  color: "#FFFFFF",
                  fontSize: 15,
                  border: "1px solid rgba(255,255,255,0.18)",
                  backdropFilter: "blur(10px)",
                }}
              >
                {isFr ? "Découvrir nos forfaits" : "Discover all our plans"}
              </Link>
            </div>

            {/* Trust bullets */}
            <ul className="flex flex-wrap gap-x-6 gap-y-3">
              {[t("xhero.bullet1"), t("xhero.bullet2"), t("xhero.bullet3")].map(
                (text) => (
                  <li
                    key={text}
                    className="flex items-center gap-2.5 text-sm font-medium"
                    style={{ color: "rgba(255,255,255,0.75)" }}
                  >
                    <div
                      className="flex items-center justify-center"
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        background: "rgba(124,58,237,0.18)",
                        border: "1px solid rgba(124,58,237,0.35)",
                      }}
                    >
                      <Check
                        className="w-3 h-3"
                        strokeWidth={3}
                        style={{ color: "#A78BFA" }}
                      />
                    </div>
                    {text}
                  </li>
                ),
              )}
            </ul>
          </div>

          {/* RIGHT — framed hero visual with decorative corner brackets */}
          <div className="hidden lg:block relative">
            {/* Halo glow behind frame */}
            <div
              aria-hidden
              className="absolute -inset-6 rounded-[3rem] pointer-events-none"
              style={{
                background:
                  "linear-gradient(135deg, rgba(124,58,237,0.30), rgba(167,139,250,0.10))",
                filter: "blur(40px)",
                opacity: 0.6,
              }}
            />

            <div
              className="relative overflow-hidden"
              style={{
                borderRadius: "2.5rem",
                border: "1px solid rgba(255,255,255,0.10)",
                background: "#141432",
                padding: 4,
                boxShadow: "0 40px 80px -20px rgba(0,0,0,0.6)",
              }}
            >
              <div
                className="relative w-full overflow-hidden"
                style={{ borderRadius: "calc(2.5rem - 4px)", aspectRatio: "4 / 3" }}
              >
                <img
                  src="https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=900&q=80"
                  alt={
                    isFr
                      ? "Personne profitant d'internet à la maison"
                      : "Person enjoying internet at home"
                  }
                  className="w-full h-full object-cover"
                  loading="eager"
                />
                {/* Bottom gradient */}
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(to top, #0A0A1A 0%, transparent 50%)",
                  }}
                />

                {/* Floating badge inside frame */}
                <div
                  className="absolute left-6 right-6 bottom-6 flex items-center justify-between px-5 py-4"
                  style={{
                    borderRadius: 20,
                    background: "rgba(10,10,26,0.55)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center justify-center"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 999,
                        background: "#7C3AED",
                        boxShadow: "0 8px 24px rgba(124,58,237,0.45)",
                      }}
                    >
                      <Check
                        className="w-5 h-5 text-white"
                        strokeWidth={3}
                      />
                    </div>
                    <div className="leading-tight">
                      <div
                        className="uppercase font-bold"
                        style={{
                          color: "#A78BFA",
                          fontSize: 10.5,
                          letterSpacing: "0.18em",
                        }}
                      >
                        {isFr ? "Activation rapide" : "Quick activation"}
                      </div>
                      <div
                        className="font-bold text-white"
                        style={{ fontSize: 15 }}
                      >
                        {isFr ? "Service en 10 minutes" : "Live in 10 minutes"}
                      </div>
                    </div>
                  </div>
                  <span
                    className="font-bold uppercase"
                    style={{
                      color: "#FFFFFF",
                      fontSize: 10,
                      letterSpacing: "0.15em",
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.10)",
                    }}
                  >
                    QC
                  </span>
                </div>
              </div>
            </div>

            {/* Decorative corner brackets */}
            <div
              aria-hidden
              className="absolute -top-6 -right-6 w-28 h-28 border-t-2 border-r-2 rounded-tr-[2rem] pointer-events-none"
              style={{ borderColor: "rgba(124,58,237,0.45)" }}
            />
            <div
              aria-hidden
              className="absolute -bottom-6 -left-6 w-28 h-28 border-b-2 border-l-2 rounded-bl-[2rem] pointer-events-none"
              style={{ borderColor: "rgba(167,139,250,0.45)" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
