import { useState, useEffect, useRef } from "react";
import { LogoIcon, LogoFull } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Menu, X, User, Search, ChevronDown } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useOptionalAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "./LanguageSelector";
import { NAV_TARGETS, type NavTarget, validateNavTargets, safeScrollToSection } from "@/config/navigation";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { PublicSystemStatusBanner } from "@/components/public/PublicSystemStatusBanner";

const PURPLE = "#7c3aed";
const PURPLE_DARK = "#5b21b6";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
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
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMenuOpen]);

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
              isActive
                ? 'text-[#111111]'
                : 'text-[#555555] hover:text-[#111111]'
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
              <div className="bg-white rounded-xl shadow-lg border border-[#eeeeee] py-1.5 min-w-[200px]">
                {target.children!.map((child) => {
                  const childActive = location.pathname === child.target;
                  return (
                    <Link
                      key={child.id}
                      to={child.target}
                      className={`block px-4 py-2.5 text-sm font-medium transition-colors ${
                        childActive
                          ? 'text-[#7c3aed] bg-[#f3eeff]'
                          : 'text-[#555555] hover:text-[#111111] hover:bg-[#f8f8f8]'
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
          isActive
            ? 'text-[#111111]'
            : 'text-[#555555] hover:text-[#111111]'
        }`}
      >
        {getLabel(target)}
      </Link>
    ) : (
      <button
        key={target.id}
        onClick={() => handleNavClick(target)}
        className="px-3 py-2 text-sm font-semibold text-[#555555] hover:text-[#111111] transition-colors rounded-md"
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
            className="flex items-center justify-between w-full pl-5 pr-4 text-[18px] font-medium hover:bg-[#f8f8f8]"
            style={{ height: 56, minHeight: 56, color: '#111111' }}
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
                      color: childActive ? PURPLE : '#999999',
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
        className="flex items-center pl-5 pr-4 text-[18px] font-medium hover:bg-[#f8f8f8] active:bg-[#f0f0f0]"
        style={{
          height: 56,
          minHeight: 56,
          color: isActive ? PURPLE : '#111111',
        }}
      >
        {getLabel(target)}
      </Link>
    ) : (
      <button
        key={target.id}
        onClick={() => handleNavClick(target)}
        className="flex items-center w-full text-left pl-5 pr-4 text-[18px] font-medium text-white hover:bg-white/5 active:bg-white/10"
        style={{ height: 56, minHeight: 56 }}
        type="button"
      >
        {getLabel(target)}
      </button>
    );
  };

  return (
    <>
      <PublicSystemStatusBanner />
      
      {/* Top utility bar — desktop only */}
      <div className="bg-[#f8f8f8] border-b border-[#eeeeee] hidden lg:block">
        <div className="container mx-auto px-6 max-w-[1200px] flex items-center justify-between h-9">
          <div className="flex items-center gap-5 text-xs font-medium" style={{ color: '#555555' }}>
            <Link to="/" className="hover:text-[#111111] transition-colors">{isFr ? "Personnel" : "Personal"}</Link>
            <Link to="/contact" className="hover:text-[#111111] transition-colors" style={{ color: '#999999' }}>{isFr ? "Entreprise" : "Business"}</Link>
          </div>
          <div className="flex items-center gap-5 text-xs" style={{ color: '#999999' }}>
            <Link to="/aide" className="hover:text-[#111111] transition-colors">
              {isFr ? "Trouver un point de vente" : "Find a store"}
            </Link>
            <Link to="/a-propos" className="hover:text-[#111111] transition-colors">
              {isFr ? "À propos" : "About"}
            </Link>
            <Link to="/contact" className="hover:text-[#111111] transition-colors">
              {isFr ? "Nous joindre" : "Contact Us"}
            </Link>
            <LanguageSelector />
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${isScrolled ? 'shadow-sm' : ''}`}
        style={{ height: 56, background: '#ffffff', borderBottom: '1px solid #eeeeee' }}
        
      >
        <div className="container mx-auto px-4 sm:px-6 max-w-[1200px] h-full">
          {/* Mobile — 3-column grid: hamburger | centered logo | spacer */}
          <div className="grid grid-cols-[56px_1fr_56px] items-center h-[56px] lg:hidden">
            <button
              className="flex items-center justify-center w-[56px] h-[56px]" style={{ color: '#111111' }}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
              type="button"
            >
              <Menu className="w-6 h-6" strokeWidth={2} />
            </button>

            <Link to="/" className="justify-self-center flex items-center gap-2">
              <LogoIcon size={28} />
              <span className="font-bold text-lg tracking-tight" style={{ color: '#111111' }}>Nivra</span>
            </Link>

            <div>{/* spacer */}</div>
          </div>

          {/* Desktop */}
          <div className="hidden lg:flex items-center h-[56px] gap-6">
            <Link to="/" className="flex items-center shrink-0 mr-2">
              <LogoFull height={32} />
            </Link>

            <div className="h-6 w-px mx-1" style={{ background: '#eeeeee' }} />

            <nav aria-label="Navigation principale" className="flex items-center gap-0.5 flex-1">
              {NAV_TARGETS.map(renderDesktopNavItem)}
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <button className="p-2 rounded-lg transition-colors" style={{ color: '#999999' }} aria-label="Recherche">
                <Search className="w-[18px] h-[18px]" />
              </button>
              <Link
                to={portalLink}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white hover:opacity-90 transition-all"
                style={{ background: PURPLE, borderRadius: 50 }}
                
              >
                <User className="w-4 h-4" />
                {isFr ? "Mon compte" : "My account"}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu — full-screen overlay */}
      {isMenuOpen && (
        <div
          id="mobile-menu"
          role="dialog"
          aria-label="Menu de navigation"
          className="fixed inset-0 z-[100] lg:hidden flex flex-col"
          style={{ background: '#ffffff' }}
        >
          {/* Top bar with close */}
          <div className="flex items-center justify-between px-4" style={{ height: 56, minHeight: 56, borderBottom: '1px solid #eeeeee' }}>
            <Link to="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2">
              <LogoIcon size={28} />
              <span className="font-bold text-lg" style={{ color: '#111111' }}>Nivra</span>
            </Link>
            <button
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center justify-center"
              style={{ width: 44, height: 44, minWidth: 44, minHeight: 44, color: '#111111' }}
              aria-label="Fermer le menu"
            >
              <X className="w-6 h-6" strokeWidth={2} />
            </button>
          </div>

          {/* Nav links */}
          <nav aria-label="Navigation mobile" className="flex-1 overflow-y-auto pt-2">
            {NAV_TARGETS.map(renderMobileNavItem)}

            <div className="mt-4 pt-4" style={{ borderTop: '1px solid #eeeeee' }}>
              <Link to="/aide" onClick={() => setIsMenuOpen(false)}
                className="flex items-center pl-5 pr-4 text-[16px]"
                style={{ height: 48, color: '#999999' }}
              >
                Support
              </Link>
              <Link to="/a-propos" onClick={() => setIsMenuOpen(false)}
                className="flex items-center pl-5 pr-4 text-[16px]"
                style={{ height: 48, color: '#999999' }}
              >
                {isFr ? "À propos" : "About"}
              </Link>
              <div className="px-5 py-3">
                <LanguageSelector />
              </div>
            </div>
          </nav>

          {/* Bottom actions */}
          <div className="p-4 space-y-3" style={{ borderTop: '1px solid #eeeeee' }}>
            <Link
              to="/commander"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center justify-center w-full font-bold text-[16px] text-white"
              style={{ height: 52, background: PURPLE, borderRadius: 50 }}
            >
              {isFr ? "Commander" : "Order Now"}
            </Link>
            <Link
              to={portalLink}
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full font-semibold text-[15px]"
              style={{ height: 48, color: '#555555', borderRadius: 50, border: '2px solid #eeeeee' }}
            >
              <User className="w-4 h-4" />
              {isFr ? "Mon compte" : "My account"}
            </Link>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
