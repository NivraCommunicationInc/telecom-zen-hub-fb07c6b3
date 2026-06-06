import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogoIcon, LogoFull } from "@/components/brand";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, User, Search, ChevronDown, ArrowRight, Wifi, Tv, Smartphone, HelpCircle, Info, Briefcase } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useOptionalAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "./LanguageSelector";
import { NAV_TARGETS, type NavTarget, validateNavTargets, safeScrollToSection } from "@/config/navigation";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { PublicSystemStatusBanner } from "@/components/public/PublicSystemStatusBanner";
import { SiteSearchDialog } from "@/components/public/SiteSearchDialog";

const P = "#7C3AED";
const HEADER_HIDDEN_IDS = new Set(["couverture", "compare", "parrainage"]);

const NAV_ICONS: Record<string, React.ElementType> = {
  internet: Wifi,
  tv: Tv,
  mobile: Smartphone,
  aide: HelpCircle,
  "a-propos": Info,
  emplois: Briefcase,
};

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const dropdownTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useOptionalAuth();
  const { t, language } = useLanguage();
  const { data: siteSettings } = useSiteSettings();
  const isFr = language === "fr";

  const portalLink = user ? "/portal" : "/portal/auth";

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV && location.pathname === "/") {
      const timer = setTimeout(() => validateNavTargets(), 500);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace("#", "");
      setTimeout(() => safeScrollToSection(id), 100);
    }
  }, [location]);

  useEffect(() => {
    setOpenDropdown(null);
    setMobileExpanded(null);
  }, [location.pathname]);

  const handleNavClick = (target: NavTarget) => {
    try {
      setIsMenuOpen(false);
      setOpenDropdown(null);
      if (target.type === "scroll") {
        if (location.pathname !== "/") {
          navigate(`/#${target.target}`);
        } else if (!safeScrollToSection(target.target)) {
          navigate(target.fallbackRoute);
        }
      } else {
        navigate(target.target);
      }
    } catch {
      window.location.href = target.fallbackRoute;
    }
  };

  const getLabel = (t: NavTarget) => (language === "fr" ? t.labelFr : t.label);

  const handleDropdownEnter = (id: string) => {
    if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
    setOpenDropdown(id);
  };
  const handleDropdownLeave = () => {
    dropdownTimeout.current = setTimeout(() => setOpenDropdown(null), 150);
  };

  const renderDesktopItem = (target: NavTarget) => {
    const hasChildren = !!(target.children?.length);
    const isActive =
      target.type === "route"
        ? location.pathname === target.target || target.children?.some((c) => location.pathname === c.target)
        : location.hash === `#${target.target}`;

    if (hasChildren) {
      return (
        <div
          key={target.id}
          className="relative"
          onMouseEnter={() => handleDropdownEnter(target.id)}
          onMouseLeave={handleDropdownLeave}
        >
          <button
            type="button"
            onClick={() => handleNavClick(target)}
            aria-expanded={openDropdown === target.id}
            aria-haspopup="true"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer relative group"
            style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.65)", fontFamily: "'Space Grotesk', sans-serif" }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}
          >
            {getLabel(target)}
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${openDropdown === target.id ? "rotate-180" : ""}`} style={{ opacity: 0.6 }} />
            {isActive && <span style={{ position:"absolute", bottom:0, left:"50%", transform:"translateX(-50%)", width:4, height:4, borderRadius:"50%", background:"#A78BFA" }} />}
          </button>

          <AnimatePresence>
            {openDropdown === target.id && (
              <motion.div
                initial={{ opacity:0, y:-6, scale:0.97 }}
                animate={{ opacity:1, y:0, scale:1 }}
                exit={{ opacity:0, y:-4, scale:0.98 }}
                transition={{ duration:0.15, ease:[0.16,1,0.3,1] }}
                className="absolute top-full left-0 pt-2 z-50"
              >
                <div className="rounded-2xl py-2 min-w-[220px] overflow-hidden"
                  style={{ background:"rgba(8,8,20,0.95)", border:"1px solid rgba(124,58,237,0.25)", boxShadow:"0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,58,237,0.1)", backdropFilter:"blur(24px)" }}>
                  <div aria-hidden style={{ position:"absolute", top:0, left:"15%", right:"15%", height:1, background:"linear-gradient(90deg, transparent, rgba(124,58,237,0.5), transparent)" }} />
                  {target.children!.map((child) => {
                    const Icon = NAV_ICONS[child.id] || null;
                    const childActive = location.pathname === child.target;
                    return (
                      <Link
                        key={child.id}
                        to={child.target}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all group"
                        style={{ color: childActive ? "#A78BFA" : "rgba(255,255,255,0.65)", textDecoration:"none" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color="#fff"; e.currentTarget.style.background="rgba(124,58,237,0.08)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color=childActive ? "#A78BFA" : "rgba(255,255,255,0.65)"; e.currentTarget.style.background="transparent"; }}
                      >
                        {Icon && (
                          <span style={{ width:28, height:28, borderRadius:8, background:"rgba(124,58,237,0.12)", border:"1px solid rgba(124,58,237,0.2)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            <Icon className="w-3.5 h-3.5" style={{ color:"#A78BFA" }} />
                          </span>
                        )}
                        <span style={{ fontFamily:"'Space Grotesk', sans-serif" }}>{getLabel(child)}</span>
                        <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    return target.type === "route" ? (
      <Link
        key={target.id}
        to={target.target}
        className="relative px-3 py-2 text-sm font-semibold rounded-lg transition-colors"
        style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.65)", textDecoration:"none", fontFamily:"'Space Grotesk', sans-serif" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
        onMouseLeave={(e) => (e.currentTarget.style.color = isActive ? "#fff" : "rgba(255,255,255,0.65)")}
      >
        {getLabel(target)}
        {isActive && <span style={{ position:"absolute", bottom:0, left:"50%", transform:"translateX(-50%)", width:4, height:4, borderRadius:"50%", background:"#A78BFA" }} />}
      </Link>
    ) : (
      <button
        key={target.id}
        type="button"
        onClick={() => handleNavClick(target)}
        className="relative px-3 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
        style={{ color:"rgba(255,255,255,0.65)", fontFamily:"'Space Grotesk', sans-serif" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.65)")}
      >
        {getLabel(target)}
      </button>
    );
  };

  const renderMobileItem = (target: NavTarget) => {
    const hasChildren = !!(target.children?.length);
    const isExpanded = mobileExpanded === target.id;
    const isActive = target.type === "route" && location.pathname === target.target;

    if (hasChildren) {
      return (
        <div key={target.id}>
          <button
            type="button"
            onClick={() => setMobileExpanded(isExpanded ? null : target.id)}
            className="flex items-center justify-between w-full pl-6 pr-5 text-[17px] font-semibold transition-colors"
            style={{ height:56, color:"#fff", fontFamily:"'Space Grotesk', sans-serif" }}
            aria-expanded={isExpanded}
            onMouseEnter={(e) => { e.currentTarget.style.background="rgba(124,58,237,0.06)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background="transparent"; }}
          >
            {getLabel(target)}
            <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} style={{ color:"rgba(255,255,255,0.35)" }} />
          </button>
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height:0, opacity:0 }}
                animate={{ height:"auto", opacity:1 }}
                exit={{ height:0, opacity:0 }}
                transition={{ duration:0.2, ease:[0.22,1,0.36,1] }}
                style={{ overflow:"hidden" }}
              >
                <div className="pl-6" style={{ borderLeft:"2px solid rgba(124,58,237,0.3)", marginLeft:24, paddingBottom:4 }}>
                  {target.children!.map((child) => (
                    <Link
                      key={child.id}
                      to={child.target}
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center pl-4 pr-5 text-[15px] font-medium transition-colors"
                      style={{ height:44, color: location.pathname === child.target ? "#A78BFA" : "rgba(255,255,255,0.65)", textDecoration:"none", fontFamily:"'Space Grotesk', sans-serif" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color="#fff"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color=location.pathname === child.target ? "#A78BFA" : "rgba(255,255,255,0.65)"; }}
                    >
                      {getLabel(child)}
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    return target.type === "route" ? (
      <Link
        key={target.id}
        to={target.target}
        onClick={() => setIsMenuOpen(false)}
        className="flex items-center pl-6 pr-5 text-[17px] font-semibold transition-all"
        style={{ height:56, color: isActive ? "#A78BFA" : "#fff", textDecoration:"none", fontFamily:"'Space Grotesk', sans-serif", background: isActive ? "rgba(124,58,237,0.06)" : "transparent", borderLeft: isActive ? "2px solid #7C3AED" : "2px solid transparent" }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background="rgba(124,58,237,0.04)"; }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background="transparent"; }}
      >
        {getLabel(target)}
      </Link>
    ) : (
      <button
        key={target.id}
        type="button"
        onClick={() => handleNavClick(target)}
        className="flex items-center w-full text-left pl-6 pr-5 text-[17px] font-semibold transition-colors cursor-pointer"
        style={{ height:56, color:"#fff", fontFamily:"'Space Grotesk', sans-serif" }}
        onMouseEnter={(e) => { e.currentTarget.style.background="rgba(124,58,237,0.04)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background="transparent"; }}
      >
        {getLabel(target)}
      </button>
    );
  };

  return (
    <>
      <SiteSearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />
      <PublicSystemStatusBanner />

      {/* Top utility bar — desktop only */}
      <div className="hidden lg:block" style={{ background:"rgba(2,2,9,0.98)", borderBottom:"1px solid rgba(124,58,237,0.1)" }}>
        <div className="container mx-auto px-6 max-w-[1200px] flex items-center justify-between" style={{ height:36 }}>
          <div className="flex items-center gap-5" style={{ fontSize:11, fontFamily:"'JetBrains Mono', monospace" }}>
            {/* Live status indicator */}
            <div className="flex items-center gap-2">
              <span className="relative flex" style={{ width:6, height:6 }}>
                <span style={{ position:"absolute", inset:0, borderRadius:"50%", background:"#10B981", animation:"header-pulse 2s ease-out infinite" }} />
                <span style={{ width:6, height:6, borderRadius:"50%", background:"#10B981", display:"block" }} />
              </span>
              <span style={{ color:"#34D399", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase", fontSize:10 }}>
                {isFr ? "Réseau actif" : "Network live"}
              </span>
            </div>
            <span style={{ color:"rgba(124,58,237,0.5)" }}>·</span>
            <span style={{ color:"rgba(255,255,255,0.28)", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", fontSize:10 }}>NIVRA TELECOM</span>
            <span style={{ color:"rgba(124,58,237,0.5)" }}>·</span>
            <Link to="/contact" style={{ color:"rgba(255,255,255,0.3)", textDecoration:"none", fontSize:10, transition:"color .15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
            >
              {isFr ? "Nous contacter" : "Contact Us"}
            </Link>
          </div>
          <div className="flex items-center gap-4" style={{ fontSize:11 }}>
            {[
              { to:"/aide",     label: isFr ? "Centre d'aide" : "Help Center" },
              { to:"/a-propos", label: isFr ? "À propos" : "About" },
              { to:"/emplois",  label: isFr ? "Emplois" : "Careers" },
            ].map(({ to, label }) => (
              <Link key={to} to={to} style={{ color:"rgba(255,255,255,0.3)", textDecoration:"none", fontSize:10, fontFamily:"'JetBrains Mono', monospace", transition:"color .15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
              >
                {label}
              </Link>
            ))}
            <LanguageSelector />
          </div>
        </div>
      </div>

      {/* Main header */}
      <motion.header
        initial={{ opacity:0, y:-16 }}
        animate={{ opacity:1, y:0 }}
        transition={{ duration:0.4, ease:[0.4, 0, 0.2, 1] as const }}
        className="sticky top-0 z-50"
        style={{
          height:64,
          background: isScrolled ? "rgba(2,2,9,0.92)" : "rgba(2,2,9,0.6)",
          backdropFilter:"blur(24px) saturate(180%)",
          WebkitBackdropFilter:"blur(24px) saturate(180%)",
          borderBottom: isScrolled ? "1px solid rgba(124,58,237,0.22)" : "1px solid rgba(255,255,255,0.06)",
          boxShadow: isScrolled ? "0 4px 32px rgba(0,0,0,0.6), inset 0 -1px 0 rgba(124,58,237,0.15)" : "none",
          transition:"background .3s, border-color .3s, box-shadow .3s",
        }}
      >
        <style>{`
          @keyframes header-pulse {
            0%   { transform: scale(.85); opacity:.8; }
            70%  { transform: scale(1.8); opacity:0; }
            100% { transform: scale(1.8); opacity:0; }
          }
        `}</style>

        {/* Scrolled gradient line */}
        {isScrolled && (
          <div aria-hidden style={{ position:"absolute", top:0, left:0, right:0, height:1, background:"linear-gradient(90deg, transparent 0%, rgba(124,58,237,0.6) 20%, rgba(6,182,212,0.4) 50%, rgba(124,58,237,0.6) 80%, transparent 100%)", pointerEvents:"none" }} />
        )}

        <div className="container mx-auto px-4 sm:px-6 max-w-[1280px] h-full">

          {/* Mobile layout */}
          <div className="grid grid-cols-[60px_1fr_60px] items-center h-full lg:hidden">
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <button type="button" className="flex items-center justify-center w-[60px] h-[60px] cursor-pointer rounded-xl transition-colors"
                  style={{ color:"#fff" }}
                  aria-label="Menu"
                  onMouseEnter={(e) => { e.currentTarget.style.background="rgba(124,58,237,0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background="transparent"; }}
                >
                  <Menu className="w-6 h-6" strokeWidth={2} />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="flex flex-col p-0 w-[85vw] max-w-[380px]"
                style={{ background:"#080814", borderRight:"1px solid rgba(124,58,237,0.2)" }}>
                <div aria-hidden style={{ position:"absolute", top:0, left:0, right:0, height:1, background:"linear-gradient(90deg, transparent, rgba(124,58,237,0.6), transparent)", pointerEvents:"none" }} />

                {/* Sheet header */}
                <div className="flex items-center px-5 gap-3" style={{ height:60, borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
                  <Link to="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2.5" style={{ textDecoration:"none" }}>
                    <LogoIcon size={28} />
                    <span className="font-bold text-white" style={{ fontSize:18, fontFamily:"'Space Grotesk', sans-serif", letterSpacing:"-0.5px" }}>Nivra</span>
                  </Link>
                  {/* Live indicator */}
                  <div className="flex items-center gap-1.5 ml-auto" style={{ background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:999, padding:"3px 8px" }}>
                    <span style={{ width:5, height:5, borderRadius:"50%", background:"#10B981", display:"block" }} />
                    <span style={{ color:"#34D399", fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'JetBrains Mono', monospace" }}>LIVE</span>
                  </div>
                </div>

                <nav className="flex-1 overflow-y-auto py-2">
                  {NAV_TARGETS.map(renderMobileItem)}
                  <div className="mt-3 pt-3" style={{ borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                    {[
                      { to:"/aide",     label: isFr ? "Centre d'aide" : "Help Center" },
                      { to:"/a-propos", label: isFr ? "À propos" : "About" },
                      { to:"/status",   label: isFr ? "État des services" : "Service Status" },
                    ].map(({ to, label }) => (
                      <Link key={to} to={to} onClick={() => setIsMenuOpen(false)}
                        className="flex items-center pl-6 pr-5 text-[15px] transition-colors"
                        style={{ height:44, color:"rgba(255,255,255,0.45)", textDecoration:"none", fontFamily:"'Space Grotesk', sans-serif", fontWeight:500 }}
                        onMouseEnter={(e) => { e.currentTarget.style.color="rgba(255,255,255,0.75)"; e.currentTarget.style.background="rgba(255,255,255,0.03)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color="rgba(255,255,255,0.45)"; e.currentTarget.style.background="transparent"; }}
                      >
                        {label}
                      </Link>
                    ))}
                    <div className="px-5 py-2.5"><LanguageSelector /></div>
                  </div>
                </nav>

                {/* Bottom CTAs */}
                <div className="p-5 space-y-3 shrink-0" style={{ borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                  <Link to="/commander" onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-center gap-2 w-full font-bold text-white cursor-pointer"
                    style={{ height:52, background:"linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)", borderRadius:12, textDecoration:"none", boxShadow:"0 8px 24px rgba(124,58,237,0.4)", fontFamily:"'Space Grotesk', sans-serif", fontSize:15 }}
                  >
                    {isFr ? "Commander" : "Order Now"} <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link to={portalLink} onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-center gap-2 w-full font-semibold cursor-pointer"
                    style={{ height:48, color:"rgba(255,255,255,0.7)", borderRadius:12, border:"1px solid rgba(255,255,255,0.12)", textDecoration:"none", fontFamily:"'Space Grotesk', sans-serif", fontSize:14, transition:"border-color .18s, background .18s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor="rgba(124,58,237,0.4)"; e.currentTarget.style.background="rgba(124,58,237,0.06)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor="rgba(255,255,255,0.12)"; e.currentTarget.style.background="transparent"; }}
                  >
                    <User className="w-4 h-4" style={{ color:"#A78BFA" }} />
                    {isFr ? "Mon compte" : "My account"}
                  </Link>
                </div>
              </SheetContent>
            </Sheet>

            <Link to="/" className="justify-self-center flex items-center gap-2" style={{ textDecoration:"none" }}>
              <LogoIcon size={30} />
              <span className="font-bold text-white" style={{ fontSize:18, fontFamily:"'Space Grotesk', sans-serif", letterSpacing:"-0.5px" }}>Nivra</span>
            </Link>
            <div />
          </div>

          {/* Desktop layout */}
          <div className="hidden lg:flex items-center h-full gap-3">
            <Link to="/" className="flex items-center shrink-0 mr-3" style={{ textDecoration:"none" }}>
              <LogoFull height={34} />
            </Link>
            <div style={{ height:20, width:1, background:"rgba(255,255,255,0.08)", flexShrink:0 }} />
            <nav className="flex items-center gap-0.5 flex-1 min-w-0">
              {NAV_TARGETS.filter((t) => !HEADER_HIDDEN_IDS.has(t.id)).map(renderDesktopItem)}
            </nav>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center gap-1.5 rounded-lg transition-all cursor-pointer"
                style={{ height:36, padding:"0 12px", color:"rgba(255,255,255,0.4)", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", fontSize:12, fontFamily:"'JetBrains Mono', monospace" }}
                aria-label={isFr ? "Recherche" : "Search"}
                onMouseEnter={(e) => { e.currentTarget.style.background="rgba(124,58,237,0.1)"; e.currentTarget.style.borderColor="rgba(124,58,237,0.3)"; e.currentTarget.style.color="rgba(255,255,255,0.7)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background="rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"; e.currentTarget.style.color="rgba(255,255,255,0.4)"; }}
              >
                <Search className="w-[14px] h-[14px]" />
                <span className="hidden xl:block" style={{ fontSize:10 }}>⌘K</span>
              </button>
              <Link to={portalLink}
                className="flex items-center gap-2 font-semibold text-white text-sm transition-all hover:opacity-90 cursor-pointer"
                style={{ height:38, padding:"0 16px", background:"rgba(124,58,237,0.1)", border:"1px solid rgba(124,58,237,0.25)", borderRadius:10, textDecoration:"none", fontFamily:"'Space Grotesk', sans-serif", transition:"border-color .18s, background .18s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor="rgba(124,58,237,0.45)"; e.currentTarget.style.background="rgba(124,58,237,0.16)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor="rgba(124,58,237,0.25)"; e.currentTarget.style.background="rgba(124,58,237,0.1)"; }}
              >
                <User className="w-3.5 h-3.5" style={{ color:"#A78BFA" }} />
                {isFr ? "Mon compte" : "My account"}
              </Link>
              <Link to="/commander"
                className="flex items-center gap-1.5 font-bold text-white text-sm cursor-pointer"
                style={{ height:38, padding:"0 20px", background:"linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)", borderRadius:10, textDecoration:"none", fontFamily:"'Space Grotesk', sans-serif", boxShadow:"0 4px 16px rgba(124,58,237,0.4)", transition:"box-shadow .18s, transform .15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow="0 6px 24px rgba(124,58,237,0.6)"; e.currentTarget.style.transform="translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow="0 4px 16px rgba(124,58,237,0.4)"; e.currentTarget.style.transform="none"; }}
              >
                {isFr ? "Commander" : "Order Now"}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </motion.header>
    </>
  );
};

export default Header;
