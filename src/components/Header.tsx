import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { LogoIcon, LogoFull } from "@/components/brand";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, User, Search, ChevronDown } from "lucide-react";
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
    window.addEventListener("scroll", handleScroll);
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
            className="flex items-center gap-1 px-3 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.65)" }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}
          >
            {getLabel(target)}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openDropdown === target.id ? "rotate-180" : ""}`} />
          </button>
          {openDropdown === target.id && (
            <div className="absolute top-full left-0 pt-2 z-50">
              <div className="rounded-xl py-1.5 min-w-[200px]" style={{ background: "#1A1A2E", border: "1px solid rgba(124,58,237,0.25)", boxShadow: "0 16px 40px rgba(0,0,0,0.6)" }}>
                {target.children!.map((child) => (
                  <Link
                    key={child.id}
                    to={child.target}
                    className="block px-4 py-2.5 text-sm font-medium transition-colors"
                    style={{ color: location.pathname === child.target ? "#A78BFA" : "rgba(255,255,255,0.65)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = location.pathname === child.target ? "#A78BFA" : "rgba(255,255,255,0.65)")}
                  >
                    {getLabel(child)}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return target.type === "route" ? (
      <Link
        key={target.id}
        to={target.target}
        className="px-3 py-2 text-sm font-semibold rounded-lg transition-colors"
        style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.65)", textDecoration: "none" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
        onMouseLeave={(e) => (e.currentTarget.style.color = isActive ? "#fff" : "rgba(255,255,255,0.65)")}
      >
        {getLabel(target)}
      </Link>
    ) : (
      <button
        key={target.id}
        type="button"
        onClick={() => handleNavClick(target)}
        className="px-3 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
        style={{ color: "rgba(255,255,255,0.65)" }}
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
            className="flex items-center justify-between w-full pl-6 pr-5 text-[17px] font-semibold hover:bg-white/[0.04] transition-colors"
            style={{ height: 56, color: "#fff" }}
            aria-expanded={isExpanded}
          >
            {getLabel(target)}
            <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-180" : ""}`} style={{ color: "rgba(255,255,255,0.4)" }} />
          </button>
          {isExpanded && (
            <div className="pl-6" style={{ borderLeft: "2px solid rgba(124,58,237,0.3)", marginLeft: 24 }}>
              {target.children!.map((child) => (
                <Link
                  key={child.id}
                  to={child.target}
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center pl-4 pr-5 text-[15px] font-medium hover:bg-white/[0.04] transition-colors"
                  style={{ height: 44, color: location.pathname === child.target ? "#A78BFA" : "rgba(255,255,255,0.65)", textDecoration: "none" }}
                >
                  {getLabel(child)}
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return target.type === "route" ? (
      <Link
        key={target.id}
        to={target.target}
        onClick={() => setIsMenuOpen(false)}
        className="flex items-center pl-6 pr-5 text-[17px] font-semibold hover:bg-white/[0.04] transition-colors"
        style={{ height: 56, color: isActive ? "#A78BFA" : "#fff", textDecoration: "none" }}
      >
        {getLabel(target)}
      </Link>
    ) : (
      <button
        key={target.id}
        type="button"
        onClick={() => handleNavClick(target)}
        className="flex items-center w-full text-left pl-6 pr-5 text-[17px] font-semibold hover:bg-white/[0.04] transition-colors cursor-pointer"
        style={{ height: 56, color: "#fff" }}
      >
        {getLabel(target)}
      </button>
    );
  };

  return (
    <>
      <SiteSearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />
      <PublicSystemStatusBanner />

      {/* Utility bar — desktop */}
      <div className="hidden lg:block" style={{ background: "#07060F", borderBottom: "1px solid rgba(124,58,237,0.08)" }}>
        <div className="container mx-auto px-6 max-w-[1280px] flex items-center justify-between h-9">
          <div className="flex items-center gap-5 text-xs font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
            <Link to="/" className="hover:text-white transition-colors" style={{ color: "inherit", textDecoration: "none" }}>{isFr ? "Personnel" : "Personal"}</Link>
            <Link to="/contact" className="hover:text-white transition-colors" style={{ color: "inherit", textDecoration: "none" }}>{isFr ? "Nous contacter" : "Contact"}</Link>
          </div>
          <div className="flex items-center gap-5 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            <Link to="/aide" className="hover:text-white transition-colors" style={{ color: "inherit", textDecoration: "none" }}>{isFr ? "Centre d'aide" : "Help"}</Link>
            <Link to="/a-propos" className="hover:text-white transition-colors" style={{ color: "inherit", textDecoration: "none" }}>{isFr ? "À propos" : "About"}</Link>
            <Link to="/emplois" className="hover:text-white transition-colors" style={{ color: "inherit", textDecoration: "none" }}>{isFr ? "Emplois" : "Careers"}</Link>
            <LanguageSelector />
          </div>
        </div>
      </div>

      {/* Main header */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="sticky top-0 z-50"
        style={{
          height: 68,
          background: isScrolled ? "rgba(10,10,15,0.94)" : "rgba(10,10,15,0.98)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: isScrolled ? "1px solid rgba(124,58,237,0.18)" : "1px solid rgba(124,58,237,0.08)",
          boxShadow: isScrolled ? "0 4px 32px rgba(0,0,0,0.5)" : "none",
          transition: "border-color 0.3s ease, box-shadow 0.3s ease",
        }}
      >
        <div className="container mx-auto px-4 sm:px-6 max-w-[1280px] h-full">
          {/* Mobile */}
          <div className="grid grid-cols-[60px_1fr_60px] items-center h-full lg:hidden">
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <button type="button" className="flex items-center justify-center w-[60px] h-[60px] cursor-pointer" style={{ color: "#fff" }} aria-label="Menu">
                  <Menu className="w-6 h-6" strokeWidth={2} />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="flex flex-col p-0 w-[85vw] max-w-[380px]" style={{ background: "#0F0F1A", borderRight: "1px solid rgba(124,58,237,0.2)" }}>
                {/* Sheet top */}
                <div className="flex items-center px-5" style={{ height: 60, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <Link to="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2.5" style={{ textDecoration: "none" }}>
                    <LogoIcon size={30} />
                    <span className="font-bold text-lg tracking-tight text-white">Nivra</span>
                  </Link>
                </div>

                <nav className="flex-1 overflow-y-auto py-2">
                  {NAV_TARGETS.map(renderMobileItem)}
                  <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <Link to="/aide" onClick={() => setIsMenuOpen(false)} className="flex items-center pl-6 pr-5 text-[15px] hover:bg-white/[0.04] transition-colors" style={{ height: 44, color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>Support</Link>
                    <Link to="/a-propos" onClick={() => setIsMenuOpen(false)} className="flex items-center pl-6 pr-5 text-[15px] hover:bg-white/[0.04] transition-colors" style={{ height: 44, color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>{isFr ? "À propos" : "About"}</Link>
                    <div className="px-5 py-2.5"><LanguageSelector /></div>
                  </div>
                </nav>

                <div className="p-5 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <Link to="/commander" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-center w-full font-bold text-[16px] text-white cursor-pointer" style={{ height: 52, background: P, borderRadius: 999, textDecoration: "none", boxShadow: "0 8px 24px rgba(124,58,237,0.4)" }}>
                    {isFr ? "Commander" : "Order Now"}
                  </Link>
                  <Link to={portalLink} onClick={() => setIsMenuOpen(false)} className="flex items-center justify-center gap-2 w-full font-semibold text-[15px] cursor-pointer" style={{ height: 48, color: "rgba(255,255,255,0.7)", borderRadius: 999, border: "1px solid rgba(255,255,255,0.15)", textDecoration: "none" }}>
                    <User className="w-4 h-4" />{isFr ? "Mon compte" : "My account"}
                  </Link>
                </div>
              </SheetContent>
            </Sheet>

            <Link to="/" className="justify-self-center flex items-center gap-2" style={{ textDecoration: "none" }}>
              <LogoIcon size={30} />
              <span className="font-bold text-lg tracking-tight text-white">Nivra</span>
            </Link>
            <div />
          </div>

          {/* Desktop */}
          <div className="hidden lg:flex items-center h-full gap-4">
            <Link to="/" className="flex items-center shrink-0 mr-3" style={{ textDecoration: "none" }}>
              <LogoFull height={34} />
            </Link>
            <div className="h-5 w-px" style={{ background: "rgba(255,255,255,0.08)" }} />
            <nav className="flex items-center gap-0.5 flex-1 min-w-0">
              {NAV_TARGETS.filter((t) => !HEADER_HIDDEN_IDS.has(t.id)).map(renderDesktopItem)}
            </nav>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={() => setIsSearchOpen(true)} className="p-2 rounded-lg transition-colors hover:bg-white/10 cursor-pointer" style={{ color: "rgba(255,255,255,0.5)" }} aria-label={isFr ? "Recherche" : "Search"}>
                <Search className="w-[18px] h-[18px]" />
              </button>
              <Link to={portalLink} className="flex items-center gap-2 px-5 font-bold text-white text-sm transition-all hover:opacity-90 cursor-pointer" style={{ height: 40, background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 999, textDecoration: "none" }}>
                <User className="w-4 h-4" style={{ color: "#A78BFA" }} />
                {isFr ? "Mon compte" : "My account"}
              </Link>
              <Link to="/commander" className="flex items-center gap-2 px-5 font-bold text-white text-sm transition-all hover:opacity-90 cursor-pointer" style={{ height: 40, background: P, borderRadius: 999, textDecoration: "none", boxShadow: "0 4px 16px rgba(124,58,237,0.4)" }}>
                {isFr ? "Commander" : "Order Now"}
              </Link>
            </div>
          </div>
        </div>
      </motion.header>
    </>
  );
};

export default Header;
