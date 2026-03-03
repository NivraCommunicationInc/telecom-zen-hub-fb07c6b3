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
      
      {/* Top utility bar — Bell-style: Personal | Business | Find a store | FR */}
      <div className="bg-slate-100 border-b border-slate-200 hidden lg:block">
        <div className="container mx-auto px-4 max-w-7xl flex items-center justify-between h-9">
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

      {/* Main navigation — Bell-style: WHITE background, dark text */}
      <header className={`sticky top-0 z-50 bg-white border-b border-slate-200 transition-all duration-200 ${isScrolled ? 'shadow-sm' : ''}`}>
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center justify-between h-16 lg:h-[68px]">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-[#003366] flex items-center justify-center">
                <span className="font-bold text-white text-xl">N</span>
              </div>
              <span className="font-bold text-xl text-[#003366] tracking-tight hidden sm:block">Nivra</span>
            </Link>

            {/* Desktop Navigation — dark text on white */}
            <nav className="hidden lg:flex items-center gap-1 ml-10">
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

            {/* Right side — Bell style: search + blue login */}
            <div className="hidden lg:flex items-center gap-3">
              <button className="p-2 text-slate-500 hover:text-[#003366] hover:bg-slate-50 rounded-lg transition-colors">
                <Search className="w-5 h-5" />
              </button>
              <Link 
                to={portalLink}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#003366] text-white rounded-full hover:bg-[#002244] transition-colors"
              >
                {isFr ? "Connexion" : "Log in"}
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
              type="button"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setIsMenuOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-80 bg-white z-50 shadow-2xl lg:hidden overflow-y-auto">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#003366] flex items-center justify-center">
                  <span className="font-bold text-white text-sm">N</span>
                </div>
                <span className="font-bold text-[#003366] text-lg">Nivra</span>
              </div>
              <button onClick={() => setIsMenuOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="p-3">
              {NAV_TARGETS.map((target) => (
                target.type === 'route' ? (
                  <Link
                    key={target.id}
                    to={target.target}
                    onClick={() => setIsMenuOpen(false)}
                    className={`block px-4 py-3 text-sm font-medium rounded-lg mb-0.5 ${
                      location.pathname === target.target
                        ? 'bg-blue-50 text-[#003366]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {getLabel(target)}
                  </Link>
                ) : (
                  <button
                    key={target.id}
                    onClick={() => handleNavClick(target)}
                    className="block w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg mb-0.5"
                    type="button"
                  >
                    {getLabel(target)}
                  </button>
                )
              ))}
            </nav>

            <div className="p-4 border-t border-slate-200 space-y-2">
              <Link to="/aide" onClick={() => setIsMenuOpen(false)} className="block px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 rounded-lg">
                Support
              </Link>
              <Link to="/a-propos" onClick={() => setIsMenuOpen(false)} className="block px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 rounded-lg">
                {isFr ? "À propos" : "About"}
              </Link>
              <LanguageSelector />
              <Button className="w-full bg-[#003366] hover:bg-[#002244] text-white" asChild>
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
