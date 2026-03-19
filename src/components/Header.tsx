import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, User, ChevronDown } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useOptionalAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "./LanguageSelector";
import { NAV_TARGETS, type NavTarget, validateNavTargets, safeScrollToSection } from "@/config/navigation";
import { PublicSystemStatusBanner } from "@/components/public/PublicSystemStatusBanner";

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
            className={`flex items-center gap-1 px-4 py-2 text-sm font-medium transition-colors rounded-md ${
              isActive
                ? 'text-blue-400'
                : 'text-white/70 hover:text-white'
            }`}
            type="button"
            onClick={() => handleNavClick(target)}
          >
            {getLabel(target)}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openDropdown === target.id ? 'rotate-180' : ''}`} />
          </button>

          {openDropdown === target.id && (
            <div className="absolute top-full left-0 pt-1 z-50">
              <div className="bg-[#0B1220] rounded-xl shadow-2xl border border-white/10 py-1.5 min-w-[200px]">
                {target.children!.map((child) => {
                  const childActive = location.pathname === child.target;
                  return (
                    <Link
                      key={child.id}
                      to={child.target}
                      className={`block px-4 py-2.5 text-sm font-medium transition-colors ${
                        childActive
                          ? 'text-blue-400 bg-blue-500/10'
                          : 'text-white/70 hover:text-white hover:bg-white/5'
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
        className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
          isActive
            ? 'text-blue-400'
            : 'text-white/70 hover:text-white'
        }`}
      >
        {getLabel(target)}
      </Link>
    ) : (
      <button
        key={target.id}
        onClick={() => handleNavClick(target)}
        className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors rounded-md"
        type="button"
      >
        {getLabel(target)}
      </button>
    );
  };

  const renderMobileNavItem = (target: NavTarget) => {
    const hasChildren = target.children && target.children.length > 0;
    const isExpanded = mobileExpanded === target.id;

    if (hasChildren) {
      return (
        <div key={target.id}>
          <button
            onClick={() => setMobileExpanded(isExpanded ? null : target.id)}
            className="flex items-center justify-between w-full px-4 py-3.5 text-base font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-xl mb-1 min-h-[44px]"
            type="button"
          >
            {getLabel(target)}
            <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
          {isExpanded && (
            <div className="pl-4 space-y-0.5 mb-1">
              {target.children!.map((child) => (
                <Link
                  key={child.id}
                  to={child.target}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl min-h-[44px] ${
                    location.pathname === child.target
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {getLabel(child)}
                </Link>
              ))}
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
        className={`flex items-center px-4 py-3.5 text-base font-medium rounded-xl mb-1 min-h-[44px] ${
          location.pathname === target.target
            ? 'bg-blue-500/10 text-blue-400'
            : 'text-white/80 hover:text-white hover:bg-white/5'
        }`}
      >
        {getLabel(target)}
      </Link>
    ) : (
      <button
        key={target.id}
        onClick={() => handleNavClick(target)}
        className="flex items-center w-full text-left px-4 py-3.5 text-base font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-xl mb-1 min-h-[44px]"
        type="button"
      >
        {getLabel(target)}
      </button>
    );
  };

  return (
    <>
      <PublicSystemStatusBanner />
      
      {/* Main navigation — dark premium */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-[#050816]/95 backdrop-blur-lg shadow-lg shadow-black/20' : 'bg-[#050816]/80 backdrop-blur-md'} border-b border-white/5`}>
        <div className="container mx-auto px-4 max-w-[1320px]">
          {/* Mobile */}
          <div className="grid grid-cols-[56px_1fr_56px] items-center h-16 lg:hidden">
            <button
              className="w-14 h-14 flex items-center justify-center text-white/70 hover:text-white rounded-lg"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
              type="button"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link to="/" className="justify-self-center flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center">
                <span className="font-bold text-white text-lg">N</span>
              </div>
              <span className="font-bold text-xl text-white tracking-tight">Nivra</span>
            </Link>

            <Link
              to={portalLink}
              className="w-14 h-14 flex items-center justify-center justify-self-end text-white/70 hover:text-white rounded-lg"
              aria-label="Compte"
            >
              <User className="w-5 h-5" />
            </Link>
          </div>

          {/* Desktop */}
          <div className="hidden lg:flex items-center h-16">
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center">
                <span className="font-bold text-white text-lg">N</span>
              </div>
              <span className="font-bold text-xl text-white tracking-tight">Nivra</span>
            </Link>

            <nav className="flex items-center gap-1 ml-10 flex-1">
              {NAV_TARGETS.map(renderDesktopNavItem)}
            </nav>

            <div className="flex items-center gap-3 shrink-0">
              <LanguageSelector />
              <Button
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-6 h-10 text-sm font-semibold shadow-lg shadow-blue-500/25"
                asChild
              >
                <Link to="/portal/auth">
                  {isFr ? "Commander" : "Order"}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu — dark drawer */}
      {isMenuOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" 
            onClick={() => setIsMenuOpen(false)} 
          />
          <div className="fixed top-0 left-0 h-full w-[85vw] max-w-[320px] bg-[#0B1220] z-50 shadow-2xl lg:hidden overflow-y-auto border-r border-white/5">
            <div className="p-4 border-b border-white/10 flex items-center justify-between h-16">
              <Link to="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                  <span className="font-bold text-white text-sm">N</span>
                </div>
                <span className="font-bold text-white text-lg">Nivra</span>
              </Link>
              <button onClick={() => setIsMenuOpen(false)} className="p-2 text-white/40 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="p-3">
              {NAV_TARGETS.map(renderMobileNavItem)}
            </nav>

            <div className="p-4 border-t border-white/10 space-y-1">
              <div className="px-4 py-2">
                <LanguageSelector />
              </div>
            </div>

            <div className="p-4 border-t border-white/10">
              <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white h-12 text-base font-semibold rounded-xl" asChild>
                <Link to={portalLink} onClick={() => setIsMenuOpen(false)}>
                  {isFr ? "Commander" : "Order"}
                </Link>
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default Header;
