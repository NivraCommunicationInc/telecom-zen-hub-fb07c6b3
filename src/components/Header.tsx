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

const BLUE = "#0066CC";

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
  const isFr = language === 'fr';

  const portalLink = user ? "/portal" : "/portal/auth";

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV && location.pathname === '/') {
      const timer = setTimeout(() => validateNavTargets(), 500);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (location.hash) {
      const sectionId = location.hash.replace("#", "");
      setTimeout(() => safeScrollToSection(sectionId), 100);
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
      if (target.type === 'scroll') {
        if (location.pathname !== "/") {
          navigate(`/#${target.target}`);
        } else {
          if (!safeScrollToSection(target.target)) {
            navigate(target.fallbackRoute);
          }
        }
      } else {
        navigate(target.target);
      }
    } catch (error) {
      window.location.href = target.fallbackRoute;
    }
  };

  const getLabel = (target: NavTarget): string => {
    return language === 'fr' ? target.labelFr : target.label;
  };

  const handleDropdownEnter = (id: string) => {
    if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
    setOpenDropdown(id);
  };

  const handleDropdownLeave = () => {
    dropdownTimeout.current = setTimeout(() => setOpenDropdown(null), 150);
  };

  const renderDesktopNavItem = (target: NavTarget) => {
    const hasChildren = target.children && target.children.length > 0;
    const isActive = target.type === 'route'
      ? location.pathname === target.target || target.children?.some(c => location.pathname === c.target)
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
            className={`flex items-center gap-1 px-3 py-2 text-sm font-semibold transition-colors rounded-md ${
              isActive ? 'text-white' : 'text-[#a8b5cc] hover:text-white'
            }`}
            type="button"
            onClick={() => handleNavClick(target)}
            aria-expanded={openDropdown === target.id}
            aria-haspopup="true"
          >
            {getLabel(target)}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openDropdown === target.id ? 'rotate-180' : ''}`} />
          </button>

          {openDropdown === target.id && (
            <div className="absolute top-full left-0 pt-1 z-50">
              <div className="rounded-xl shadow-lg py-1.5 min-w-[200px]" style={{ background: '#0f1628', border: '1px solid rgba(0,102,204,0.2)' }}>
                {target.children!.map((child) => {
                  const childActive = location.pathname === child.target;
                  return (
                    <Link
                      key={child.id}
                      to={child.target}
                      className={`block px-4 py-2.5 text-sm font-medium transition-colors ${
                        childActive
                          ? 'text-[#00aaff] bg-blue-900/20'
                          : 'text-[#a8b5cc] hover:text-white hover:bg-white/[0.05]'
                      }`}
                    >
                      {getLabel(child)}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }

    return target.type === 'route' ? (
      <Link
        key={target.id}
        to={target.target}
        className={`px-3 py-2 text-sm font-semibold transition-colors rounded-md ${
          isActive ? 'text-white' : 'text-[#a8b5cc] hover:text-white'
        }`}
      >
        {getLabel(target)}
      </Link>
    ) : (
      <button
        key={target.id}
        onClick={() => handleNavClick(target)}
        className="px-3 py-2 text-sm font-semibold text-[#a8b5cc] hover:text-white transition-colors rounded-md"
        type="button"
      >
        {getLabel(target)}
      </button>
    );
  };

  const renderMobileNavItem = (target: NavTarget) => {
    const hasChildren = target.children && target.children.length > 0;
    const isExpanded = mobileExpanded === target.id;
    const isActive = target.type === 'route' && location.pathname === target.target;

    if (hasChildren) {
      return (
        <div key={target.id}>
          <button
            onClick={() => setMobileExpanded(isExpanded ? null : target.id)}
            className="flex items-center justify-between w-full pl-5 pr-4 text-[18px] font-medium hover:bg-white/[0.05]"
            style={{ height: 56, minHeight: 56, color: '#FFFFFF' }}
            type="button"
            aria-expanded={isExpanded}
          >
            {getLabel(target)}
            <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
          {isExpanded && (
            <div className="pl-5">
              {target.children!.map((child) => {
                const childActive = location.pathname === child.target;
                return (
                  <Link
                    key={child.id}
                    to={child.target}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center pl-5 pr-4 text-[16px] font-medium"
                    style={{
                      height: 48,
                      minHeight: 48,
                      color: childActive ? BLUE : 'rgba(255,255,255,0.6)',
                    }}
                  >
                    {getLabel(child)}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return target.type === 'route' ? (
      <Link
        key={target.id}
        to={target.target}
        onClick={() => setIsMenuOpen(false)}
        className="flex items-center pl-5 pr-4 text-[18px] font-medium hover:bg-white/[0.05]"
        style={{
          height: 56,
          minHeight: 56,
          color: isActive ? BLUE : '#FFFFFF',
        }}
      >
        {getLabel(target)}
      </Link>
    ) : (
      <button
        key={target.id}
        onClick={() => handleNavClick(target)}
        className="flex items-center w-full text-left pl-5 pr-4 text-[18px] font-medium hover:bg-white/[0.05]"
        style={{ height: 56, minHeight: 56, color: '#FFFFFF' }}
        type="button"
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
      <div className="hidden lg:block" style={{ background: '#060a14', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="container mx-auto px-6 max-w-[1200px] flex items-center justify-between h-9">
          <div className="flex items-center gap-5 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
            <Link to="/" className="hover:text-white transition-colors">{isFr ? "Personnel" : "Personal"}</Link>
            <Link to="/contact" className="hover:text-white transition-colors" style={{ color: 'rgba(255,255,255,0.45)' }}>{isFr ? "Nous contacter" : "Contact Us"}</Link>
          </div>
          <div className="flex items-center gap-5 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
            <Link to="/aide" className="hover:text-white transition-colors">{isFr ? "Centre d'aide" : "Help Center"}</Link>
            <Link to="/a-propos" className="hover:text-white transition-colors">{isFr ? "À propos" : "About"}</Link>
            <Link to="/emplois" className="hover:text-white transition-colors">{isFr ? "Emplois" : "Careers"}</Link>
            <Link to="/contact" className="hover:text-white transition-colors">{isFr ? "Nous joindre" : "Contact Us"}</Link>
            <LanguageSelector />
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        className="sticky top-0 z-50 transition-all duration-300"
        style={{
          height: 64,
          background: isScrolled ? 'rgba(10,14,26,0.92)' : 'rgba(10,14,26,0.97)',
          backdropFilter: 'blur(12px) saturate(160%)',
          WebkitBackdropFilter: 'blur(12px) saturate(160%)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          boxShadow: isScrolled ? '0 4px 24px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        <div className="container mx-auto px-4 sm:px-6 max-w-[1200px] h-full">
          {/* Mobile — 3-column grid: Sheet trigger | centered logo | spacer */}
          <div className="grid grid-cols-[56px_1fr_56px] items-center h-[64px] lg:hidden">
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <button
                  className="flex items-center justify-center w-[56px] h-[56px]"
                  style={{ color: '#FFFFFF' }}
                  aria-label={isMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
                  type="button"
                >
                  <Menu className="w-6 h-6" strokeWidth={2} />
                </button>
              </SheetTrigger>

              <SheetContent
                side="left"
                className="flex flex-col p-0 w-[85vw] max-w-[360px] border-r-0"
                style={{ background: '#0f1628', borderRight: '1px solid rgba(0,102,204,0.15)' }}
              >
                <div className="flex items-center px-4" style={{ height: 56, minHeight: 56, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <Link to="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2">
                    <LogoIcon size={28} />
                    <span className="font-bold text-lg" style={{ color: '#FFFFFF' }}>Nivra</span>
                  </Link>
                </div>

                <nav aria-label="Navigation mobile" className="flex-1 overflow-y-auto pt-2">
                  {NAV_TARGETS.map(renderMobileNavItem)}

                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <Link to="/aide" onClick={() => setIsMenuOpen(false)}
                      className="flex items-center pl-5 pr-4 text-[16px]"
                      style={{ height: 48, color: 'rgba(255,255,255,0.6)' }}
                    >
                      Support
                    </Link>
                    <Link to="/a-propos" onClick={() => setIsMenuOpen(false)}
                      className="flex items-center pl-5 pr-4 text-[16px]"
                      style={{ height: 48, color: 'rgba(255,255,255,0.6)' }}
                    >
                      {isFr ? "À propos" : "About"}
                    </Link>
                    <div className="px-5 py-3">
                      <LanguageSelector />
                    </div>
                  </div>
                </nav>

                <div className="p-4 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <Link
                    to="/commander"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-center w-full font-bold text-[16px] text-white"
                    style={{ height: 52, background: BLUE, borderRadius: 50 }}
                  >
                    {isFr ? "Commander" : "Order Now"}
                  </Link>
                  <Link
                    to={portalLink}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-center gap-2 w-full font-semibold text-[15px]"
                    style={{ height: 48, color: 'rgba(255,255,255,0.7)', borderRadius: 50, border: '2px solid rgba(255,255,255,0.15)' }}
                  >
                    <User className="w-4 h-4" />
                    {isFr ? "Mon compte" : "My account"}
                  </Link>
                </div>
              </SheetContent>
            </Sheet>

            <Link to="/" className="justify-self-center flex items-center gap-2">
              <LogoIcon size={28} />
              <span className="font-bold text-lg tracking-tight" style={{ color: '#FFFFFF' }}>Nivra</span>
            </Link>

            <div>{/* spacer */}</div>
          </div>

          {/* Desktop */}
          <div className="hidden lg:flex items-center h-[64px] gap-6">
            <Link to="/" className="flex items-center shrink-0 mr-2">
              <LogoFull height={32} />
            </Link>

            <div className="h-6 w-px mx-1" style={{ background: 'rgba(255,255,255,0.08)' }} />

            <nav aria-label="Navigation principale" className="flex items-center gap-0.5 flex-1 min-w-0">
              {NAV_TARGETS.filter((t) => !HEADER_HIDDEN_IDS.has(t.id)).map(renderDesktopNavItem)}
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="p-2 rounded-lg transition-colors hover:bg-white/10"
                style={{ color: 'rgba(255,255,255,0.45)' }}
                aria-label={isFr ? "Recherche" : "Search"}
              >
                <Search className="w-[18px] h-[18px]" />
              </button>
              <Link
                to={portalLink}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white hover:opacity-90 transition-all"
                style={{ background: BLUE, borderRadius: 50 }}
              >
                <User className="w-4 h-4" />
                {isFr ? "Mon compte" : "My account"}
              </Link>
            </div>
          </div>
        </div>
      </motion.header>
    </>
  );
};

export default Header;
