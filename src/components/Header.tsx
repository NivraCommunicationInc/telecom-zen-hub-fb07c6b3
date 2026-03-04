import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, User, Search, ChevronDown } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useOptionalAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "./LanguageSelector";
import { NAV_TARGETS, type NavTarget, validateNavTargets, safeScrollToSection } from "@/config/navigation";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { PublicSystemStatusBanner } from "@/components/public/PublicSystemStatusBanner";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
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

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMenuOpen]);

  const handleNavClick = (target: NavTarget) => {
    try {
      setIsMenuOpen(false);
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

  return (
    <>
      <PublicSystemStatusBanner />
      
      {/* Top utility bar — Bell-style */}
      <div className="bg-slate-100 border-b border-slate-200 hidden lg:block">
        <div className="container mx-auto px-6 max-w-[1320px] flex items-center justify-between h-9">
          <div className="flex items-center gap-5 text-xs font-medium text-slate-700">
            <Link to="/" className="hover:underline underline-offset-2">{isFr ? "Personnel" : "Personal"}</Link>
            <Link to="/contact" className="text-slate-500 hover:underline underline-offset-2">{isFr ? "Entreprise" : "Business"}</Link>
          </div>
          <div className="flex items-center gap-5 text-xs text-slate-500">
            <Link to="/aide" className="hover:text-slate-800 transition-colors">
              {isFr ? "Trouver un point de vente" : "Find a store"}
            </Link>
            <Link to="/a-propos" className="hover:text-slate-800 transition-colors">
              {isFr ? "À propos" : "About"}
            </Link>
            <Link to="/contact" className="hover:text-slate-800 transition-colors">
              {isFr ? "Nous joindre" : "Contact Us"}
            </Link>
            <LanguageSelector />
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <header className={`sticky top-0 z-50 bg-white border-b border-slate-200 transition-shadow duration-200 ${isScrolled ? 'shadow-sm' : ''}`}>
        <div className="container mx-auto px-4 max-w-[1320px]">
          {/* Mobile: h-14 (56px), Desktop: h-16 (64px) */}
          <div className="flex items-center h-14 lg:h-16">
            
            {/* Mobile: hamburger LEFT */}
            <button
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg shrink-0"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
              type="button"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Mobile: Logo CENTERED via flex-1 spacers */}
            <div className="flex-1 flex items-center justify-center lg:justify-start lg:flex-initial">
              <Link to="/" className="flex items-center gap-2 shrink-0">
                <div className="w-9 h-9 rounded-xl bg-[#003366] flex items-center justify-center">
                  <span className="font-bold text-white text-lg">N</span>
                </div>
                <span className="font-bold text-xl text-[#003366] tracking-tight">Nivra</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1 ml-10 flex-1">
              {NAV_TARGETS.map((target) => {
                const isActive = target.type === 'route' 
                  ? location.pathname === target.target 
                  : location.hash === `#${target.target}`;
                
                return target.type === 'route' ? (
                  <Link
                    key={target.id}
                    to={target.target}
                    className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                      isActive
                        ? 'text-[#003366] underline underline-offset-[22px] decoration-2 decoration-[#003366]'
                        : 'text-slate-700 hover:text-[#003366] hover:bg-slate-50'
                    }`}
                  >
                    {getLabel(target)}
                  </Link>
                ) : (
                  <button
                    key={target.id}
                    onClick={() => handleNavClick(target)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-[#003366] hover:bg-slate-50 transition-colors rounded-md"
                    type="button"
                  >
                    {getLabel(target)}
                  </button>
                );
              })}
            </nav>

            {/* Right side — desktop: search + login; mobile: account icon */}
            <div className="flex items-center gap-2 shrink-0">
              <button className="hidden lg:flex p-2 text-slate-500 hover:text-[#003366] hover:bg-slate-50 rounded-lg transition-colors">
                <Search className="w-5 h-5" />
              </button>
              {/* Mobile: compact account icon */}
              <Link 
                to={portalLink}
                className="lg:hidden p-2 text-slate-600 hover:text-[#003366] hover:bg-slate-50 rounded-lg"
              >
                <User className="w-5 h-5" />
              </Link>
              {/* Desktop: full login button */}
              <Link 
                to={portalLink}
                className="hidden lg:flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#003366] text-white rounded-full hover:bg-[#002244] transition-colors"
              >
                {isFr ? "Connexion" : "Log in"}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu — full-height drawer from LEFT */}
      {isMenuOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/40 z-40 lg:hidden" 
            onClick={() => setIsMenuOpen(false)} 
          />
          <div className="fixed top-0 left-0 h-full w-[85vw] max-w-[320px] bg-white z-50 shadow-2xl lg:hidden overflow-y-auto">
            {/* Drawer header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between h-14">
              <Link to="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#003366] flex items-center justify-center">
                  <span className="font-bold text-white text-sm">N</span>
                </div>
                <span className="font-bold text-[#003366] text-lg">Nivra</span>
              </Link>
              <button onClick={() => setIsMenuOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation links — large tap targets (min 44px) */}
            <nav className="p-3">
              {NAV_TARGETS.map((target) => (
                target.type === 'route' ? (
                  <Link
                    key={target.id}
                    to={target.target}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center px-4 py-3.5 text-base font-medium rounded-xl mb-1 min-h-[44px] ${
                      location.pathname === target.target
                        ? 'bg-blue-50 text-[#003366]'
                        : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100'
                    }`}
                  >
                    {getLabel(target)}
                  </Link>
                ) : (
                  <button
                    key={target.id}
                    onClick={() => handleNavClick(target)}
                    className="flex items-center w-full text-left px-4 py-3.5 text-base font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100 rounded-xl mb-1 min-h-[44px]"
                    type="button"
                  >
                    {getLabel(target)}
                  </button>
                )
              ))}
            </nav>

            {/* Utility links */}
            <div className="p-4 border-t border-slate-200 space-y-1">
              <Link to="/aide" onClick={() => setIsMenuOpen(false)} className="flex items-center px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 rounded-xl min-h-[44px]">
                Support
              </Link>
              <Link to="/a-propos" onClick={() => setIsMenuOpen(false)} className="flex items-center px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 rounded-xl min-h-[44px]">
                {isFr ? "À propos" : "About"}
              </Link>
              <div className="px-4 py-2">
                <LanguageSelector />
              </div>
            </div>

            {/* Login CTA — prominent at bottom */}
            <div className="p-4 border-t border-slate-200">
              <Button className="w-full bg-[#003366] hover:bg-[#002244] text-white h-12 text-base font-semibold rounded-xl" asChild>
                <Link to={portalLink} onClick={() => setIsMenuOpen(false)}>
                  <User className="w-4 h-4 mr-2" />
                  {isFr ? "Connexion" : "Log in"}
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
