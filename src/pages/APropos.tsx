import { motion } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/seo/SEO";
import SchemaMarkup from "@/components/seo/SchemaMarkup";
import { Link } from "react-router-dom";
import {
  Shield, CheckCircle2, MapPin, Mail, Clock,
  ChevronRight, Wifi, Tv, Smartphone, CreditCard,
  Users, Headphones, ArrowRight, Zap, Globe,
} from "lucide-react";
import { COMPANY_CONTACT } from "@/config/company";
import Testimonials from "@/components/Testimonials";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const } }),
};

const STEPS = [
  { step: "01", title: "Commande",   desc: "Choisissez vos services et complétez votre commande en ligne en quelques minutes.",   icon: Globe,    color: "#A78BFA" },
  { step: "02", title: "Paiement",   desc: "Payez par carte ou e-Transfer. Services prépayés — aucune vérification de crédit.",   icon: CreditCard, color: "#06B6D4" },
  { step: "03", title: "Activation", desc: "Activation en 10 minutes après confirmation du paiement. Livraison rapide.",           icon: Zap,      color: "#10B981" },
  { step: "04", title: "Support",    desc: "Gérez vos services via le portail client. Support 7 jours sur 7.",                    icon: Headphones, color: "#FBBF24" },
];

const WHY = [
  { icon: CreditCard, title: "Sans engagement",  desc: "Services prépayés, aucun contrat à long terme. Annulez quand vous voulez.", accent: "#A78BFA", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.3)" },
  { icon: Shield,     title: "Transparent",       desc: "Prix clairs, pas de frais cachés. Ce que vous voyez est ce que vous payez.", accent: "#06B6D4", bg: "rgba(6,182,212,0.1)",   border: "rgba(6,182,212,0.3)"   },
  { icon: Users,      title: "Portail client",     desc: "Gérez vos services, factures et tickets en ligne 24/7 depuis votre compte.",  accent: "#10B981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)"  },
  { icon: Headphones, title: "Support 7/7",        desc: "Équipe locale disponible par courriel, chat et portail à toute heure.",      accent: "#FBBF24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.3)"  },
];

const SERVICES = [
  { icon: Wifi,       name: "Internet",    desc: "Fibre XGS-PON · 940 Mbps · Sans contrat",  accent: "#A78BFA", bg: "rgba(124,58,237,0.1)", border: "rgba(124,58,237,0.3)", to: "/internet" },
  { icon: Tv,         name: "Télévision",  desc: "IPTV 4K · 100+ chaînes · Carte à la carte", accent: "#06B6D4", bg: "rgba(6,182,212,0.1)",  border: "rgba(6,182,212,0.3)",  to: "/tv" },
  { icon: Smartphone, name: "Mobile",      desc: "5G LTE · Voix/Data · Forfaits flexibles",   accent: "#10B981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)", to: "/mobile" },
];

const CITIES = ["Montréal", "Laval", "Longueuil", "Rive-Sud", "Rive-Nord", "Québec", "Sherbrooke", "Gatineau"];

