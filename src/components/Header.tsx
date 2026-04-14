import { useState, useEffect, useRef } from "react";
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
                ? 'text-primary'
                : 'text-foreground/70 hover:text-primary hover:bg-secondary'
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
              <div className="bg-card rounded-xl shadow-lg border border-border py-1.5 min-w-[200px]">
                {target.children!.map((child) => {
                  const childActive = location.pathname === child.target;
                  return (
                    <Link
                      key={child.id}
                      to={child.target}
                      className={`block px-4 py-2.5 text-sm font-medium transition-colors ${
                        childActive
                          ? 'text-primary bg-primary/5'
                          : 'text-foreground/70 hover:text-primary hover:bg-secondary'
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
            ? 'text-primary'
            : 'text-foreground/70 hover:text-primary hover:bg-secondary'
        }`}
      >
        {getLabel(target)}
      </Link>
    ) : (
      <button
        key={target.id}
        onClick={() => handleNavClick(target)}
        className="px-3 py-2 text-sm font-semibold text-foreground/70 hover:text-primary hover:bg-secondary transition-colors rounded-md"
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
            className="flex items-center justify-between w-full px-4 py-3.5 text-base font-medium text-foreground/80 hover:bg-secondary active:bg-secondary/80 rounded-xl mb-1 min-h-[44px]"
            type="button"
            aria-expanded={isExpanded}
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
                      ? 'bg-primary/5 text-primary'
                      : 'text-foreground/60 hover:bg-secondary active:bg-secondary/80'
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
            ? 'bg-primary/5 text-primary'
            : 'text-foreground/80 hover:bg-secondary active:bg-secondary/80'
        }`}
      >
        {getLabel(target)}
      </Link>
    ) : (
      <button
        key={target.id}
        onClick={() => handleNavClick(target)}
        className="flex items-center w-full text-left px-4 py-3.5 text-base font-medium text-foreground/80 hover:bg-secondary active:bg-secondary/80 rounded-xl mb-1 min-h-[44px]"
        type="button"
      >
        {getLabel(target)}
      </button>
    );
  };

  return (
    <>
      <PublicSystemStatusBanner />
      
      {/* Top utility bar */}
      <div className="bg-muted/60 border-b border-border hidden lg:block">
        <div className="container mx-auto px-6 max-w-[1200px] flex items-center justify-between h-9">
          <div className="flex items-center gap-5 text-xs font-medium text-foreground/70">
            <Link to="/" className="hover:text-primary transition-colors">{isFr ? "Personnel" : "Personal"}</Link>
            <Link to="/contact" className="text-muted-foreground hover:text-primary transition-colors">{isFr ? "Entreprise" : "Business"}</Link>
          </div>
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <Link to="/aide" className="hover:text-foreground transition-colors">
              {isFr ? "Trouver un point de vente" : "Find a store"}
            </Link>
            <Link to="/a-propos" className="hover:text-foreground transition-colors">
              {isFr ? "À propos" : "About"}
            </Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">
              {isFr ? "Nous joindre" : "Contact Us"}
            </Link>
            <LanguageSelector />
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <header className={`sticky top-0 z-50 bg-background/98 backdrop-blur-xl transition-all duration-300 ${isScrolled ? 'shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] border-b border-border/60' : 'border-b border-transparent'}`}>
        <div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
          {/* Mobile */}
          <div className="grid grid-cols-[56px_1fr_56px] items-center h-14 lg:hidden">
            <button
              className="w-14 h-14 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
              type="button"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link to="/" className="justify-self-center flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                <span className="font-bold text-primary-foreground text-lg">N</span>
              </div>
              <span className="font-bold text-xl text-primary tracking-tight">Nivra</span>
            </Link>

            <Link
              to={portalLink}
              className="w-14 h-14 flex items-center justify-center justify-self-end text-muted-foreground hover:text-primary hover:bg-secondary rounded-lg"
              aria-label="Compte"
            >
              <User className="w-5 h-5" />
            </Link>
          </div>

          {/* Desktop */}
          <div className="hidden lg:flex items-center h-16 gap-6">
            <Link to="/" className="flex items-center gap-2.5 shrink-0 mr-2">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm">
                <span className="font-extrabold text-primary-foreground text-xl">N</span>
              </div>
              <span className="font-extrabold text-[1.35rem] text-primary tracking-tight">Nivra</span>
            </Link>

            <div className="h-6 w-px bg-border/60 mx-1" />

            <nav aria-label="Navigation principale" className="flex items-center gap-0.5 flex-1">
              {NAV_TARGETS.map(renderDesktopNavItem)}
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <button className="p-2 text-muted-foreground hover:text-primary hover:bg-secondary/80 rounded-lg transition-colors" aria-label="Recherche">
                <Search className="w-[18px] h-[18px]" />
              </button>
              <Link
                to={portalLink}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-all shadow-sm hover:shadow-md"
              >
                <User className="w-4 h-4" />
                {isFr ? "Mon compte" : "My account"}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/40 z-40 lg:hidden" 
            onClick={() => setIsMenuOpen(false)}
            aria-hidden="true"
          />
          <div id="mobile-menu" role="dialog" aria-label="Menu de navigation" className="fixed top-0 left-0 h-full w-[85vw] max-w-[320px] bg-background z-50 shadow-2xl lg:hidden overflow-y-auto">
            <div className="p-4 border-b border-border flex items-center justify-between h-14">
              <Link to="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="font-bold text-primary-foreground text-sm">N</span>
                </div>
                <span className="font-bold text-primary text-lg">Nivra</span>
              </Link>
              <button onClick={() => setIsMenuOpen(false)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg" aria-label="Fermer le menu">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav aria-label="Navigation mobile" className="p-3">
              {NAV_TARGETS.map(renderMobileNavItem)}
            </nav>

            <div className="p-4 border-t border-border space-y-1">
              <Link to="/aide" onClick={() => setIsMenuOpen(false)} className="flex items-center px-4 py-3 text-sm text-muted-foreground hover:bg-secondary rounded-xl min-h-[44px]">
                Support
              </Link>
              <Link to="/a-propos" onClick={() => setIsMenuOpen(false)} className="flex items-center px-4 py-3 text-sm text-muted-foreground hover:bg-secondary rounded-xl min-h-[44px]">
                {isFr ? "À propos" : "About"}
              </Link>
              <div className="px-4 py-2">
                <LanguageSelector />
              </div>
            </div>

            <div className="p-4 border-t border-border">
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base font-semibold rounded-xl" asChild>
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
