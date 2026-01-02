import { useState, useEffect, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { ChevronUp } from "lucide-react";

interface BackToTopButtonProps {
  scrollContainerRef?: RefObject<HTMLElement>;
  threshold?: number;
}

const BackToTopButton = ({ 
  scrollContainerRef, 
  threshold = 200 
}: BackToTopButtonProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const container = scrollContainerRef?.current || window;
    
    const handleScroll = () => {
      if (scrollContainerRef?.current) {
        setIsVisible(scrollContainerRef.current.scrollTop > threshold);
      } else {
        setIsVisible(window.scrollY > threshold);
      }
    };

    if (scrollContainerRef?.current) {
      scrollContainerRef.current.addEventListener("scroll", handleScroll);
    } else {
      window.addEventListener("scroll", handleScroll);
    }

    return () => {
      if (scrollContainerRef?.current) {
        scrollContainerRef.current.removeEventListener("scroll", handleScroll);
      } else {
        window.removeEventListener("scroll", handleScroll);
      }
    };
  }, [scrollContainerRef, threshold]);

  const scrollToTop = () => {
    if (scrollContainerRef?.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (!isVisible) return null;

  return (
    <Button
      variant="secondary"
      size="icon"
      className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg animate-fade-in h-10 w-10 hover:scale-110 transition-transform"
      onClick={scrollToTop}
      aria-label="Retour en haut"
    >
      <ChevronUp className="w-5 h-5" />
    </Button>
  );
};

export default BackToTopButton;