const APropos = () => (
  <div style={{ background: "#020209", minHeight: "100vh" }}>
    <SEO
      title="À propos de Nivra Telecom | Fournisseur Internet Québec"
      description="Nivra Telecom est un fournisseur Internet et TV québécois qui offre des services prépayés sans contrat. Notre mission: rendre Internet accessible à tous."
      canonical="https://nivra-telecom.ca/a-propos"
    />
    <SchemaMarkup includeBrand />
    <Header />

    {/* ── Hero ── */}
    <section style={{ paddingTop: 110, paddingBottom: 80, position: "relative", overflow: "hidden" }}>
      {/* Photo bg — modern city / connectivity */}
      <div aria-hidden style={{ position:"absolute", inset:0, backgroundImage:"url('https://images.unsplash.com/photo-1617396900799-f4ec2b43c7d3?w=1920&q=80')", backgroundSize:"cover", backgroundPosition:"center 40%", opacity:0.13, zIndex:0, pointerEvents:"none", filter:"saturate(0.5) brightness(0.6)" }} />
      <div aria-hidden style={{ position:"absolute", top:"-20%", right:"-10%", width:700, height:700, borderRadius:"50%", background:"radial-gradient(ellipse, rgba(124,58,237,0.25) 0%, transparent 65%)", animation:"n-aurora-1 14s ease-in-out infinite", pointerEvents:"none" }} />
      <div aria-hidden style={{ position:"absolute", bottom:"-20%", left:"-10%", width:500, height:500, borderRadius:"50%", background:"radial-gradient(ellipse, rgba(6,182,212,0.12) 0%, transparent 65%)", animation:"n-aurora-2 18s ease-in-out infinite", pointerEvents:"none" }} />
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage:"linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)", backgroundSize:"80px 80px" }} />
      <div aria-hidden style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg, transparent, rgba(124,58,237,0.5), rgba(6,182,212,0.5), transparent)", animation:"n-scanline 10s linear infinite", pointerEvents:"none" }} />

      <div className="max-w-[900px] mx-auto px-5 sm:px-10 text-center relative">
        <div className="n-animate-in inline-flex items-center gap-2 mb-8" style={{ background:"rgba(124,58,237,0.08)", border:"1px solid rgba(124,58,237,0.3)", borderRadius:999, padding:"7px 18px" }}>
          <Shield className="w-3.5 h-3.5" style={{ color:"#A78BFA" }} />
          <span style={{ color:"#A78BFA", fontSize:11, fontWeight:700, letterSpacing:2, textTransform:"uppercase", fontFamily:"'JetBrains Mono', monospace" }}>
            Fournisseur télécom québécois
          </span>
        </div>
        <h1 className="n-animate-in-delay-1" style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:"clamp(40px, 6vw, 72px)", letterSpacing:"-2.5px", lineHeight:1.0, marginBottom:20, color:"#fff" }}>
          À propos de{" "}<span className="n-shimmer-text">{COMPANY_CONTACT.companyName}</span>
        </h1>
        <p className="n-animate-in-delay-2" style={{ color:"rgba(255,255,255,0.55)", fontSize:18, lineHeight:1.7, maxWidth:580, margin:"0 auto 40px" }}>
          <strong style={{ color:"rgba(255,255,255,0.85)" }}>{COMPANY_CONTACT.legalName}</strong> — Fournisseur de services Internet, TV et Mobile prépayés sans contrat au Québec. Simplicité, transparence, contrôle.
        </p>
        {/* Quick stats row */}
        <div className="n-animate-in-delay-3 flex flex-wrap justify-center gap-4">
          {[
            { val:"940 Mbps", desc:"Vitesse max fibre",         color:"#A78BFA" },
            { val:"Sans contrat", desc:"Résiliez à tout moment", color:"#06B6D4" },
            { val:"10 min", desc:"Activation en ligne",         color:"#10B981" },
            { val:"Québec 🍁", desc:"Entreprise locale",         color:"#FBBF24" },
          ].map((s) => (
            <div key={s.val} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:"12px 20px", textAlign:"center", backdropFilter:"blur(12px)" }}>
              <div style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:18, letterSpacing:"-0.5px", color:s.color }}>{s.val}</div>
              <div style={{ color:"rgba(255,255,255,0.4)", fontSize:11, marginTop:3, fontFamily:"'JetBrains Mono', monospace" }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── Mission ── */}
    <section style={{ background:"#06040F", paddingTop:80, paddingBottom:80, borderTop:"1px solid rgba(124,58,237,0.08)" }}>
      <div className="max-w-[1100px] mx-auto px-5 sm:px-10">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp}>
            <div className="inline-flex items-center gap-2 mb-5" style={{ background:"rgba(124,58,237,0.08)", border:"1px solid rgba(124,58,237,0.25)", borderRadius:999, padding:"6px 14px" }}>
              <Shield className="w-3 h-3" style={{ color:"#A78BFA" }} />
              <span style={{ color:"#A78BFA", fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", fontFamily:"'JetBrains Mono', monospace" }}>Notre mission</span>
            </div>
            <h2 style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:"clamp(28px, 4vw, 44px)", letterSpacing:"-1.5px", color:"#fff", marginBottom:16, lineHeight:1.1 }}>
              Internet pour <span className="n-shimmer-text">tout le monde</span>
            </h2>
            <p style={{ color:"rgba(255,255,255,0.5)", fontSize:16, lineHeight:1.75, marginBottom:28 }}>
              {COMPANY_CONTACT.companyName} offre des services de téléphonie mobile prépayée, Internet, télévision et sécurité au Québec. Notre approche repose sur trois piliers : <strong style={{ color:"rgba(255,255,255,0.85)" }}>simplicité</strong>, <strong style={{ color:"rgba(255,255,255,0.85)" }}>transparence</strong> et <strong style={{ color:"rgba(255,255,255,0.85)" }}>contrôle</strong>.
            </p>
            <div className="space-y-3">
              {[
                { label: "Prépayé",                       desc: "Payez à l'avance, aucune surprise sur votre facture." },
                { label: "Sans engagement",               desc: "Annulez à tout moment, sans frais ni pénalité." },
                { label: "Aucune vérification de crédit", desc: "Service accessible à tous, sans discrimination." },
              ].map(({ label, desc }) => (
                <div key={label} className="flex items-start gap-3">
                  <div style={{ width:20, height:20, borderRadius:999, background:"rgba(124,58,237,0.2)", border:"1px solid rgba(124,58,237,0.4)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2 }}>
                    <CheckCircle2 className="w-3 h-3" style={{ color:"#A78BFA" }} />
                  </div>
                  <div>
                    <span style={{ color:"#fff", fontWeight:600, fontSize:14, fontFamily:"'Space Grotesk', sans-serif" }}>{label}</span>
                    <span style={{ color:"rgba(255,255,255,0.45)", fontSize:14 }}> — {desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Brand visual */}
          <motion.div initial={{ opacity:0, x:30 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }} transition={{ duration:0.65, ease:[0.22,1,0.36,1] }} className="flex justify-center">
            <div className="relative" style={{ width:340, height:340 }}>
              <div aria-hidden style={{ position:"absolute", inset:0, borderRadius:"50%", background:"radial-gradient(ellipse, rgba(124,58,237,0.2) 0%, transparent 65%)", pointerEvents:"none" }} />
              <div style={{ width:"100%", height:"100%", borderRadius:32, background:"linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(6,182,212,0.08) 100%)", border:"1px solid rgba(124,58,237,0.3)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, backdropFilter:"blur(20px)" }}>
                <div style={{ width:80, height:80, borderRadius:22, background:"linear-gradient(135deg, #7C3AED, #6D28D9)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 16px 48px rgba(124,58,237,0.5)" }}>
                  <span style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:36, color:"#fff" }}>N</span>
                </div>
                <div style={{ textAlign:"center" }}>
                  <p style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:22, color:"#fff", letterSpacing:"-1px" }}>{COMPANY_CONTACT.companyName}</p>
                  <p style={{ color:"rgba(255,255,255,0.4)", fontSize:11, fontFamily:"'JetBrains Mono', monospace", letterSpacing:2, textTransform:"uppercase", marginTop:4 }}>{COMPANY_CONTACT.legalName}</p>
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center", padding:"0 20px" }}>
                  {["Québec 🍁", "Sans contrat", "CRTC ✓"].map((tag) => (
                    <span key={tag} style={{ background:"rgba(124,58,237,0.15)", border:"1px solid rgba(124,58,237,0.3)", borderRadius:999, padding:"4px 10px", color:"#C4B5FD", fontSize:11, fontWeight:600, fontFamily:"'JetBrains Mono', monospace" }}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>

    {/* ── Services ── */}
    <section style={{ background:"#020209", paddingTop:80, paddingBottom:80, borderTop:"1px solid rgba(124,58,237,0.08)" }}>
      <div className="max-w-[1100px] mx-auto px-5 sm:px-10">
        <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.55 }} className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background:"rgba(6,182,212,0.1)", border:"1px solid rgba(6,182,212,0.3)", borderRadius:100 }}>
            <Wifi className="w-3.5 h-3.5" style={{ color:"#67E8F9" }} />
            <span style={{ fontFamily:"'JetBrains Mono', monospace", color:"#67E8F9", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase" }}>Nos services</span>
          </div>
          <h2 style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:"clamp(26px, 4vw, 44px)", letterSpacing:"-1.5px", color:"#fff" }}>
            Des solutions <span className="n-shimmer-text">complètes</span>
          </h2>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-5">
          {SERVICES.map((s, i) => (
            <motion.div key={s.name} custom={i} initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp}>
              <Link to={s.to} style={{ textDecoration:"none", display:"block" }}>
                <div className="rounded-2xl p-7 h-full"
                  style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", transition:"all .25s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor=s.border; (e.currentTarget as HTMLElement).style.boxShadow=`0 8px 32px ${s.bg}`; (e.currentTarget as HTMLElement).style.transform="translateY(-3px)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.boxShadow="none"; (e.currentTarget as HTMLElement).style.transform="none"; }}
                >
                  <div style={{ width:52, height:52, borderRadius:14, background:s.bg, border:`1px solid ${s.border}`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:16 }}>
                    <s.icon className="w-6 h-6" style={{ color:s.accent }} />
                  </div>
                  <h3 style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:700, fontSize:18, color:"#fff", marginBottom:8 }}>{s.name}</h3>
                  <p style={{ color:"rgba(255,255,255,0.45)", fontSize:13.5, lineHeight:1.6, marginBottom:16 }}>{s.desc}</p>
                  <div className="flex items-center gap-1" style={{ color:s.accent, fontSize:13, fontWeight:600 }}>
                    En savoir plus <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* ── Zones desservies ── */}
    <section style={{ background:"#06040F", paddingTop:80, paddingBottom:80, borderTop:"1px solid rgba(124,58,237,0.08)" }}>
      <div className="max-w-[1100px] mx-auto px-5 sm:px-10">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp}>
            <div className="inline-flex items-center gap-2 mb-5" style={{ background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.25)", borderRadius:999, padding:"6px 14px" }}>
              <MapPin className="w-3 h-3" style={{ color:"#34D399" }} />
              <span style={{ color:"#34D399", fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", fontFamily:"'JetBrains Mono', monospace" }}>Couverture</span>
            </div>
            <h2 style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:"clamp(26px, 4vw, 44px)", letterSpacing:"-1.5px", color:"#fff", marginBottom:14, lineHeight:1.1 }}>
              Service partout <span className="n-shimmer-text">au Québec</span>
            </h2>
            <p style={{ color:"rgba(255,255,255,0.5)", fontSize:16, lineHeight:1.75, marginBottom:28 }}>
              Nous desservons principalement le Québec avec une couverture optimale dans la région du Grand Montréal. Livraison express disponible dans certaines zones.
            </p>
            <div className="flex flex-wrap gap-2">
              {CITIES.map((city) => (
                <span key={city} style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(16,185,129,0.07)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:10, padding:"7px 14px", color:"rgba(255,255,255,0.75)", fontSize:13, fontFamily:"'Space Grotesk', sans-serif", fontWeight:500 }}>
                  <MapPin className="w-3 h-3" style={{ color:"#34D399" }} />{city}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Coverage visual */}
          <motion.div initial={{ opacity:0, x:30 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }} transition={{ duration:0.65, ease:[0.22,1,0.36,1] }}>
            <div style={{ borderRadius:24, background:"linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(255,255,255,0.03) 100%)", border:"1px solid rgba(16,185,129,0.2)", overflow:"hidden", aspectRatio:"16/10", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(16px)", position:"relative" }}>
              <div aria-hidden style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(16,185,129,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.04) 1px, transparent 1px)", backgroundSize:"40px 40px", pointerEvents:"none" }} />
              <div className="text-center relative z-10">
                <div style={{ width:60, height:60, borderRadius:"50%", background:"rgba(16,185,129,0.15)", border:"1px solid rgba(16,185,129,0.4)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px", animation:"n-border-glow 3s ease-in-out infinite" }}>
                  <MapPin className="w-7 h-7" style={{ color:"#34D399" }} />
                </div>
                <p style={{ color:"#34D399", fontWeight:700, fontSize:16, fontFamily:"'Space Grotesk', sans-serif", marginBottom:4 }}>22+ villes couvertes</p>
                <p style={{ color:"rgba(255,255,255,0.4)", fontSize:12, fontFamily:"'JetBrains Mono', monospace" }}>Et en expansion chaque trimestre</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>

    {/* ── Pourquoi Nivra ── */}
    <section style={{ background:"#020209", paddingTop:80, paddingBottom:80, borderTop:"1px solid rgba(124,58,237,0.08)" }}>
      <div className="max-w-[1100px] mx-auto px-5 sm:px-10">
        <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.55 }} className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background:"rgba(124,58,237,0.1)", border:"1px solid rgba(124,58,237,0.3)", borderRadius:100 }}>
            <Shield className="w-3.5 h-3.5" style={{ color:"#A78BFA" }} />
            <span style={{ fontFamily:"'JetBrains Mono', monospace", color:"#A78BFA", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase" }}>Pourquoi choisir Nivra</span>
          </div>
          <h2 style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:"clamp(26px, 4vw, 44px)", letterSpacing:"-1.5px", color:"#fff" }}>
            Ce qui nous <span className="n-shimmer-text">différencie</span>
          </h2>
        </motion.div>
        <div className="grid md:grid-cols-2 gap-4">
          {WHY.map((item, i) => (
            <motion.div key={item.title} custom={i} initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp}
              className="flex gap-4 rounded-2xl p-6"
              style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", transition:"border-color .22s, box-shadow .22s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor=item.border; (e.currentTarget as HTMLElement).style.boxShadow=`0 6px 28px ${item.bg}`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.boxShadow="none"; }}
            >
              <div style={{ width:44, height:44, borderRadius:12, background:item.bg, border:`1px solid ${item.border}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <item.icon className="w-5 h-5" style={{ color:item.accent }} />
              </div>
              <div>
                <h3 style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:700, fontSize:16, color:"#fff", marginBottom:6 }}>{item.title}</h3>
                <p style={{ color:"rgba(255,255,255,0.5)", fontSize:14, lineHeight:1.6 }}>{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* ── Comment ça fonctionne ── */}
    <section style={{ background:"#06040F", paddingTop:80, paddingBottom:80, borderTop:"1px solid rgba(124,58,237,0.08)" }}>
      <div className="max-w-[1100px] mx-auto px-5 sm:px-10">
        <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.55 }} className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background:"rgba(251,191,36,0.1)", border:"1px solid rgba(251,191,36,0.3)", borderRadius:100 }}>
            <Zap className="w-3.5 h-3.5" style={{ color:"#FCD34D" }} />
            <span style={{ fontFamily:"'JetBrains Mono', monospace", color:"#FCD34D", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase" }}>Comment ça fonctionne</span>
          </div>
          <h2 style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:"clamp(26px, 4vw, 44px)", letterSpacing:"-1.5px", color:"#fff" }}>
            4 étapes pour <span className="n-shimmer-text">vous connecter</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 relative">
          {/* Connector line — desktop */}
          <div aria-hidden className="hidden md:block absolute top-[44px] left-[12%] right-[12%]" style={{ height:1, background:"linear-gradient(90deg, rgba(124,58,237,0.4), rgba(6,182,212,0.3), rgba(124,58,237,0.4))", zIndex:0 }} />

          {STEPS.map((step, i) => (
            <motion.div key={step.step} custom={i} initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp} className="text-center relative z-10">
              <div style={{ width:80, height:80, borderRadius:20, background:`${step.color}14`, border:`1.5px solid ${step.color}40`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", position:"relative" }}>
                <step.icon className="w-8 h-8" style={{ color:step.color }} />
                <span style={{ position:"absolute", top:-8, right:-8, width:22, height:22, borderRadius:999, background:`${step.color}`, color:"#fff", fontSize:10, fontWeight:800, fontFamily:"'JetBrains Mono', monospace", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 }}>{step.step}</span>
              </div>
              <h3 style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:700, fontSize:16, color:"#fff", marginBottom:8 }}>{step.title}</h3>
              <p style={{ color:"rgba(255,255,255,0.45)", fontSize:13, lineHeight:1.6 }}>{step.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity:0, y:16 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.5, delay:0.3 }} className="text-center mt-14">
          <Link to="/commander" className="inline-flex items-center gap-2 font-bold text-white"
            style={{ height:52, padding:"0 36px", borderRadius:12, background:"linear-gradient(135deg, #7C3AED, #6D28D9)", boxShadow:"0 8px 32px rgba(124,58,237,0.4)", textDecoration:"none", fontFamily:"'Space Grotesk', sans-serif", fontSize:15, transition:"box-shadow .18s, transform .15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow="0 12px 40px rgba(124,58,237,0.6)"; e.currentTarget.style.transform="translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow="0 8px 32px rgba(124,58,237,0.4)"; e.currentTarget.style.transform="none"; }}
          >
            Commander maintenant <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>

    {/* ── Testimonials ── */}
    <Testimonials />

    {/* ── Nous joindre ── */}
    <section style={{ background:"#020209", paddingTop:80, paddingBottom:80, borderTop:"1px solid rgba(124,58,237,0.08)" }}>
      <div className="max-w-[900px] mx-auto px-5 sm:px-10">
        <motion.div initial={{ opacity:0, y:24 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.55 }}>
          <div style={{ borderRadius:24, background:"linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(6,182,212,0.06) 100%)", border:"1px solid rgba(124,58,237,0.25)", padding:"48px 40px", position:"relative", overflow:"hidden" }}>
            <div aria-hidden style={{ position:"absolute", top:0, left:0, right:0, height:1, background:"linear-gradient(90deg, transparent, rgba(124,58,237,0.6), transparent)", pointerEvents:"none" }} />
            <div aria-hidden style={{ position:"absolute", top:"-40%", left:"50%", transform:"translateX(-50%)", width:400, height:200, background:"radial-gradient(ellipse, rgba(124,58,237,0.12), transparent 70%)", pointerEvents:"none" }} />

            <h2 className="text-center" style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:"clamp(22px, 3.5vw, 36px)", letterSpacing:"-1px", color:"#fff", marginBottom:36 }}>
              Nous <span className="n-shimmer-text">joindre</span>
            </h2>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Mail,        label:"Courriel",          val:COMPANY_CONTACT.supportEmailDisplay, href:`mailto:${COMPANY_CONTACT.supportEmail}`, color:"#A78BFA" },
                { icon: Clock,       label:"Heures de support",  val:"Lun–Ven 9h–20h · Sam–Dim 10h–18h",  href:null, color:"#06B6D4" },
                { icon: Headphones,  label:"Chat & Tickets",     val:"Portail client 24/7",               href:"/contact", color:"#10B981" },
              ].map(({ icon:Icon, label, val, href, color }) => (
                <div key={label} style={{ textAlign:"center" }}>
                  <div style={{ width:48, height:48, borderRadius:12, background:`${color}14`, border:`1px solid ${color}30`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <p style={{ color:"rgba(255,255,255,0.4)", fontSize:11, fontFamily:"'JetBrains Mono', monospace", letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>{label}</p>
                  {href ? (
                    <Link to={href.startsWith("mailto") ? href : href} style={{ color:"#fff", fontFamily:"'Space Grotesk', sans-serif", fontWeight:600, fontSize:14, textDecoration:"none", transition:"color .15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = color)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#fff")}
                    >{val}</Link>
                  ) : (
                    <p style={{ color:"rgba(255,255,255,0.7)", fontFamily:"'Space Grotesk', sans-serif", fontSize:14, fontWeight:500 }}>{val}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="text-center mt-10">
              <Link to="/contact" className="inline-flex items-center gap-2 font-bold text-white"
                style={{ height:50, padding:"0 32px", borderRadius:12, background:"linear-gradient(135deg, #7C3AED, #6D28D9)", boxShadow:"0 8px 32px rgba(124,58,237,0.4)", textDecoration:"none", fontFamily:"'Space Grotesk', sans-serif", fontSize:15, transition:"box-shadow .18s, transform .15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow="0 12px 40px rgba(124,58,237,0.6)"; e.currentTarget.style.transform="translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow="0 8px 32px rgba(124,58,237,0.4)"; e.currentTarget.style.transform="none"; }}
              >
                Contactez-nous <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>

    <Footer />
  </div>
);

export default APropos;
