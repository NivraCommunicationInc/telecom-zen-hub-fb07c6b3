import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone, User } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  const navLinks = [
    { label: "Services", href: "services" },
    { label: "Comment ça fonctionne", href: "how-it-works" },
    { label: "Avantages", href: "benefits" },
    { label: "Contact", href: "contact" },
  ];

  // Determine the portal link based on auth status
  const portalLink = user ? "/portal" : "/portal/auth";

  const scrollToSection = (sectionId: string) => {
    setIsMenuOpen(false);
    
    // If we're not on the home page, navigate there first
    if (location.pathname !== "/") {
      navigate("/");
      // Wait for navigation, then scroll
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    } else {
      // Already on home page, just scroll
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  // Handle hash on page load
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
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center">
              <span className="font-display font-bold text-navy-900 text-xl">N</span>
            </div>
            <span className="font-display font-bold text-xl text-foreground">Nivra</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => scrollToSection(link.href)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="sm" className="gap-2" asChild>
              <a href="tel:+14385442233">
                <Phone className="w-4 h-4" />
                <span>438-544-2233</span>
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={portalLink}>
                <User className="w-4 h-4 mr-2" />
                {user ? "Mon espace" : "Espace client"}
              </Link>
            </Button>
            <Button variant="hero" size="sm" asChild>
              <Link to="/book">Consultation gratuite</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6 text-foreground" />
            ) : (
              <Menu className="w-6 h-6 text-foreground" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border animate-fade-in">
            <nav className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={() => scrollToSection(link.href)}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2 text-left"
                >
                  {link.label}
                </button>
              ))}
              <div className="pt-4 border-t border-border flex flex-col gap-3">
                <Button variant="ghost" size="sm" className="justify-start gap-2" asChild>
                  <a href="tel:+14385442233">
                    <Phone className="w-4 h-4" />
                    <span>438-544-2233</span>
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="justify-start" asChild>
                  <Link to={portalLink}>
                    <User className="w-4 h-4 mr-2" />
                    {user ? "Mon espace" : "Espace client"}
                  </Link>
                </Button>
                <Button variant="hero" size="sm" asChild>
                  <Link to="/book">Consultation gratuite</Link>
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