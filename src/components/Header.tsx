import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, MessageSquare, User } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useOptionalAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "./LanguageSelector";
import { NAV_TARGETS, type NavTarget, validateNavTargets, safeScrollToSection } from "@/config/navigation";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { COMPANY_CONTACT } from "@/config/company";
import { PublicSystemStatusBanner } from "@/components/public/PublicSystemStatusBanner";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useOptionalAuth();
  const { t, language } = useLanguage();
  const { data: siteSettings } = useSiteSettings();

  // Phone removed - support via chat/tickets only

  const portalLink = user ? "/portal" : "/portal/auth";

  // Track scroll for header styling
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Validate nav targets in development on homepage
  useEffect(() => {
    if (import.meta.env.DEV && location.pathname === '/') {
      const timer = setTimeout(() => {
        validateNavTargets();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  // Handle hash-based navigation
  useEffect(() => {
    if (location.hash) {
      const sectionId = location.hash.replace("#", "");
      setTimeout(() => {
        safeScrollToSection(sectionId);
      }, 100);
    }
  }, [location]);

  /**
   * Safe navigation handler with null checks and fallback
   */
  const handleNavClick = (target: NavTarget) => {
    try {
      setIsMenuOpen(false);

      if (target.type === 'scroll') {
        // Scroll to section on homepage
        if (location.pathname !== "/") {
          navigate(`/#${target.target}`);
        } else {
          if (!safeScrollToSection(target.target)) {
            // Fallback if section not found
            console.warn(`[Nav] Section ${target.target} not found, navigating to fallback`);
            navigate(target.fallbackRoute);
          }
        }
      } else {
        // Route navigation
        navigate(target.target);
      }
    } catch (error) {
      console.error('[Nav] Navigation error:', error);
      // Ultimate fallback - use window.location
      window.location.href = target.fallbackRoute;
    }
  };

  /**
   * Get localized label for nav target
   */
  const getLabel = (target: NavTarget): string => {
    return language === 'fr' ? target.labelFr : target.label;
  };

  return (
    <>
      {/* System status alerts shown above header */}
      <PublicSystemStatusBanner />
      <header className={`sticky top-0 z-50 transition-all duration-200 ${
        isScrolled 
          ? 'bg-white/98 backdrop-blur-sm border-b border-border shadow-sm' 
          : 'bg-white/95 backdrop-blur-sm border-b border-border/50'
      }`}>
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="relative flex items-center justify-between h-16 lg:h-18">
          {/* Left spacer - matches hamburger width on mobile for centering */}
          <div className="w-10 lg:hidden" aria-hidden="true" />

          {/* Logo - centered on mobile, left-aligned on desktop */}
          <Link 
            to="/" 
            className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5 lg:static lg:translate-x-0"
          >
            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
              <span className="font-bold text-white text-lg">N</span>
            </div>
            <span className="font-bold text-lg text-foreground">Nivra</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_TARGETS.map((target) => (
              target.type === 'route' ? (
                <Link
                  key={target.id}
                  to={target.target}
                  className={`px-3 py-2 text-sm font-medium transition-colors rounded-lg ${
                    location.pathname === target.target 
                      ? 'text-foreground bg-muted' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {getLabel(target)}
                </Link>
              ) : (
                <button
                  key={target.id}
                  onClick={() => handleNavClick(target)}
                  className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors rounded-lg cursor-pointer"
                  type="button"
                >
                  {getLabel(target)}
                </button>
              )
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-2">
            <LanguageSelector />
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" asChild>
              <a href={`tel:+1${supportPhoneTel}`} data-testid="header-phone">
                <Phone className="w-4 h-4" />
                <span className="hidden xl:inline">{supportPhone}</span>
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={portalLink}>
                <User className="w-4 h-4" />
                <span className="hidden xl:inline ml-1.5">{t('nav.portal')}</span>
              </Link>
            </Button>
            <Button variant="accent" size="sm" asChild>
              <Link to="/contact">
                {t('hero.cta.order')}
              </Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 w-10 h-10 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
            type="button"
          >
            {isMenuOpen ? (
              <X className="w-5 h-5 text-foreground" />
            ) : (
              <Menu className="w-5 h-5 text-foreground" />
            )}
          </button>
        </div>

        {/* Mobile Menu - ensure no overlay blocking when closed */}
        {isMenuOpen && (
          <div 
            className="lg:hidden py-4 border-t border-border animate-fade-in bg-white"
            style={{ pointerEvents: 'auto' }}
          >
            <nav className="flex flex-col gap-1">
              {NAV_TARGETS.map((target) => (
                target.type === 'route' ? (
                  <Link
                    key={target.id}
                    to={target.target}
                    onClick={() => setIsMenuOpen(false)}
                    className={`px-3 py-2.5 text-sm font-medium transition-colors rounded-lg ${
                      location.pathname === target.target 
                        ? 'text-foreground bg-muted' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    {getLabel(target)}
                  </Link>
                ) : (
                  <button
                    key={target.id}
                    onClick={() => handleNavClick(target)}
                    className="px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors rounded-lg text-left"
                    type="button"
                  >
                    {getLabel(target)}
                  </button>
                )
              ))}
              <div className="pt-4 mt-2 border-t border-border flex flex-col gap-2">
                <LanguageSelector />
                <Button variant="ghost" size="sm" className="justify-start gap-2" asChild>
                  <a href={`tel:+1${supportPhoneTel}`}>
                    <Phone className="w-4 h-4" />
                    <span>{supportPhone}</span>
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="justify-start" asChild>
                  <Link to={portalLink}>
                    <User className="w-4 h-4 mr-2" />
                    {t('nav.portal')}
                  </Link>
                </Button>
                <Button variant="accent" size="sm" asChild>
                  <Link to="/contact">
                    {t('hero.cta.order')}
                  </Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
    </>
  );
};

export default Header;