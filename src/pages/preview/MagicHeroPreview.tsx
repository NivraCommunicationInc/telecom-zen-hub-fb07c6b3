/**
 * PREVIEW — Magic-generated premium hero for Nivra Telecom
 *
 * Sandbox file. NOT wired into the public homepage. Visit /preview/magic-hero
 * (added as a dev-only route below) to evaluate the design before deciding
 * to replace the production Hero component.
 *
 * Inspired by 21st.dev's "hero-1" pattern (grid background + radial accent +
 * gradient title + eyebrow badge), adapted to Nivra brand:
 *   - Primary violet #7C3AED with lavender accent #EDE9FF
 *   - French content (Quebec telecom positioning)
 *   - Two CTAs (Commander / Voir les forfaits)
 *   - Trust-badges row (Sans contrat / Sans crédit / Premier mois gratuit)
 *   - Light-mode first (Nivra brand). Dark-mode fallback included.
 *
 * Zero impact on production:
 *   - Standalone — does not import existing Hero / HomePricing components
 *   - Route is only mounted in dev (PROD branch skips it)
 *   - Brand colors come from existing CSS tokens — no new design system
 */
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Shield, Sparkles } from "lucide-react";

export default function MagicHeroPreview() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section
        id="hero"
        className="
          relative mx-auto w-full overflow-hidden
          px-6 pt-32 pb-24 text-center md:px-8 md:pt-40 md:pb-32
          bg-[linear-gradient(to_bottom,#FFFFFF,#FFFFFF_50%,#F4F0FF_88%)]
          dark:bg-[linear-gradient(to_bottom,#0A0A0F,#0A0A0F_30%,#1A1424_78%,#7C3AED_99%_50%)]
        "
      >
        {/* Subtle grid background, masked into a radial fade */}
        <div
          aria-hidden="true"
          className="
            pointer-events-none absolute inset-0 -z-10 h-[640px] w-full opacity-70
            bg-[linear-gradient(to_right,#EDE9FF_1px,transparent_1px),linear-gradient(to_bottom,#EDE9FF_1px,transparent_1px)]
            dark:bg-[linear-gradient(to_right,#2A1E45_1px,transparent_1px),linear-gradient(to_bottom,#2A1E45_1px,transparent_1px)]
            bg-[size:6rem_5rem]
            [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]
          "
        />

        {/* Radial accent disc behind the hero */}
        <div
          aria-hidden="true"
          className="
            pointer-events-none absolute left-1/2 top-[calc(100%-160px)]
            h-[500px] w-[700px] -translate-x-1/2 rounded-[100%]
            border border-[#C7B6F2]/40
            bg-white
            bg-[radial-gradient(closest-side,#FFFFFF_82%,#7C3AED)]
            dark:bg-[radial-gradient(closest-side,#0A0A0F_82%,#7C3AED)]
            md:h-[600px] md:w-[1100px]
            lg:h-[760px] lg:w-[140%]
          "
        />

        {/* Eyebrow pill */}
        <a
          href="/garantie"
          className="group inline-flex items-center justify-center"
        >
          <span
            className="
              mx-auto flex w-fit items-center justify-center gap-2
              rounded-full border-2 border-[#E0D5FA] bg-white/80 px-5 py-2
              text-xs font-semibold uppercase tracking-wider text-[#5B21B6]
              shadow-sm backdrop-blur
              dark:border-[#3F2B6E] dark:bg-[#1A1424]/80 dark:text-[#C7B6F2]
            "
          >
            <Sparkles className="h-3.5 w-3.5" />
            Premier mois gratuit — Sans contrat
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </a>

        {/* Title — gradient on the key phrase */}
        <h1
          className="
            relative z-10 mx-auto mt-8 max-w-[18ch] text-balance
            text-5xl font-bold leading-[1.05] tracking-tight
            text-[#0D0D0D]
            dark:text-white
            sm:text-6xl md:text-7xl lg:text-[88px]
          "
        >
          Internet{" "}
          <span
            className="
              bg-gradient-to-br from-[#7C3AED] via-[#9D6EF8] to-[#5B21B6]
              bg-clip-text text-transparent
            "
          >
            sans contrat
          </span>{" "}
          à 60$/mois
        </h1>

        {/* Subtitle */}
        <p
          className="
            relative z-10 mx-auto mt-6 max-w-[60ch] text-balance
            text-lg leading-relaxed tracking-tight text-[#4B5563]
            dark:text-[#94A3B8]
            md:text-xl
          "
        >
          Nivra Telecom — l'alternative québécoise sans engagement, sans
          vérification de crédit. Annulez quand vous voulez, le premier mois
          de service est offert.
        </p>

        {/* CTAs */}
        <div className="relative z-10 mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/commander"
            className="
              inline-flex h-12 w-full items-center justify-center gap-2 rounded-full
              bg-[#7C3AED] px-8 text-base font-semibold text-white
              shadow-[0_8px_30px_-8px_rgba(124,58,237,0.6)]
              transition-all duration-200
              hover:bg-[#6929D8] hover:shadow-[0_12px_40px_-8px_rgba(124,58,237,0.8)]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2
              sm:w-auto
            "
          >
            Commander maintenant
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/forfaits"
            className="
              inline-flex h-12 w-full items-center justify-center rounded-full
              border-2 border-[#D0C4F3] bg-white px-8 text-base font-semibold text-[#5B21B6]
              transition-all duration-200
              hover:border-[#7C3AED] hover:bg-[#F4F0FF]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2
              dark:border-[#3F2B6E] dark:bg-transparent dark:text-[#C7B6F2] dark:hover:bg-[#1A1424]
              sm:w-auto
            "
          >
            Voir les forfaits
          </Link>
        </div>

        {/* Trust badges row */}
        <ul
          className="
            relative z-10 mx-auto mt-10 flex flex-wrap items-center justify-center
            gap-x-6 gap-y-3 text-sm font-medium text-[#4B5563]
            dark:text-[#94A3B8]
          "
        >
          <li className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#7C3AED]" />
            Aucun engagement
          </li>
          <li className="inline-flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#7C3AED]" />
            Aucune vérification de crédit
          </li>
          <li className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#7C3AED]" />
            Premier mois gratuit
          </li>
        </ul>

        {/* Stats / social proof row */}
        <div
          className="
            relative z-10 mx-auto mt-16 grid max-w-3xl grid-cols-3 gap-6
            border-t border-[#EDE9FF] pt-8
            dark:border-[#2A1E45]
          "
        >
          {[
            { value: "1 010", label: "Mbps fibre" },
            { value: "60$", label: "/mois tout inclus" },
            { value: "24/7", label: "Support local QC" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-[#0D0D0D] dark:text-white md:text-3xl">
                {stat.value}
              </div>
              <div className="mt-1 text-xs uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Preview meta — visible only on the sandbox page so reviewer knows
          this is not the live homepage. Remove when promoting to prod. */}
      <div className="border-t border-border bg-muted/30 px-6 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          🧪 PREVIEW — Magic-generated hero (sandbox). Not wired into the live
          homepage. Visit{" "}
          <code className="rounded bg-background px-1.5 py-0.5">/preview/magic-hero</code>{" "}
          to view; nothing on the public site is affected.
        </p>
      </div>
    </main>
  );
}
