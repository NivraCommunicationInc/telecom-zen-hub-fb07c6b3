import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  HelpCircle, FileText, Download, Wifi, Tv, RotateCcw,
  Mail, MessageSquare, Clock, AlertCircle, CheckCircle2,
  ChevronDown, Zap, Shield, ArrowRight,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import SEOHead from "@/components/SEOHead";

const STORAGE_BASE =
  "https://xtgngmtxggascbxnswvb.supabase.co/storage/v1/object/public/installation-guides";
const SUPPORT_EMAIL = "support@nivra-telecom.ca";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] as const } }),
};

function Accordion({ items, icon: Icon, accent }: {
  items: { title: string; body: string }[];
  icon: React.ElementType;
  accent: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} style={{ borderRadius:14, border:`1px solid ${open===i ? accent+"40" : "rgba(255,255,255,0.07)"}`, overflow:"hidden", transition:"border-color .2s", background:"rgba(255,255,255,0.03)" }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full text-left flex items-center justify-between gap-4"
            style={{ padding:"18px 22px", background:"none", border:"none", cursor:"pointer" }}
          >
            <div className="flex items-center gap-3">
              <div style={{ width:28, height:28, borderRadius:8, background:`${accent}14`, border:`1px solid ${accent}30`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Icon className="w-3.5 h-3.5" style={{ color:accent }} />
              </div>
              <span style={{ color:"#fff", fontFamily:"'Space Grotesk', sans-serif", fontWeight:600, fontSize:14, lineHeight:1.4 }}>{item.title}</span>
            </div>
            <motion.div animate={{ rotate: open === i ? 180 : 0 }} transition={{ duration:0.2 }}>
              <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color:"rgba(255,255,255,0.4)" }} />
            </motion.div>
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }} exit={{ height:0, opacity:0 }} transition={{ duration:0.22 }} style={{ overflow:"hidden" }}>
                <div style={{ padding:"0 22px 18px 22px", paddingLeft:61, color:"rgba(255,255,255,0.55)", fontSize:13.5, lineHeight:1.7, whiteSpace:"pre-line" }}>
                  {item.body}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

