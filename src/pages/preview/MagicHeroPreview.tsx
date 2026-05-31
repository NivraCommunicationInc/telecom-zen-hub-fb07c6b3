/**
 * PREVIEW V2 — Premium animated hero (design-forward, Stripe/Linear/Resend grade)
 *
 * Differs from V1 (basic Linear pattern) by adding:
 *   - 4-layer animated mesh gradient background with slow morphing blobs
 *   - Parallax mouse-tracking on the floating product mockup
 *   - 3 floating "live product" cards (speed test, plan, savings) with stagger
 *     entrance + subtle floating idle animation
 *   - Animated number counters on the stats row
 *   - Trusted-by marquee with logos that pause on hover
 *   - Subtle grid mask + radial brand glow
 *   - Theme-aware light/dark
 *
 * Still a sandbox — visit /preview/magic-hero to evaluate. Production hero
 * untouched until you say "ship it".
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Gauge,
  Shield,
  Sparkles,
  Wifi,
  Tv,
  Smartphone,
  TrendingDown,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// Small animated number — counts from 0 to target over `duration` ms.
// ──────────────────────────────────────────────────────────────────────────────
function CountUp({
  to,
  duration = 1600,
  decimals = 0,
  prefix = "",
  suffix = "",
}: {
  to: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [value, setValue] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      setValue(to);
      return;
    }
    const startedAt = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const t = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(to * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, reduceMotion]);

  const formatted = value.toLocaleString("fr-CA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <span>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Floating product card — used for the three live product mockups.
// Stagger entrance + idle hover float.
// ──────────────────────────────────────────────────────────────────────────────
function FloatingCard({
  children,
  className = "",
  delay = 0,
  floatDelay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  floatDelay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] as const }}
      className={className}
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: floatDelay,
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Mesh gradient background — 4 slowly-morphing blurred blobs that create the
// premium depth feel without any image asset.
// ──────────────────────────────────────────────────────────────────────────────
function MeshGradientBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* Blob 1 — top-left, violet */}
      <motion.div
        className="absolute -top-32 -left-32 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,_#7C3AED_0%,_transparent_70%)] opacity-40 blur-3xl"
        animate={{
          x: [0, 40, -20, 0],
          y: [0, -30, 20, 0],
          scale: [1, 1.15, 0.95, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Blob 2 — top-right, soft lavender */}
      <motion.div
        className="absolute -top-20 right-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,_#C7B6F2_0%,_transparent_70%)] opacity-50 blur-3xl"
        animate={{
          x: [0, -40, 30, 0],
          y: [0, 30, -10, 0],
          scale: [1, 1.1, 0.9, 1],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      {/* Blob 3 — center, deep violet accent */}
      <motion.div
        className="absolute top-[40%] left-[35%] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,_#5B21B6_0%,_transparent_70%)] opacity-25 blur-3xl"
        animate={{
          x: [0, -30, 40, 0],
          y: [0, 40, -30, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      {/* Blob 4 — bottom-right, pink accent for depth */}
      <motion.div
        className="absolute bottom-0 right-10 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,_#EC4899_0%,_transparent_70%)] opacity-20 blur-3xl"
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -20, 30, 0],
          scale: [1, 1.05, 0.95, 1],
        }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />

      {/* Subtle dot grid overlay — adds texture without dominating */}
      <div
        className="
          absolute inset-0 opacity-[0.18]
          [background-image:radial-gradient(circle_at_center,_#7C3AED_1px,_transparent_1px)]
          [background-size:24px_24px]
          [mask-image:radial-gradient(ellipse_60%_40%_at_50%_30%,_#000_30%,_transparent_75%)]
        "
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Right-side floating product cards — show product as if it were live.
// ──────────────────────────────────────────────────────────────────────────────
function LiveProductCards({ mouseX, mouseY }: { mouseX: number; mouseY: number }) {
  // Parallax — cards drift slightly based on cursor position relative to viewport.
  const px = (depth: number) => `translate3d(${mouseX * depth}px, ${mouseY * depth}px, 0)`;

  return (
    <div className="relative h-full w-full">
      {/* Card 1 — Speed test (back) */}
      <FloatingCard
        delay={0.4}
        floatDelay={0}
        className="absolute right-0 top-8 w-[260px]"
      >
        <div
          style={{ transform: px(8) }}
          className="
            rounded-2xl border border-white/60 bg-white/85 p-5 shadow-2xl
            backdrop-blur-xl ring-1 ring-black/5
            dark:border-white/10 dark:bg-[#1A1424]/85 dark:ring-white/5
          "
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#7C3AED]">
              <Gauge className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Test de vitesse</span>
            </div>
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-[#0D0D0D] dark:text-white">
              <CountUp to={1010} duration={2200} />
            </span>
            <span className="text-sm font-medium text-[#6B7280] dark:text-[#94A3B8]">Mbps</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EDE9FF] dark:bg-[#2A1E45]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "92%" }}
              transition={{ delay: 1.4, duration: 1.8, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#C7B6F2]"
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wider text-[#94A3B8]">
            <span>Download</span>
            <span>Latence 4ms</span>
          </div>
        </div>
      </FloatingCard>

      {/* Card 2 — Plan price (middle, prominent) */}
      <FloatingCard
        delay={0.6}
        floatDelay={1}
        className="absolute right-20 top-48 w-[300px] z-10"
      >
        <div
          style={{ transform: px(14) }}
          className="
            rounded-2xl border border-[#7C3AED]/20 bg-gradient-to-br from-[#7C3AED] to-[#5B21B6]
            p-6 text-white shadow-[0_20px_60px_-12px_rgba(124,58,237,0.5)]
          "
        >
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
              GIGA Recommandé
            </span>
            <Wifi className="h-5 w-5 opacity-80" />
          </div>
          <div className="mt-5">
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-bold">60</span>
              <span className="text-xl font-semibold opacity-90">$</span>
              <span className="ml-1 text-sm opacity-75">/mois</span>
            </div>
            <p className="mt-1 text-xs uppercase tracking-wider opacity-75">Tout inclus</p>
          </div>
          <ul className="mt-4 space-y-1.5 text-xs">
            {["1 010 Mbps fibre", "Sans contrat", "Aucun crédit requis"].map((line) => (
              <li key={line} className="flex items-center gap-2 opacity-95">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-lg bg-white/10 p-2 text-center text-[10px] font-semibold uppercase tracking-wider backdrop-blur">
            ✨ Premier mois GRATUIT
          </div>
        </div>
      </FloatingCard>

      {/* Card 3 — Savings vs Bell (front-bottom) */}
      <FloatingCard
        delay={0.85}
        floatDelay={2}
        className="absolute right-2 bottom-0 w-[240px]"
      >
        <div
          style={{ transform: px(20) }}
          className="
            rounded-2xl border border-emerald-200 bg-white/90 p-4 shadow-2xl
            backdrop-blur-xl ring-1 ring-black/5
            dark:border-emerald-900/40 dark:bg-[#1A1424]/85 dark:ring-white/5
          "
        >
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <TrendingDown className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Économies / an</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[#0D0D0D] dark:text-white">
              <CountUp to={420} duration={2000} prefix="" suffix=" $" />
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-[#6B7280] dark:text-[#94A3B8]">
            vs forfait équivalent chez Bell ou Vidéotron
          </p>
        </div>
      </FloatingCard>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Marquee — trusted-by / payment logos that scroll continuously.
// ──────────────────────────────────────────────────────────────────────────────
function TrustMarquee() {
  const items = [
    "Visa", "Mastercard", "PayPal", "Interac",
    "Cloudflare", "SSL 256-bit", "Loi 25", "CRTC",
  ];
  return (
    <div className="relative mt-20 overflow-hidden border-y border-[#EDE9FF] py-5 dark:border-[#2A1E45]">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />
      <motion.div
        className="flex gap-12 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        {[...items, ...items, ...items].map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="text-sm font-semibold uppercase tracking-wider text-[#94A3B8] dark:text-[#64748B]"
          >
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────────────────────────────────
export default function MagicHeroPreview() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2; // -1..1
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      setMouse({ x, y });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [reduceMotion]);

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <section className="relative px-6 pt-28 pb-16 md:px-10 md:pt-36">
        <MeshGradientBackground />

        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          {/* LEFT — Content */}
          <div className="relative z-10 flex flex-col justify-center text-left">
            {/* Eyebrow */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
            >
              <Link
                to="/garantie"
                className="
                  group inline-flex items-center gap-2 rounded-full
                  border border-[#E0D5FA] bg-white/70 px-4 py-1.5
                  text-xs font-semibold uppercase tracking-wider text-[#5B21B6]
                  shadow-sm backdrop-blur transition-colors hover:border-[#7C3AED]
                  dark:border-[#3F2B6E] dark:bg-[#1A1424]/70 dark:text-[#C7B6F2]
                "
              >
                <Sparkles className="h-3.5 w-3.5" />
                Garantie 30 jours · Premier mois gratuit
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>

            {/* Title with per-word reveal */}
            <motion.h1
              initial="hidden"
              animate="visible"
              variants={{
                visible: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
              }}
              className="
                mt-6 text-balance text-[clamp(2.4rem,5vw,4.5rem)] font-bold
                leading-[1.05] tracking-tight text-[#0D0D0D] dark:text-white
              "
            >
              {["L'internet", "premium", "du", "Québec"].map((word, i) => (
                <motion.span
                  key={i}
                  variants={{
                    hidden: { opacity: 0, y: 24 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
                  }}
                  className="inline-block pr-3"
                >
                  {word === "premium" ? (
                    <span className="bg-gradient-to-br from-[#7C3AED] via-[#9D6EF8] to-[#5B21B6] bg-clip-text text-transparent">
                      {word}
                    </span>
                  ) : (
                    word
                  )}
                </motion.span>
              ))}
              <br />
              <motion.span
                variants={{
                  hidden: { opacity: 0, y: 24 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const, delay: 0.5 },
                  },
                }}
                className="text-[clamp(1.6rem,3.5vw,3rem)] text-[#4B5563] dark:text-[#94A3B8]"
              >
                sans contrat. <span className="text-[#7C3AED]">Sans surprise.</span>
              </motion.span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.6 }}
              className="mt-7 max-w-[52ch] text-base leading-relaxed text-[#4B5563] dark:text-[#94A3B8] md:text-lg"
            >
              Internet fibre 1 010 Mbps, télévision IPTV et mobile —
              chez vous en 2 jours, sans engagement, sans vérification de
              crédit. L'alternative québécoise à Bell et Vidéotron.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.05, duration: 0.6 }}
              className="mt-9 flex flex-col gap-3 sm:flex-row"
            >
              <Link
                to="/commander"
                className="
                  group relative inline-flex h-14 items-center justify-center gap-2
                  overflow-hidden rounded-full bg-[#7C3AED] px-8 text-base font-semibold text-white
                  shadow-[0_12px_40px_-12px_rgba(124,58,237,0.7)]
                  transition-all duration-300
                  hover:scale-[1.02] hover:bg-[#6929D8] hover:shadow-[0_18px_50px_-12px_rgba(124,58,237,0.9)]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2
                "
              >
                {/* Shine effect on hover */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                />
                <span className="relative">Commander maintenant</span>
                <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/couverture"
                className="
                  inline-flex h-14 items-center justify-center gap-2 rounded-full
                  border-2 border-[#D0C4F3] bg-white/80 px-8 text-base font-semibold text-[#5B21B6]
                  backdrop-blur transition-all duration-200
                  hover:border-[#7C3AED] hover:bg-white
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2
                  dark:border-[#3F2B6E] dark:bg-[#1A1424]/70 dark:text-[#C7B6F2] dark:hover:bg-[#1A1424]
                "
              >
                Vérifier ma couverture
              </Link>
            </motion.div>

            {/* Trust badges */}
            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.25, duration: 0.6 }}
              className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-[#4B5563] dark:text-[#94A3B8]"
            >
              {[
                { icon: CheckCircle2, label: "Aucun engagement" },
                { icon: Shield, label: "Aucun crédit requis" },
                { icon: Sparkles, label: "1er mois offert" },
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4 text-[#7C3AED]" />
                  {label}
                </li>
              ))}
            </motion.ul>
          </div>

          {/* RIGHT — Live product cards */}
          <div className="relative hidden h-[560px] lg:block">
            <LiveProductCards mouseX={mouse.x * 6} mouseY={mouse.y * 4} />
          </div>
        </div>

        {/* Stats row — animated counters */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.7 }}
          className="
            relative z-10 mx-auto mt-20 grid max-w-5xl grid-cols-2 gap-8
            border-y border-[#EDE9FF] bg-white/40 px-8 py-10 backdrop-blur
            dark:border-[#2A1E45] dark:bg-[#0A0A0F]/40
            sm:grid-cols-4 sm:rounded-2xl sm:border
          "
        >
          {[
            { value: 1010, suffix: " Mbps", label: "Fibre symétrique", icon: Wifi },
            { value: 60, prefix: "", suffix: " $", label: "/mois tout inclus", icon: TrendingDown },
            { value: 2, suffix: " jours", label: "Installation moyenne", icon: Sparkles },
            { value: 100, suffix: " %", label: "Support local QC", icon: Shield },
          ].map(({ value, prefix, suffix, label, icon: Icon }) => (
            <div key={label} className="text-center">
              <Icon className="mx-auto mb-2 h-5 w-5 text-[#7C3AED]/70" />
              <div className="text-3xl font-bold text-[#0D0D0D] dark:text-white md:text-4xl">
                <CountUp to={value} duration={1800} prefix={prefix} suffix={suffix} />
              </div>
              <div className="mt-1 text-xs uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">
                {label}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Service icons row — Internet / TV / Mobile */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.6 }}
          className="relative z-10 mx-auto mt-12 flex max-w-3xl items-center justify-center gap-12 text-center"
        >
          {[
            { Icon: Wifi, label: "Internet" },
            { Icon: Tv, label: "Télévision" },
            { Icon: Smartphone, label: "Mobile" },
          ].map(({ Icon, label }) => (
            <div key={label} className="group flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F4F0FF] text-[#7C3AED] transition-all group-hover:scale-110 group-hover:bg-[#7C3AED] group-hover:text-white dark:bg-[#1A1424] dark:group-hover:bg-[#7C3AED]">
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">
                {label}
              </span>
            </div>
          ))}
        </motion.div>

        <TrustMarquee />
      </section>

      {/* Preview meta */}
      <div className="border-t border-border bg-muted/30 px-6 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          🧪 PREVIEW V2 — Premium animated hero (Stripe/Linear grade). Sandbox
          only — the public homepage at <code className="rounded bg-background px-1.5 py-0.5">/</code> is untouched.
        </p>
      </div>
    </main>
  );
}
