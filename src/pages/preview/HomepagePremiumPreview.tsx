/**
 * PREVIEW — Premium homepage redesign (Bell/Rogers/Fido/Vidéotron grade)
 *
 * Sandbox at /preview/homepage-v2. Includes the real Header + Footer so it
 * looks identical to what the live homepage would look like once promoted.
 *
 * Preserves all sections of the current Index.tsx:
 *   Hero · Stats · Pricing · Comparison · Coverage · Testimonials · TrustBadges · FinalCTA
 *
 * Design system applied uniformly:
 *   - Primary violet #7C3AED with gradient on key phrases
 *   - Glassmorphism cards (backdrop-blur, ring, soft shadows)
 *   - Stagger entrance + idle floating motion
 *   - Animated number counters
 *   - Mesh-gradient backgrounds with morphing blobs
 *   - Generous whitespace, fluid typography
 *
 * Production homepage at "/" is UNTOUCHED until you promote this preview.
 */
import { useEffect, useState, type ReactNode } from "react";
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
  MapPin,
  Star,
  Zap,
  Award,
  Heart,
  Lock,
  Quote,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HomeStatusBanner from "@/components/HomeStatusBanner";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";

// ──────────────────────────────────────────────────────────────────────────────
// SHARED PRIMITIVES — animated counter + floating card + mesh background.
// Inlined here so the preview is self-contained; will be extracted to
// @/components/marketing/* once promoted.
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
    if (reduceMotion) { setValue(to); return; }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, reduceMotion]);

  return (
    <span>
      {prefix}
      {value.toLocaleString("fr-CA", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

function MeshBlobs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute -top-32 -left-32 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,_#7C3AED_0%,_transparent_70%)] opacity-40 blur-3xl"
        animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0], scale: [1, 1.15, 0.95, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -top-20 right-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,_#C7B6F2_0%,_transparent_70%)] opacity-50 blur-3xl"
        animate={{ x: [0, -40, 30, 0], y: [0, 30, -10, 0], scale: [1, 1.1, 0.9, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className="absolute top-[40%] left-[35%] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,_#5B21B6_0%,_transparent_70%)] opacity-25 blur-3xl"
        animate={{ x: [0, -30, 40, 0], y: [0, 40, -30, 0], scale: [1, 0.9, 1.1, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
    </div>
  );
}

function Section({
  children,
  className = "",
  id,
  eyebrow,
  title,
  subtitle,
}: {
  children?: ReactNode;
  className?: string;
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  subtitle?: string;
}) {
  return (
    <section id={id} className={`relative px-6 py-20 md:px-10 md:py-28 ${className}`}>
      <div className="mx-auto max-w-7xl">
        {(eyebrow || title || subtitle) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="mb-12 text-center md:mb-16"
          >
            {eyebrow && (
              <span className="inline-flex items-center gap-2 rounded-full border border-[#E0D5FA] bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#5B21B6] backdrop-blur dark:border-[#3F2B6E] dark:bg-[#1A1424]/70 dark:text-[#C7B6F2]">
                <Sparkles className="h-3.5 w-3.5" />
                {eyebrow}
              </span>
            )}
            {title && (
              <h2 className="mt-5 text-balance text-[clamp(1.875rem,4vw,3rem)] font-bold leading-tight tracking-tight text-[#0D0D0D] dark:text-white">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mx-auto mt-4 max-w-2xl text-balance text-base leading-relaxed text-[#4B5563] dark:text-[#94A3B8] md:text-lg">
                {subtitle}
              </p>
            )}
          </motion.div>
        )}
        {children}
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// HERO SECTION
// ──────────────────────────────────────────────────────────────────────────────

function PremiumHero() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const onMove = (e: MouseEvent) => {
      setMouse({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [reduceMotion]);

  const px = (depth: number) => `translate3d(${mouse.x * depth}px, ${mouse.y * depth}px, 0)`;

  return (
    <section className="relative overflow-hidden px-6 pt-24 pb-16 md:px-10 md:pt-32">
      <MeshBlobs />

      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div className="relative z-10 flex flex-col justify-center text-left">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Link
              to="/garantie"
              className="group inline-flex items-center gap-2 rounded-full border border-[#E0D5FA] bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#5B21B6] shadow-sm backdrop-blur transition-colors hover:border-[#7C3AED] dark:border-[#3F2B6E] dark:bg-[#1A1424]/70 dark:text-[#C7B6F2]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Garantie 30 jours · Premier mois gratuit
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } }}
            className="mt-6 text-balance text-[clamp(2.4rem,5vw,4.5rem)] font-bold leading-[1.05] tracking-tight text-[#0D0D0D] dark:text-white"
          >
            {["L'internet", "premium", "du", "Québec"].map((w, i) => (
              <motion.span
                key={i}
                variants={{
                  hidden: { opacity: 0, y: 24 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
                }}
                className="inline-block pr-3"
              >
                {w === "premium" ? (
                  <span className="bg-gradient-to-br from-[#7C3AED] via-[#9D6EF8] to-[#5B21B6] bg-clip-text text-transparent">
                    {w}
                  </span>
                ) : w}
              </motion.span>
            ))}
            <br />
            <motion.span
              variants={{
                hidden: { opacity: 0, y: 24 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.5 } },
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
            Internet fibre 1 010 Mbps, télévision IPTV et mobile — chez vous en
            2 jours, sans engagement, sans vérification de crédit. L'alternative
            québécoise à Bell et Vidéotron.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.05, duration: 0.6 }}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <Link
              to="/commander"
              className="group relative inline-flex h-14 items-center justify-center gap-2 overflow-hidden rounded-full bg-[#7C3AED] px-8 text-base font-semibold text-white shadow-[0_12px_40px_-12px_rgba(124,58,237,0.7)] transition-all duration-300 hover:scale-[1.02] hover:bg-[#6929D8] hover:shadow-[0_18px_50px_-12px_rgba(124,58,237,0.9)]"
            >
              <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative">Commander maintenant</span>
              <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/couverture"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-full border-2 border-[#D0C4F3] bg-white/80 px-8 text-base font-semibold text-[#5B21B6] backdrop-blur transition-all duration-200 hover:border-[#7C3AED] hover:bg-white dark:border-[#3F2B6E] dark:bg-[#1A1424]/70 dark:text-[#C7B6F2] dark:hover:bg-[#1A1424]"
            >
              Vérifier ma couverture
            </Link>
          </motion.div>

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

        {/* Right — Floating product cards */}
        <div className="relative hidden h-[560px] lg:block">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.7 }}
            className="absolute right-0 top-8 w-[260px]"
          >
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
              <div style={{ transform: px(8) }} className="rounded-2xl border border-white/60 bg-white/85 p-5 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:border-white/10 dark:bg-[#1A1424]/85">
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
                  <span className="text-sm font-medium text-[#6B7280]">Mbps</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EDE9FF] dark:bg-[#2A1E45]">
                  <motion.div initial={{ width: 0 }} animate={{ width: "92%" }} transition={{ delay: 1.4, duration: 1.8 }} className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#C7B6F2]" />
                </div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.7 }}
            className="absolute right-20 top-48 z-10 w-[300px]"
          >
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}>
              <div style={{ transform: px(14) }} className="rounded-2xl border border-[#7C3AED]/20 bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] p-6 text-white shadow-[0_20px_60px_-12px_rgba(124,58,237,0.5)]">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur">GIGA Recommandé</span>
                  <Wifi className="h-5 w-5 opacity-80" />
                </div>
                <div className="mt-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold">60</span>
                    <span className="text-xl font-semibold opacity-90">$</span>
                    <span className="ml-1 text-sm opacity-75">/mois</span>
                  </div>
                </div>
                <ul className="mt-4 space-y-1.5 text-xs">
                  {["1 010 Mbps fibre", "Sans contrat", "Aucun crédit requis"].map((l) => (
                    <li key={l} className="flex items-center gap-2 opacity-95"><CheckCircle2 className="h-3.5 w-3.5" />{l}</li>
                  ))}
                </ul>
                <div className="mt-4 rounded-lg bg-white/10 p-2 text-center text-[10px] font-semibold uppercase tracking-wider backdrop-blur">
                  ✨ Premier mois GRATUIT
                </div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.85, duration: 0.7 }}
            className="absolute right-2 bottom-0 w-[240px]"
          >
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}>
              <div style={{ transform: px(20) }} className="rounded-2xl border border-emerald-200 bg-white/90 p-4 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:border-emerald-900/40 dark:bg-[#1A1424]/85">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <TrendingDown className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Économies / an</span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#0D0D0D] dark:text-white">
                    <CountUp to={420} duration={2000} suffix=" $" />
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-[#6B7280] dark:text-[#94A3B8]">
                  vs forfait équivalent chez Bell ou Vidéotron
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// STATS BANNER — animated counters
// ──────────────────────────────────────────────────────────────────────────────

function PremiumStats() {
  const stats = [
    { value: 1010, suffix: " Mbps", label: "Fibre symétrique", icon: Wifi },
    { value: 60, suffix: " $", label: "/mois tout inclus", icon: TrendingDown },
    { value: 2, suffix: " jours", label: "Installation moyenne", icon: Sparkles },
    { value: 100, suffix: " %", label: "Support local QC", icon: Heart },
  ];
  return (
    <Section className="!py-16">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7 }}
        className="mx-auto grid max-w-5xl grid-cols-2 gap-8 rounded-2xl border border-[#EDE9FF] bg-white/60 px-8 py-10 backdrop-blur dark:border-[#2A1E45] dark:bg-[#0A0A0F]/40 sm:grid-cols-4"
      >
        {stats.map(({ value, suffix, label, icon: Icon }) => (
          <div key={label} className="text-center">
            <Icon className="mx-auto mb-2 h-5 w-5 text-[#7C3AED]/70" />
            <div className="text-3xl font-bold text-[#0D0D0D] dark:text-white md:text-4xl">
              <CountUp to={value} duration={1800} suffix={suffix} />
            </div>
            <div className="mt-1 text-xs uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">{label}</div>
          </div>
        ))}
      </motion.div>
    </Section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// PRICING — 3 premium plan cards
// ──────────────────────────────────────────────────────────────────────────────

function PremiumPricing() {
  const plans = [
    {
      name: "Internet 100",
      tagline: "Pour les petits usages",
      price: 55,
      features: ["100 Mbps", "Données illimitées", "Borne WiFi requise (60$)", "Sans contrat"],
      badge: null as string | null,
      cta: "Choisir",
      highlight: false,
    },
    {
      name: "Internet GIGA",
      tagline: "Le plus populaire",
      price: 60,
      features: ["1 010 Mbps fibre", "Données illimitées", "Streaming 4K + gaming", "Premier mois GRATUIT", "Sans contrat"],
      badge: "RECOMMANDÉ",
      cta: "Commander",
      highlight: true,
    },
    {
      name: "GIGA + TV 15 choix",
      tagline: "Internet + TV bundle",
      price: 90,
      features: ["1 010 Mbps + 15 chaînes au choix", "Terminal TV inclus", "Replay 7 jours", "Sans contrat"],
      badge: null,
      cta: "Choisir",
      highlight: false,
    },
  ];
  return (
    <Section
      id="forfaits"
      eyebrow="Nos forfaits"
      title={<>Choisissez votre <span className="bg-gradient-to-r from-[#7C3AED] to-[#5B21B6] bg-clip-text text-transparent">forfait</span></>}
      subtitle="Tous nos forfaits sont sans contrat, sans vérification de crédit, et le premier mois est offert."
    >
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: i * 0.12, duration: 0.6 }}
            className={`relative flex flex-col rounded-3xl border p-8 ${
              plan.highlight
                ? "border-[#7C3AED]/30 bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] text-white shadow-[0_20px_60px_-12px_rgba(124,58,237,0.5)]"
                : "border-[#EDE9FF] bg-white/70 text-[#0D0D0D] backdrop-blur dark:border-[#2A1E45] dark:bg-[#0A0A0F]/40 dark:text-white"
            }`}
          >
            {plan.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5B21B6] shadow-md">
                {plan.badge}
              </span>
            )}
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider opacity-70">{plan.tagline}</div>
            <h3 className="text-2xl font-bold">{plan.name}</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-5xl font-bold">{plan.price}</span>
              <span className="text-xl font-semibold opacity-90">$</span>
              <span className="ml-1 text-sm opacity-75">/mois</span>
            </div>
            <ul className="mt-6 flex-1 space-y-3 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className={`mt-0.5 h-4 w-4 flex-shrink-0 ${plan.highlight ? "text-white" : "text-[#7C3AED]"}`} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/commander"
              className={`mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition-all ${
                plan.highlight
                  ? "bg-white text-[#5B21B6] hover:bg-[#F4F0FF]"
                  : "bg-[#7C3AED] text-white hover:bg-[#6929D8]"
              }`}
            >
              {plan.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// COMPARISON — Nivra vs Bell vs Vidéotron
// ──────────────────────────────────────────────────────────────────────────────

function PremiumComparison() {
  const rows: Array<{ feature: string; nivra: string | boolean; bell: string | boolean; videotron: string | boolean }> = [
    { feature: "Prix Internet GIGA", nivra: "60 $/mois", bell: "95–115 $/mois", videotron: "80–100 $/mois" },
    { feature: "Engagement", nivra: "Aucun", bell: "24 mois", videotron: "24 mois" },
    { feature: "Vérification de crédit", nivra: false, bell: true, videotron: true },
    { feature: "Premier mois", nivra: "GRATUIT", bell: "Payé", videotron: "Payé" },
    { feature: "Frais de résiliation", nivra: "0 $", bell: "200–400 $", videotron: "200 $" },
    { feature: "Support local Québec", nivra: true, bell: false, videotron: true },
  ];
  return (
    <Section
      eyebrow="Comparaison"
      title={<>Pourquoi <span className="bg-gradient-to-r from-[#7C3AED] to-[#5B21B6] bg-clip-text text-transparent">Nivra</span> ?</>}
      subtitle="Voyez ce qui nous différencie de Bell et Vidéotron."
    >
      <div className="overflow-hidden rounded-3xl border border-[#EDE9FF] bg-white/60 backdrop-blur dark:border-[#2A1E45] dark:bg-[#0A0A0F]/40">
        <div className="grid grid-cols-4 gap-0">
          <div className="border-b border-r border-[#EDE9FF] bg-transparent p-5 dark:border-[#2A1E45]" />
          {[
            { name: "Nivra", highlight: true },
            { name: "Bell", highlight: false },
            { name: "Vidéotron", highlight: false },
          ].map((co) => (
            <div
              key={co.name}
              className={`border-b border-r border-[#EDE9FF] p-5 text-center last:border-r-0 dark:border-[#2A1E45] ${
                co.highlight ? "bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] text-white" : ""
              }`}
            >
              <div className={`text-base font-bold ${co.highlight ? "" : "text-[#0D0D0D] dark:text-white"}`}>
                {co.name}
              </div>
            </div>
          ))}
          {rows.map((row, i) => (
            <ContrastRow key={row.feature} row={row} isLast={i === rows.length - 1} />
          ))}
        </div>
      </div>
    </Section>
  );
}

function ContrastRow({ row, isLast }: { row: { feature: string; nivra: string | boolean; bell: string | boolean; videotron: string | boolean }; isLast: boolean }) {
  const border = isLast ? "" : "border-b border-[#EDE9FF] dark:border-[#2A1E45]";
  const render = (v: string | boolean) => {
    if (typeof v === "boolean") {
      return v
        ? <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-500" />
        : <span className="text-[#94A3B8]">—</span>;
    }
    return <span className="text-sm font-medium">{v}</span>;
  };
  return (
    <>
      <div className={`border-r border-[#EDE9FF] p-5 text-sm font-medium text-[#0D0D0D] dark:border-[#2A1E45] dark:text-white ${border}`}>
        {row.feature}
      </div>
      <div className={`border-r border-[#EDE9FF] bg-[#F4F0FF]/40 p-5 text-center text-[#5B21B6] dark:border-[#2A1E45] dark:bg-[#1A1424]/40 dark:text-[#C7B6F2] ${border}`}>
        {render(row.nivra)}
      </div>
      <div className={`border-r border-[#EDE9FF] p-5 text-center text-[#4B5563] dark:border-[#2A1E45] dark:text-[#94A3B8] ${border}`}>
        {render(row.bell)}
      </div>
      <div className={`p-5 text-center text-[#4B5563] dark:text-[#94A3B8] ${border}`}>
        {render(row.videotron)}
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// COVERAGE — Map preview with CTA
// ──────────────────────────────────────────────────────────────────────────────

function PremiumCoverage() {
  return (
    <Section eyebrow="Couverture" title={<>Disponible partout <span className="bg-gradient-to-r from-[#7C3AED] to-[#5B21B6] bg-clip-text text-transparent">au Québec</span></>}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7 }}
        className="relative overflow-hidden rounded-3xl border border-[#EDE9FF] bg-gradient-to-br from-[#F4F0FF] via-white to-[#F4F0FF] p-10 backdrop-blur dark:border-[#2A1E45] dark:from-[#1A1424] dark:via-[#0A0A0F] dark:to-[#1A1424] md:p-16"
      >
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <h3 className="text-3xl font-bold text-[#0D0D0D] dark:text-white">Vérifiez si Nivra est disponible chez vous</h3>
            <p className="mt-4 text-base text-[#4B5563] dark:text-[#94A3B8]">
              Couverture fibre étendue à travers Montréal, Laval, Longueuil, Brossard, Trois-Rivières, Sherbrooke et plus. Entrez votre adresse en 10 secondes.
            </p>
            <Link
              to="/couverture"
              className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-[#7C3AED] px-6 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:bg-[#6929D8]"
            >
              <MapPin className="h-4 w-4" />
              Vérifier ma couverture
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="relative h-64">
            <motion.div
              className="absolute inset-0 rounded-2xl border border-[#7C3AED]/20 bg-[radial-gradient(circle_at_50%_50%,_#7C3AED20_0%,_transparent_70%)] backdrop-blur"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Pulse dots */}
            {[
              { top: "30%", left: "40%", delay: 0 },
              { top: "55%", left: "60%", delay: 0.8 },
              { top: "45%", left: "25%", delay: 1.4 },
              { top: "20%", left: "70%", delay: 2 },
            ].map((p, i) => (
              <div key={i} className="absolute" style={{ top: p.top, left: p.left }}>
                <motion.div
                  animate={{ scale: [1, 2, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: p.delay, ease: "easeOut" }}
                  className="absolute h-4 w-4 rounded-full bg-[#7C3AED]"
                />
                <div className="relative h-3 w-3 rounded-full bg-[#7C3AED] shadow-lg" />
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </Section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TESTIMONIALS
// ──────────────────────────────────────────────────────────────────────────────

function PremiumTestimonials() {
  const reviews = [
    {
      name: "Marie L.",
      city: "Montréal",
      service: "Internet GIGA",
      quote: "Installation en 2 jours, vitesse incroyable, et c'est 35$ moins cher que mon ancien forfait Bell. Aucun regret.",
      rating: 5,
    },
    {
      name: "Karim B.",
      city: "Laval",
      service: "GIGA + TV 15 choix",
      quote: "Le service client est à Montréal, ils parlent vrai français québécois, et j'ai eu mon problème réglé en 10 minutes.",
      rating: 5,
    },
    {
      name: "Sophie T.",
      city: "Longueuil",
      service: "Internet 500",
      quote: "Premier mois gratuit, ça paraît trop beau pour être vrai. Mais c'était vrai. Un mois plus tard je suis encore satisfaite.",
      rating: 5,
    },
  ];
  return (
    <Section
      eyebrow="Témoignages"
      title={<>Ce que <span className="bg-gradient-to-r from-[#7C3AED] to-[#5B21B6] bg-clip-text text-transparent">nos clients</span> disent</>}
      subtitle="Pas des avis fabriqués. Des vrais clients québécois qui ont fait le saut."
    >
      <div className="grid gap-6 md:grid-cols-3">
        {reviews.map((r, i) => (
          <motion.div
            key={r.name}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: i * 0.12, duration: 0.6 }}
            className="relative rounded-3xl border border-[#EDE9FF] bg-white/70 p-7 backdrop-blur dark:border-[#2A1E45] dark:bg-[#0A0A0F]/40"
          >
            <Quote className="absolute right-7 top-7 h-8 w-8 text-[#7C3AED]/15" />
            <div className="mb-3 flex gap-0.5">
              {Array.from({ length: r.rating }).map((_, j) => (
                <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-sm leading-relaxed text-[#374151] dark:text-[#D1D5DB]">"{r.quote}"</p>
            <div className="mt-5 border-t border-[#EDE9FF] pt-4 dark:border-[#2A1E45]">
              <div className="text-sm font-semibold text-[#0D0D0D] dark:text-white">{r.name}</div>
              <div className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{r.city} · {r.service}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TRUST BADGES + MARQUEE
// ──────────────────────────────────────────────────────────────────────────────

function PremiumTrustRow() {
  const items = ["Visa", "Mastercard", "PayPal", "Interac", "Cloudflare", "SSL 256-bit", "Loi 25", "CRTC", "Award Local 2026"];
  return (
    <div className="relative overflow-hidden border-y border-[#EDE9FF] bg-white/40 py-6 backdrop-blur dark:border-[#2A1E45] dark:bg-[#0A0A0F]/40">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />
      <motion.div className="flex gap-12 whitespace-nowrap" animate={{ x: ["0%", "-50%"] }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }}>
        {[...items, ...items, ...items].map((item, i) => (
          <span key={`${item}-${i}`} className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#94A3B8] dark:text-[#64748B]">
            <Award className="h-4 w-4 text-[#7C3AED]/60" />
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

function PremiumTrustBadges() {
  const badges = [
    { icon: Shield, title: "100% sécurisé", text: "SSL 256-bit, paiement Visa/Mastercard/PayPal, conformité Loi 25." },
    { icon: Lock, title: "Sans engagement", text: "Annulez quand vous voulez. Aucun frais de résiliation, aucun préavis." },
    { icon: Heart, title: "Support local", text: "Équipe basée à Montréal. Vrai support en français québécois, 7 jours sur 7." },
    { icon: Zap, title: "Activation rapide", text: "Installation en 2-3 jours ouvrables après confirmation de votre adresse." },
  ];
  return (
    <Section eyebrow="Confiance" title="Pourquoi nous faire confiance">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {badges.map(({ icon: Icon, title, text }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: i * 0.1, duration: 0.6 }}
            className="rounded-2xl border border-[#EDE9FF] bg-white/60 p-6 backdrop-blur dark:border-[#2A1E45] dark:bg-[#0A0A0F]/40"
          >
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#F4F0FF] text-[#7C3AED] dark:bg-[#1A1424]">
              <Icon className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-[#0D0D0D] dark:text-white">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#6B7280] dark:text-[#94A3B8]">{text}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// FINAL CTA
// ──────────────────────────────────────────────────────────────────────────────

function PremiumFinalCTA() {
  return (
    <Section className="!pb-32">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#7C3AED] via-[#6929D8] to-[#5B21B6] p-10 text-center text-white md:p-16"
      >
        {/* Decorative blobs */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-pink-300/15 blur-3xl" />
        </div>
        <div className="relative">
          <h2 className="text-balance text-[clamp(2rem,4.5vw,3.5rem)] font-bold leading-tight">
            Prêt à passer à un internet vraiment <span className="bg-gradient-to-r from-white to-[#EDE9FF] bg-clip-text text-transparent">québécois</span> ?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg opacity-95">
            Premier mois gratuit. Sans contrat. Sans crédit. Annulez quand vous voulez. Installation en 2 jours.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/commander" className="group inline-flex h-14 items-center justify-center gap-2 rounded-full bg-white px-8 text-base font-semibold text-[#5B21B6] shadow-2xl transition-all hover:scale-[1.02] hover:bg-[#F4F0FF]">
              Commander maintenant
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link to="/couverture" className="inline-flex h-14 items-center justify-center gap-2 rounded-full border-2 border-white/40 bg-white/10 px-8 text-base font-semibold text-white backdrop-blur transition-all hover:bg-white/20">
              Vérifier ma couverture
            </Link>
          </div>
        </div>
      </motion.div>
    </Section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────────

export default function HomepagePremiumPreview() {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead {...SEO_DATA.home} />
      <Header />
      <HomeStatusBanner />
      <main id="main-content" tabIndex={-1}>
        <PremiumHero />
        <PremiumStats />
        <PremiumPricing />
        <PremiumComparison />
        <PremiumCoverage />
        <PremiumTestimonials />
        <PremiumTrustRow />
        <PremiumTrustBadges />
        <PremiumFinalCTA />
      </main>
      <Footer />

      {/* Preview meta — only visible on the sandbox page */}
      <div className="border-t border-border bg-muted/30 px-6 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          🧪 PREVIEW — Premium homepage redesign (Bell/Rogers/Fido/Vidéotron grade).
          The live homepage at <code className="rounded bg-background px-1.5 py-0.5">/</code> is untouched.
        </p>
      </div>
    </div>
  );
}