const Support = () => {
  const { language } = useLanguage();
  const isFr = language === "fr";

  const guides = [
    { title: isFr ? "Borne Nivra WiFi" : "Nivra WiFi Modem",    lang: "FR", file: "guide-borne-nivra-wifi-fr.pdf",    icon: Wifi, accent: "#A78BFA", bg: "rgba(124,58,237,0.1)", border: "rgba(124,58,237,0.3)" },
    { title: isFr ? "Borne Nivra WiFi" : "Nivra WiFi Modem",    lang: "EN", file: "guide-borne-nivra-wifi-en.pdf",    icon: Wifi, accent: "#06B6D4", bg: "rgba(6,182,212,0.1)",   border: "rgba(6,182,212,0.3)"  },
    { title: isFr ? "Terminal Nivra TV" : "Nivra TV Terminal",  lang: "FR", file: "guide-terminal-nivra-tv-fr.pdf",  icon: Tv,   accent: "#10B981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)" },
    { title: isFr ? "Terminal Nivra TV" : "Nivra TV Terminal",  lang: "EN", file: "guide-terminal-nivra-tv-en.pdf",  icon: Tv,   accent: "#FBBF24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.3)" },
  ];

  const troubleshooting = [
    { title: isFr ? "Voyant orange ou clignotant" : "Orange or blinking light",        body: isFr ? "La borne est en cours de démarrage. Attendez jusqu'à 20 minutes. Ne débranchez pas." : "The modem is starting up. Wait up to 20 minutes. Do not unplug." },
    { title: isFr ? "Pas de connexion Internet" : "No Internet connection",            body: isFr ? "1. Débranchez la borne 30 secondes\n2. Rebranchez et attendez 3 minutes\n3. Si le problème persiste, contactez-nous" : "1. Unplug the modem for 30 seconds\n2. Plug back in and wait 3 minutes\n3. If issue persists, contact us" },
    { title: isFr ? "WiFi lent ou instable" : "Slow or unstable WiFi",                body: isFr ? "Rapprochez vos appareils de la borne. Évitez les obstacles (murs épais, électroménagers). Redémarrez la borne." : "Move devices closer to the modem. Avoid obstacles (thick walls, appliances). Restart the modem." },
    { title: isFr ? "Terminal TV — écran noir" : "TV Terminal — black screen",         body: isFr ? "Vérifiez que vous êtes sur la bonne entrée HDMI. Débranchez le terminal 30 secondes et rebranchez." : "Check that you selected the correct HDMI input. Unplug the terminal for 30 seconds and plug back in." },
    { title: isFr ? "Terminal TV — ne se connecte pas au WiFi" : "TV Terminal — won't connect to WiFi", body: isFr ? "Vérifiez votre mot de passe WiFi (majuscules et minuscules). Essayez la connexion WPS — appuyez sur le bouton WPS sous la borne ET sous le terminal en même temps." : "Check your WiFi password (upper and lower case matter). Try WPS — press the WPS button under the modem AND under the terminal at the same time." },
  ];

  const faq = [
    { q: isFr ? "Est-ce qu'il y a un contrat à signer?" : "Is there a contract to sign?",                                                               a: isFr ? "Non. Aucun contrat. Résiliez à tout moment sans frais." : "No. No contract. Cancel anytime at no charge." },
    { q: isFr ? "Comment demander l'activation de mon service?" : "How do I request service activation?",                                               a: isFr ? "Connectez-vous à votre portail client, cliquez sur « Activation WiFi » et remplissez le formulaire. Notre équipe active votre service en 10 à 30 minutes." : "Log in to your client portal, click \"WiFi Activation\" and fill out the form. Our team activates your service within 10 to 30 minutes." },
    { q: isFr ? "Combien de temps prend l'activation?" : "How long does activation take?",                                                              a: isFr ? "Entre 10 et 30 minutes une fois votre demande soumise. Vous recevrez un courriel de confirmation." : "Between 10 and 30 minutes once your request is submitted. You will receive a confirmation email." },
    { q: isFr ? "Est-ce que je peux garder mon équipement si j'annule?" : "Can I keep my equipment if I cancel?",                                       a: isFr ? "Oui. L'équipement vous appartient après paiement. Vous n'avez pas à le retourner." : "Yes. The equipment belongs to you after purchase. You do not need to return it." },
    { q: isFr ? "Comment payer ma facture?" : "How do I pay my bill?",                                                                                  a: isFr ? "Connectez-vous à votre espace client nivra-telecom.ca/portail et cliquez sur « Payer maintenant »." : "Log in to your client portal at nivra-telecom.ca/portail and click \"Pay Now\"." },
    { q: isFr ? "Que faire si mon voyant reste orange après 20 minutes?" : "What if my light stays orange after 20 minutes?",                           a: isFr ? "Vérifiez que le câble coaxial est bien vissé à la borne ET à la prise murale. Essayez une autre prise coaxiale si disponible. Contactez-nous si le problème persiste." : "Check that the coaxial cable is firmly screwed to the modem AND to the wall outlet. Try another coaxial outlet if available. Contact us if the issue persists." },
    { q: isFr ? "Est-ce que la vérification de crédit est requise?" : "Is a credit check required?",                                                   a: isFr ? "Non. Aucune vérification de crédit. Tout le monde est accepté." : "No. No credit check. Everyone is accepted." },
    { q: isFr ? "Comment réinitialiser mon équipement?" : "How do I reset my equipment?",                                                              a: isFr ? "Consultez la section « Réinitialisation complète » sur cette page ou téléchargez le guide PDF." : "See the \"Full Reset\" section on this page or download the PDF guide." },
  ];

  const remoteSteps = isFr
    ? ["Appuyez sur EXIT pour effacer tout message d'erreur", "Maintenez A + D simultanément pendant 5 secondes jusqu'au voyant vert", "Appuyez sur 9, 8, 1 rapidement — le voyant clignote 3 fois = succès"]
    : ["Press EXIT to clear any error message", "Hold A + D simultaneously for 5 seconds until light turns green", "Press 9, 8, 1 quickly — light blinks 3 times = success"];

  const terminalSteps = isFr
    ? ["Maintenez PWR 5 secondes", "Appuyez sur le bouton central de navigation", "Appuyez sur la flèche droite ▶", "Appuyez sur la flèche bas ▼", "Appuyez sur PWR pour redémarrer"]
    : ["Hold PWR for 5 seconds", "Press the center navigation button", "Press the right arrow ▶", "Press the down arrow ▼", "Press PWR to restart"];

  const openChat = () => window.dispatchEvent(new CustomEvent("nivra:open-chat"));

  return (
    <div style={{ background: "#020209", minHeight: "100vh" }}>
      <SEOHead
        title={isFr ? "Support — Nivra Télécom" : "Support — Nivra Telecom"}
        description={isFr ? "Centre de support Nivra : guides d'installation PDF, dépannage rapide, FAQ et contact." : "Nivra support center: PDF installation guides, quick troubleshooting, FAQ and contact."}
      />
      <Header />

      {/* ── Hero ── */}
      <section style={{ paddingTop:120, paddingBottom:80, position:"relative", overflow:"hidden" }}>
        {/* Photo bg — data center / fiber */}
        <div aria-hidden style={{ position:"absolute", inset:0, backgroundImage:"url('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80')", backgroundSize:"cover", backgroundPosition:"center", opacity:0.11, zIndex:0, pointerEvents:"none", filter:"saturate(0.5) brightness(0.65)" }} />
        <div aria-hidden style={{ position:"absolute", top:"-20%", left:"-10%", width:550, height:550, borderRadius:"50%", background:"radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)", animation:"n-aurora-1 18s ease-in-out infinite", pointerEvents:"none" }} />
        <div aria-hidden style={{ position:"absolute", bottom:"-20%", right:"-10%", width:450, height:450, borderRadius:"50%", background:"radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)", animation:"n-aurora-2 14s ease-in-out infinite", pointerEvents:"none" }} />
        <div aria-hidden style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)", backgroundSize:"80px 80px", pointerEvents:"none" }} />
        <div aria-hidden style={{ position:"absolute", left:0, right:0, height:2, background:"linear-gradient(90deg, transparent, rgba(124,58,237,0.4), rgba(6,182,212,0.4), transparent)", animation:"n-scanline 10s linear infinite", pointerEvents:"none" }} />

        <div className="max-w-[800px] mx-auto px-5 sm:px-10 text-center" style={{ position:"relative", zIndex:2 }}>
          <div className="n-animate-in inline-flex items-center gap-2 mb-6" style={{ background:"rgba(124,58,237,0.15)", border:"1px solid rgba(124,58,237,0.3)", borderRadius:100, padding:"6px 16px" }}>
            <HelpCircle style={{ width:14, height:14, color:"#7C3AED" }} />
            <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:11, color:"#A78BFA", letterSpacing:"0.1em", textTransform:"uppercase" }}>SUPPORT</span>
          </div>
          <h1 className="n-animate-in-delay-1" style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:"clamp(36px, 5.5vw, 60px)", letterSpacing:"-2.5px", lineHeight:1.0, marginBottom:16, color:"#fff" }}>
            {isFr ? <>Besoin d'aide?{" "}<span className="n-shimmer-text">On est là.</span></> : <>Need help?{" "}<span className="n-shimmer-text">We're here.</span></>}
          </h1>
          <p className="n-animate-in-delay-2" style={{ fontSize:18, color:"rgba(255,255,255,0.6)", maxWidth:520, margin:"0 auto 32px" }}>
            {isFr ? "Support 7 jours sur 7 • 8h à 20h • " : "Support 7 days a week • 8AM to 8PM • "}
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color:"#A78BFA", textDecoration:"none", fontWeight:600 }}>{SUPPORT_EMAIL}</a>
          </p>
          {/* Quick nav chips */}
          <div className="n-animate-in-delay-3 flex flex-wrap justify-center gap-2">
            {[
              { label: isFr ? "Guides PDF" : "PDF Guides",          href:"#guides",   color:"#A78BFA" },
              { label: isFr ? "Activation" : "Activation",          href:"#activation", color:"#06B6D4" },
              { label: isFr ? "Dépannage" : "Troubleshooting",      href:"#depannage", color:"#10B981" },
              { label: isFr ? "Réinitialisation" : "Full Reset",    href:"#reset",    color:"#FBBF24" },
              { label: isFr ? "FAQ" : "FAQ",                         href:"#faq",      color:"#F472B6" },
            ].map((c) => (
              <a key={c.label} href={c.href} style={{ display:"inline-block", borderRadius:999, padding:"6px 16px", border:`1px solid ${c.color}30`, background:`${c.color}10`, color:c.color, fontSize:12, fontFamily:"'JetBrains Mono', monospace", fontWeight:600, textDecoration:"none", transition:"background .15s, border-color .15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background=`${c.color}20`; e.currentTarget.style.borderColor=`${c.color}60`; }}
                onMouseLeave={(e) => { e.currentTarget.style.background=`${c.color}10`; e.currentTarget.style.borderColor=`${c.color}30`; }}
              >{c.label}</a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Complaint CTA ── */}
      <div style={{ borderTop:"1px solid rgba(239,68,68,0.15)", borderBottom:"1px solid rgba(239,68,68,0.15)", background:"rgba(239,68,68,0.04)", padding:"20px 0" }}>
        <div className="max-w-[900px] mx-auto px-5 sm:px-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div style={{ width:36, height:36, borderRadius:10, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <AlertCircle className="w-4 h-4" style={{ color:"#F87171" }} />
            </div>
            <div>
              <p style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:700, fontSize:14, color:"#fff" }}>
                {isFr ? "Vous avez une plainte à formuler?" : "Have a complaint to file?"}
              </p>
              <p style={{ color:"rgba(255,255,255,0.45)", fontSize:12, marginTop:2 }}>
                {isFr ? "Notre équipe traite chaque plainte avec un SLA garanti." : "Our team handles every complaint with a guaranteed SLA."}
              </p>
            </div>
          </div>
          <Link to="/plainte" style={{ textDecoration:"none", flexShrink:0 }}>
            <div className="inline-flex items-center gap-2 font-bold" style={{ height:40, padding:"0 20px", borderRadius:10, background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.4)", color:"#F87171", fontSize:13, fontFamily:"'Space Grotesk', sans-serif", fontWeight:700, cursor:"pointer", transition:"background .15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background="rgba(239,68,68,0.25)")}
              onMouseLeave={(e) => (e.currentTarget.style.background="rgba(239,68,68,0.15)")}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              {isFr ? "Soumettre une plainte" : "Submit a complaint"}
            </div>
          </Link>
        </div>
      </div>

      {/* ── Guides PDF ── */}
      <section id="guides" style={{ background:"#06040F", paddingTop:80, paddingBottom:80, borderTop:"1px solid rgba(124,58,237,0.08)" }}>
        <div className="max-w-[1100px] mx-auto px-5 sm:px-10">
          <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.5 }} className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background:"rgba(124,58,237,0.1)", border:"1px solid rgba(124,58,237,0.3)", borderRadius:100 }}>
              <FileText className="w-3.5 h-3.5" style={{ color:"#A78BFA" }} />
              <span style={{ fontFamily:"'JetBrains Mono', monospace", color:"#A78BFA", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase" }}>{isFr ? "Guides d'installation" : "Installation Guides"}</span>
            </div>
            <h2 style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:"clamp(24px, 4vw, 40px)", letterSpacing:"-1.5px", color:"#fff" }}>
              {isFr ? "Téléchargez votre" : "Download your"}{" "}<span className="n-shimmer-text">{isFr ? "guide PDF" : "PDF guide"}</span>
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {guides.map((g, i) => (
              <motion.div key={g.file} custom={i} initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp}>
                <div className="rounded-2xl p-6 flex flex-col h-full"
                  style={{ background:"rgba(255,255,255,0.03)", border:`1px solid ${g.border}30`, transition:"border-color .2s, box-shadow .2s, transform .2s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor=g.border; (e.currentTarget as HTMLElement).style.boxShadow=`0 8px 32px ${g.bg}`; (e.currentTarget as HTMLElement).style.transform="translateY(-3px)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor=`${g.border}30`; (e.currentTarget as HTMLElement).style.boxShadow="none"; (e.currentTarget as HTMLElement).style.transform="none"; }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div style={{ width:48, height:48, borderRadius:12, background:g.bg, border:`1px solid ${g.border}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <g.icon className="w-6 h-6" style={{ color:g.accent }} />
                    </div>
                    <span style={{ background:`${g.accent}15`, border:`1px solid ${g.accent}35`, borderRadius:999, padding:"3px 9px", color:g.accent, fontSize:10, fontFamily:"'JetBrains Mono', monospace", fontWeight:700 }}>{g.lang}</span>
                  </div>
                  <h3 style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:700, fontSize:15, color:"#fff", marginBottom:6 }}>{g.title}</h3>
                  <p className="flex items-center gap-1.5" style={{ color:"rgba(255,255,255,0.35)", fontSize:12, marginBottom:16 }}>
                    <FileText className="w-3 h-3" /> PDF
                  </p>
                  <a href={`${STORAGE_BASE}/${g.file}`} target="_blank" rel="noopener noreferrer" download className="mt-auto"
                    style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, height:38, borderRadius:10, border:`1px solid ${g.border}`, background:`${g.bg}`, color:g.accent, fontSize:13, fontFamily:"'Space Grotesk', sans-serif", fontWeight:600, textDecoration:"none", transition:"background .15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background=`${g.bg.replace("0.1", "0.2")}`)}
                    onMouseLeave={(e) => (e.currentTarget.style.background=g.bg)}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {isFr ? "Télécharger" : "Download"}
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Activation ── */}
      <section id="activation" style={{ background:"#020209", paddingTop:80, paddingBottom:80, borderTop:"1px solid rgba(124,58,237,0.08)" }}>
        <div className="max-w-[700px] mx-auto px-5 sm:px-10">
          <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.5 }}>
            <div style={{ borderRadius:24, border:"1px solid rgba(16,185,129,0.3)", background:"linear-gradient(135deg, rgba(16,185,129,0.07) 0%, rgba(255,255,255,0.03) 100%)", padding:"44px 36px", textAlign:"center", position:"relative", overflow:"hidden" }}>
              <div aria-hidden style={{ position:"absolute", top:0, left:0, right:0, height:1, background:"linear-gradient(90deg, transparent, rgba(16,185,129,0.5), transparent)", pointerEvents:"none" }} />

              <div className="inline-flex items-center gap-2 mb-4" style={{ background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.3)", borderRadius:999, padding:"6px 14px" }}>
                <Zap className="w-3 h-3" style={{ color:"#34D399" }} />
                <span style={{ fontFamily:"'JetBrains Mono', monospace", color:"#34D399", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase" }}>{isFr ? "Activation" : "Activation"}</span>
              </div>

              <div style={{ width:64, height:64, borderRadius:20, background:"rgba(16,185,129,0.12)", border:"1px solid rgba(16,185,129,0.3)", display:"flex", alignItems:"center", justifyContent:"center", margin:"16px auto 20px" }}>
                <CheckCircle2 className="w-8 h-8" style={{ color:"#34D399" }} />
              </div>

              <h2 style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:"clamp(20px, 3.5vw, 32px)", letterSpacing:"-1px", color:"#fff", marginBottom:16 }}>
                {isFr ? "Comment activer votre service?" : "How to activate your service?"}
              </h2>
              <p style={{ color:"rgba(255,255,255,0.5)", fontSize:15, lineHeight:1.75, marginBottom:28, maxWidth:480, margin:"0 auto 28px" }}>
                {isFr
                  ? "Votre équipement est branché et le voyant est blanc fixe? Connectez-vous à votre espace client pour soumettre votre demande. Notre équipe active en 10 à 30 minutes."
                  : "Equipment plugged in and solid white light? Log in to your client portal to submit your request. Our team activates within 10 to 30 minutes."}
              </p>
              <Link to="/portail/activation" className="inline-flex items-center gap-2"
                style={{ height:50, padding:"0 32px", borderRadius:12, background:"linear-gradient(135deg, #059669, #047857)", boxShadow:"0 8px 32px rgba(16,185,129,0.35)", textDecoration:"none", fontFamily:"'Space Grotesk', sans-serif", fontWeight:700, fontSize:15, color:"#fff", transition:"box-shadow .18s, transform .15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow="0 12px 40px rgba(16,185,129,0.55)"; e.currentTarget.style.transform="translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow="0 8px 32px rgba(16,185,129,0.35)"; e.currentTarget.style.transform="none"; }}
              >
                {isFr ? "Demander l'activation" : "Request activation"} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Troubleshooting ── */}
      <section id="depannage" style={{ background:"#06040F", paddingTop:80, paddingBottom:80, borderTop:"1px solid rgba(124,58,237,0.08)" }}>
        <div className="max-w-[780px] mx-auto px-5 sm:px-10">
          <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.5 }} className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background:"rgba(251,191,36,0.1)", border:"1px solid rgba(251,191,36,0.3)", borderRadius:100 }}>
              <AlertCircle className="w-3.5 h-3.5" style={{ color:"#FCD34D" }} />
              <span style={{ fontFamily:"'JetBrains Mono', monospace", color:"#FCD34D", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase" }}>{isFr ? "Dépannage rapide" : "Quick Troubleshooting"}</span>
            </div>
            <h2 style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:"clamp(24px, 4vw, 40px)", letterSpacing:"-1.5px", color:"#fff" }}>
              <span className="n-shimmer-text">{isFr ? "Résolvez" : "Solve"}</span>{" "}{isFr ? "en quelques clics" : "in a few clicks"}
            </h2>
          </motion.div>
          <motion.div initial={{ opacity:0, y:16 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.5, delay:0.1 }}>
            <Accordion items={troubleshooting} icon={AlertCircle} accent="#FBBF24" />
          </motion.div>
        </div>
      </section>

      {/* ── Full Reset ── */}
      <section id="reset" style={{ background:"#020209", paddingTop:80, paddingBottom:80, borderTop:"1px solid rgba(124,58,237,0.08)" }}>
        <div className="max-w-[780px] mx-auto px-5 sm:px-10">
          <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.5 }} className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:100 }}>
              <RotateCcw className="w-3.5 h-3.5" style={{ color:"#F87171" }} />
              <span style={{ fontFamily:"'JetBrains Mono', monospace", color:"#F87171", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase" }}>{isFr ? "Équipement reconditionné" : "Refurbished equipment"}</span>
            </div>
            <h2 style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:"clamp(24px, 4vw, 40px)", letterSpacing:"-1.5px", color:"#fff", marginBottom:12 }}>
              {isFr ? "Réinitialisation" : "Full"}{" "}<span className="n-shimmer-text">{isFr ? "complète" : "Reset"}</span>
            </h2>
            <p style={{ color:"rgba(255,255,255,0.45)", fontSize:15, lineHeight:1.7, maxWidth:540, margin:"0 auto" }}>
              {isFr
                ? "La majorité des équipements Nivra sont reconditionnés. Si votre terminal TV ne fonctionne pas correctement, suivez ces étapes dans l'ordre."
                : "Most Nivra equipment is refurbished. If your TV terminal is not working correctly, follow these steps in order."}
            </p>
          </motion.div>

          <div className="space-y-5">
            {/* Step 1 — Remote */}
            <motion.div initial={{ opacity:0, x:-16 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }} transition={{ duration:0.5 }}>
              <div style={{ borderRadius:20, border:"1px solid rgba(239,68,68,0.35)", background:"linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(255,255,255,0.02) 100%)", padding:"28px 28px 24px", position:"relative", overflow:"hidden" }}>
                <div aria-hidden style={{ position:"absolute", top:0, left:0, right:0, height:1, background:"linear-gradient(90deg, transparent, rgba(239,68,68,0.5), transparent)", pointerEvents:"none" }} />
                <div className="flex items-start gap-4 mb-4">
                  <div style={{ width:40, height:40, borderRadius:12, background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.4)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <span style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:16, color:"#F87171" }}>1</span>
                  </div>
                  <div>
                    <h3 style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:700, fontSize:16, color:"#fff", marginBottom:6 }}>
                      {isFr ? "Reset de la télécommande" : "Reset the remote control"}
                    </h3>
                    <span style={{ display:"inline-block", background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.4)", borderRadius:999, padding:"3px 10px", color:"#F87171", fontSize:10, fontFamily:"'JetBrains Mono', monospace", fontWeight:700, letterSpacing:1 }}>
                      {isFr ? "OBLIGATOIRE EN PREMIER" : "MUST DO FIRST"}
                    </span>
                  </div>
                </div>
                <ol className="space-y-2 pl-[52px]">
                  {remoteSteps.map((s, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:11, color:"#F87171", fontWeight:700, flexShrink:0, marginTop:2 }}>{String(i+1).padStart(2,"0")}.</span>
                      <span style={{ color:"rgba(255,255,255,0.6)", fontSize:14, lineHeight:1.6 }}>{s}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-4 ml-[52px] flex items-start gap-2 p-3 rounded-xl" style={{ background:"rgba(239,68,68,0.05)", border:"1px solid rgba(239,68,68,0.2)" }}>
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color:"#F87171" }} />
                  <span style={{ color:"rgba(255,255,255,0.55)", fontSize:12, lineHeight:1.6 }}>
                    {isFr ? "Pas plus d'une seconde entre chaque étape. Lisez toutes les étapes avant de commencer." : "No more than one second between each step. Read all steps before starting."}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Step 2 — Terminal */}
            <motion.div initial={{ opacity:0, x:16 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }} transition={{ duration:0.5, delay:0.1 }}>
              <div style={{ borderRadius:20, border:"1px solid rgba(124,58,237,0.3)", background:"linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(255,255,255,0.02) 100%)", padding:"28px 28px 24px", position:"relative", overflow:"hidden" }}>
                <div aria-hidden style={{ position:"absolute", top:0, left:0, right:0, height:1, background:"linear-gradient(90deg, transparent, rgba(124,58,237,0.5), transparent)", pointerEvents:"none" }} />
                <div className="flex items-start gap-4 mb-4">
                  <div style={{ width:40, height:40, borderRadius:12, background:"rgba(124,58,237,0.15)", border:"1px solid rgba(124,58,237,0.4)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <span style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:16, color:"#A78BFA" }}>2</span>
                  </div>
                  <div>
                    <h3 style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:700, fontSize:16, color:"#fff", marginBottom:6 }}>
                      {isFr ? "Reset du terminal" : "Reset the terminal"}
                    </h3>
                    <span style={{ color:"rgba(255,255,255,0.35)", fontSize:12, fontFamily:"'JetBrains Mono', monospace" }}>
                      {isFr ? "APRÈS la télécommande seulement" : "AFTER the remote only"}
                    </span>
                  </div>
                </div>
                <ol className="space-y-2 pl-[52px]">
                  {terminalSteps.map((s, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:11, color:"#A78BFA", fontWeight:700, flexShrink:0, marginTop:2 }}>{String(i+1).padStart(2,"0")}.</span>
                      <span style={{ color:"rgba(255,255,255,0.6)", fontSize:14, lineHeight:1.6 }}>{s}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-4 ml-[52px] flex items-center gap-2 p-3 rounded-xl" style={{ background:"rgba(16,185,129,0.05)", border:"1px solid rgba(16,185,129,0.2)" }}>
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color:"#34D399" }} />
                  <span style={{ color:"rgba(255,255,255,0.55)", fontSize:12 }}>
                    {isFr ? "Succès — Vous verrez l'écran de bienvenue après quelques minutes." : "Success — You will see the welcome screen after a few minutes."}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ background:"#06040F", paddingTop:80, paddingBottom:80, borderTop:"1px solid rgba(124,58,237,0.08)" }}>
        <div className="max-w-[780px] mx-auto px-5 sm:px-10">
          <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.5 }} className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background:"rgba(6,182,212,0.1)", border:"1px solid rgba(6,182,212,0.3)", borderRadius:100 }}>
              <HelpCircle className="w-3.5 h-3.5" style={{ color:"#67E8F9" }} />
              <span style={{ fontFamily:"'JetBrains Mono', monospace", color:"#67E8F9", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase" }}>{isFr ? "Questions fréquentes" : "Frequently Asked Questions"}</span>
            </div>
            <h2 style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:"clamp(24px, 4vw, 40px)", letterSpacing:"-1.5px", color:"#fff" }}>
              {isFr ? "Vos" : "Your"}{" "}<span className="n-shimmer-text">{isFr ? "questions" : "questions"}</span>{" "}{isFr ? "répondues" : "answered"}
            </h2>
          </motion.div>
          <motion.div initial={{ opacity:0, y:16 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.5, delay:0.1 }}>
            <Accordion items={faq.map(f => ({ title: f.q, body: f.a }))} icon={HelpCircle} accent="#06B6D4" />
          </motion.div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section style={{ background:"#020209", paddingTop:80, paddingBottom:80, borderTop:"1px solid rgba(124,58,237,0.08)" }}>
        <div className="max-w-[900px] mx-auto px-5 sm:px-10">
          <motion.div initial={{ opacity:0, y:24 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.55 }}>
            <div style={{ borderRadius:24, background:"linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(6,182,212,0.05) 100%)", border:"1px solid rgba(124,58,237,0.25)", padding:"48px 40px", position:"relative", overflow:"hidden" }}>
              <div aria-hidden style={{ position:"absolute", top:0, left:0, right:0, height:1, background:"linear-gradient(90deg, transparent, rgba(124,58,237,0.6), transparent)", pointerEvents:"none" }} />

              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background:"rgba(124,58,237,0.1)", border:"1px solid rgba(124,58,237,0.3)", borderRadius:100 }}>
                  <Shield className="w-3.5 h-3.5" style={{ color:"#A78BFA" }} />
                  <span style={{ fontFamily:"'JetBrains Mono', monospace", color:"#A78BFA", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase" }}>{isFr ? "Nous contacter" : "Contact Us"}</span>
                </div>
                <h2 style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:"clamp(22px, 3.5vw, 36px)", letterSpacing:"-1px", color:"#fff", marginBottom:8 }}>
                  {isFr ? "Toujours là pour" : "Always here"}{" "}<span className="n-shimmer-text">{isFr ? "vous aider" : "to help"}</span>
                </h2>
                <p style={{ color:"rgba(255,255,255,0.45)", fontSize:14, fontFamily:"'JetBrains Mono', monospace" }}>
                  {isFr ? "Réponse en moins de 24 heures • 7 jours sur 7 • 8h à 20h" : "Response within 24 hours • 7 days a week • 8AM to 8PM"}
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-5 mb-6">
                {/* Email */}
                <div style={{ borderRadius:16, border:"1px solid rgba(167,139,250,0.25)", background:"rgba(124,58,237,0.06)", padding:"24px", textAlign:"center", transition:"border-color .2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor="rgba(167,139,250,0.5)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor="rgba(167,139,250,0.25)")}
                >
                  <div style={{ width:48, height:48, borderRadius:12, background:"rgba(124,58,237,0.1)", border:"1px solid rgba(124,58,237,0.3)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
                    <Mail className="w-5 h-5" style={{ color:"#A78BFA" }} />
                  </div>
                  <h3 style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:700, fontSize:15, color:"#fff", marginBottom:8 }}>{isFr ? "Courriel" : "Email"}</h3>
                  <p style={{ color:"rgba(255,255,255,0.4)", fontSize:13, marginBottom:16, wordBreak:"break-all" }}>{SUPPORT_EMAIL}</p>
                  <a href={`mailto:${SUPPORT_EMAIL}`}
                    style={{ display:"inline-flex", alignItems:"center", gap:6, height:36, padding:"0 16px", borderRadius:9, border:"1px solid rgba(124,58,237,0.4)", background:"rgba(124,58,237,0.1)", color:"#A78BFA", fontSize:13, fontFamily:"'Space Grotesk', sans-serif", fontWeight:600, textDecoration:"none", transition:"background .15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background="rgba(124,58,237,0.2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background="rgba(124,58,237,0.1)")}
                  >
                    {isFr ? "Envoyer un courriel" : "Send email"}
                  </a>
                </div>

                {/* Chat */}
                <div style={{ borderRadius:16, border:"1px solid rgba(6,182,212,0.25)", background:"rgba(6,182,212,0.06)", padding:"24px", textAlign:"center", transition:"border-color .2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor="rgba(6,182,212,0.5)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor="rgba(6,182,212,0.25)")}
                >
                  <div style={{ width:48, height:48, borderRadius:12, background:"rgba(6,182,212,0.1)", border:"1px solid rgba(6,182,212,0.3)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
                    <MessageSquare className="w-5 h-5" style={{ color:"#67E8F9" }} />
                  </div>
                  <h3 style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:700, fontSize:15, color:"#fff", marginBottom:8 }}>{isFr ? "Clavardage" : "Chat"}</h3>
                  <p style={{ color:"rgba(255,255,255,0.4)", fontSize:13, marginBottom:16 }}>{isFr ? "Réponse instantanée 24/7" : "Instant response 24/7"}</p>
                  <button onClick={openChat}
                    style={{ display:"inline-flex", alignItems:"center", gap:6, height:36, padding:"0 16px", borderRadius:9, border:"1px solid rgba(6,182,212,0.4)", background:"rgba(6,182,212,0.1)", color:"#67E8F9", fontSize:13, fontFamily:"'Space Grotesk', sans-serif", fontWeight:600, cursor:"pointer", transition:"background .15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background="rgba(6,182,212,0.2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background="rgba(6,182,212,0.1)")}
                  >
                    {isFr ? "Clavarder maintenant" : "Chat now"}
                  </button>
                </div>
              </div>

              {/* Footnote */}
              <div className="flex items-center justify-center gap-2" style={{ borderRadius:12, border:"1px solid rgba(255,255,255,0.07)", background:"rgba(255,255,255,0.03)", padding:"10px 16px" }}>
                <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color:"rgba(255,255,255,0.35)" }} />
                <span style={{ color:"rgba(255,255,255,0.4)", fontSize:12, fontFamily:"'JetBrains Mono', monospace" }}>
                  {isFr ? "Nous répondons uniquement par courriel. Pas de ligne téléphonique." : "We respond by email only. No phone line."}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Support;
