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
import { QuickAnnouncementBanner } from "@/components/public/QuickAnnouncementBanner";
import { SiteSearchDialog } from "@/components/public/SiteSearchDialog";

const PURPLE = "#7c3aed";
const PURPLE_DARK = "#5b21b6";

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
                ? 'text-[#0D0D0D]'
                : 'text-[#6B7280] hover:text-[#0D0D0D]'
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
              <div className="rounded-xl shadow-lg py-1.5 min-w-[200px]" style={{ background: '#FFFFFF', border: '1px solid #E8E8E8' }}>
                {target.children!.map((child) => {
                  const childActive = location.pathname === child.target;
                  return (
                    <Link
                      key={child.id}
                      to={child.target}
                      className={`block px-4 py-2.5 text-sm font-medium transition-colors ${
                        childActive
                          ? 'text-[#7C3AED] bg-[#F3EEFF]'
                          : 'text-[#6B7280] hover:text-[#0D0D0D] hover:bg-[#F5F5F5]'
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
            ? 'text-[#0D0D0D]'
            : 'text-[#6B7280] hover:text-[#0D0D0D]'
        }`}
      >
        {getLabel(target)}
      </Link>
    ) : (
      <button
        key={target.id}
        onClick={() => handleNavClick(target)}
        className="px-3 py-2 text-sm font-semibold text-[#6B7280] hover:text-[#0D0D0D] transition-colors rounded-md"
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
            className="flex items-center justify-between w-full pl-5 pr-4 text-[18px] font-medium hover:bg-[#F5F5F5]"
            style={{ height: 56, minHeight: 56, color: '#0D0D0D' }}
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
                      color: childActive ? PURPLE : '#6B7280',
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
        className="flex items-center pl-5 pr-4 text-[18px] font-medium hover:bg-[#F5F5F5]"
        style={{
          height: 56,
          minHeight: 56,
          color: isActive ? PURPLE : '#0D0D0D',
        }}
      >
        {getLabel(target)}
      </Link>
    ) : (
      <button
        key={target.id}
        onClick={() => handleNavClick(target)}
        className="flex items-center w-full text-left pl-5 pr-4 text-[18px] font-medium hover:bg-[#F5F5F5]"
        style={{ height: 56, minHeight: 56, color: '#0D0D0D' }}
        type="button"
      >
        {getLabel(target)}
      </button>
    );
  };

  return (
    <>
      <SiteSearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />
      <QuickAnnouncementBanner />
      <PublicSystemStatusBanner />
      
      {/* Top utility bar — desktop only */}
      <div className="hidden lg:block" style={{ background: '#F5F5F5', borderBottom: '1px solid #E8E8E8' }}>
        <div className="container mx-auto px-6 max-w-[1200px] flex items-center justify-between h-9">
          <div className="flex items-center gap-5 text-xs font-medium" style={{ color: '#6B7280' }}>
            <Link to="/" className="hover:text-[#0D0D0D] transition-colors">{isFr ? "Personnel" : "Personal"}</Link>
            <Link to="/contact" className="hover:text-[#0D0D0D] transition-colors" style={{ color: '#6B7280' }}>{isFr ? "Entreprise" : "Business"}</Link>
          </div>
          <div className="flex items-center gap-5 text-xs" style={{ color: '#6B7280' }}>
            <Link to="/aide" className="hover:text-[#0D0D0D] transition-colors">
              {isFr ? "Trouver un point de vente" : "Find a store"}
            </Link>
            <Link to="/a-propos" className="hover:text-[#0D0D0D] transition-colors">
              {isFr ? "À propos" : "About"}
            </Link>
            <Link to="/contact" className="hover:text-[#0D0D0D] transition-colors">
              {isFr ? "Nous joindre" : "Contact Us"}
            </Link>
            <LanguageSelector />
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${isScrolled ? 'shadow-sm' : ''}`}
        style={{ height: 64, background: '#FFFFFF', borderBottom: '1px solid #EEEEEE' }}
        
      >
        <div className="container mx-auto px-4 sm:px-6 max-w-[1200px] h-full">
          {/* Mobile — 3-column grid: hamburger | centered logo | spacer */}
          <div className="grid grid-cols-[56px_1fr_56px] items-center h-[64px] lg:hidden">
            <button
              className="flex items-center justify-center w-[56px] h-[56px]" style={{ color: '#0D0D0D' }}
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
              <span className="font-bold text-lg tracking-tight" style={{ color: '#0D0D0D' }}>Nivra</span>
            </Link>

            <div>{/* spacer */}</div>
          </div>

          {/* Desktop */}
          <div className="hidden lg:flex items-center h-[64px] gap-6">
            <Link to="/" className="flex items-center shrink-0 mr-2">
              <LogoFull height={32} />
            </Link>

            <div className="h-6 w-px mx-1" style={{ background: '#eeeeee' }} />

            <nav aria-label="Navigation principale" className="flex items-center gap-0.5 flex-1">
              {NAV_TARGETS.map(renderDesktopNavItem)}
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                style={{ color: '#999999' }}
                aria-label={isFr ? "Recherche" : "Search"}
              >
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
          style={{ background: '#FFFFFF' }}
        >
          <div className="flex items-center justify-between px-4" style={{ height: 56, minHeight: 56, borderBottom: '1px solid #E8E8E8' }}>
            <Link to="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2">
              <LogoIcon size={28} />
              <span className="font-bold text-lg" style={{ color: '#0D0D0D' }}>Nivra</span>
            </Link>
            <button
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center justify-center"
              style={{ width: 44, height: 44, minWidth: 44, minHeight: 44, color: '#0D0D0D' }}
              aria-label="Fermer le menu"
            >
              <X className="w-6 h-6" strokeWidth={2} />
            </button>
          </div>

          <nav aria-label="Navigation mobile" className="flex-1 overflow-y-auto pt-2">
            {NAV_TARGETS.map(renderMobileNavItem)}

            <div className="mt-4 pt-4" style={{ borderTop: '1px solid #E8E8E8' }}>
              <Link to="/aide" onClick={() => setIsMenuOpen(false)}
                className="flex items-center pl-5 pr-4 text-[16px]"
                style={{ height: 48, color: '#6B7280' }}
              >
                Support
              </Link>
              <Link to="/a-propos" onClick={() => setIsMenuOpen(false)}
                className="flex items-center pl-5 pr-4 text-[16px]"
                style={{ height: 48, color: '#6B7280' }}
              >
                {isFr ? "À propos" : "About"}
              </Link>
              <div className="px-5 py-3">
                <LanguageSelector />
              </div>
            </div>
          </nav>

          <div className="p-4 space-y-3" style={{ borderTop: '1px solid #E8E8E8' }}>
            <Link
              to="/commander"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center justify-center w-full font-bold text-[16px] text-white"
              style={{ height: 52, background: '#7C3AED', borderRadius: 50 }}
            >
              {isFr ? "Commander" : "Order Now"}
            </Link>
            <Link
              to={portalLink}
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full font-semibold text-[15px]"
              style={{ height: 48, color: '#6B7280', borderRadius: 50, border: '2px solid #E8E8E8' }}
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
