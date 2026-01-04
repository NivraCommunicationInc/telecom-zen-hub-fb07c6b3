import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone, User } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "./LanguageSelector";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  const navLinks = [
    { label: t('nav.services'), href: "/services", isPage: true },
    { label: "Internet", href: "/internet", isPage: true },
    { label: "TV", href: "/tv", isPage: true },
    { label: "Mobile", href: "/mobile", isPage: true },
    { label: t('nav.about'), href: "/about", isPage: true },
  ];

  const portalLink = user ? "/portal" : "/portal/auth";

  // Track scroll for header styling
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    setIsMenuOpen(false);
    
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    } else {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  useEffect(() => {
    if (location.hash) {
      const sectionId = location.hash.replace("#", "");
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  }, [location]);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
      isScrolled 
        ? 'bg-white/98 backdrop-blur-sm border-b border-border shadow-sm' 
        : 'bg-white/95 backdrop-blur-sm border-b border-border/50'
    }`}>
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center justify-between h-16 lg:h-18">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
              <span className="font-bold text-white text-lg">N</span>
            </div>
            <span className="font-bold text-lg text-foreground">Nivra</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              link.isPage ? (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`px-3 py-2 text-sm font-medium transition-colors rounded-lg ${
                    location.pathname === link.href 
                      ? 'text-foreground bg-muted' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {link.label}
                </Link>
              ) : (
                <button
                  key={link.href}
                  onClick={() => scrollToSection(link.href)}
                  className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors rounded-lg cursor-pointer"
                >
                  {link.label}
                </button>
              )
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-2">
            <LanguageSelector />
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" asChild>
              <a href="tel:+15145442233">
                <Phone className="w-4 h-4" />
                <span className="hidden xl:inline">514-544-2233</span>
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={portalLink}>
                <User className="w-4 h-4" />
                <span className="hidden xl:inline ml-1.5">{t('nav.portal')}</span>
              </Link>
            </Button>
            <Button variant="accent" size="sm" onClick={() => scrollToSection('contact')}>
              {t('hero.cta.order')}
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="w-5 h-5 text-foreground" />
            ) : (
              <Menu className="w-5 h-5 text-foreground" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden py-4 border-t border-border animate-fade-in">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                link.isPage ? (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={`px-3 py-2.5 text-sm font-medium transition-colors rounded-lg ${
                      location.pathname === link.href 
                        ? 'text-foreground bg-muted' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    {link.label}
                  </Link>
                ) : (
                  <button
                    key={link.href}
                    onClick={() => scrollToSection(link.href)}
                    className="px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors rounded-lg text-left"
                  >
                    {link.label}
                  </button>
                )
              ))}
              <div className="pt-4 mt-2 border-t border-border flex flex-col gap-2">
                <LanguageSelector />
                <Button variant="ghost" size="sm" className="justify-start gap-2" asChild>
                  <a href="tel:+15145442233">
                    <Phone className="w-4 h-4" />
                    <span>514-544-2233</span>
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="justify-start" asChild>
                  <Link to={portalLink}>
                    <User className="w-4 h-4 mr-2" />
                    {t('nav.portal')}
                  </Link>
                </Button>
                <Button variant="accent" size="sm" onClick={() => scrollToSection('contact')}>
                  {t('hero.cta.order')}
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;