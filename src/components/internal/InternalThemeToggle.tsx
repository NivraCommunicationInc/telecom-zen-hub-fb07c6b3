import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useInternalTheme } from "@/hooks/useInternalTheme";

interface InternalThemeToggleProps {
  className?: string;
}

export default function InternalThemeToggle({ className }: InternalThemeToggleProps) {
  const { theme, toggleTheme } = useInternalTheme();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      className={cn(
        "h-8 gap-1.5 border-border bg-card text-foreground hover:bg-secondary",
        className
      )}
      aria-label={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
    >
      {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      <span className="text-xs font-medium">{theme === "dark" ? "Clair" : "Sombre"}</span>
    </Button>
  );
}
