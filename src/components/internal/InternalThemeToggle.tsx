import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type InternalTheme, useInternalTheme } from "@/hooks/useInternalTheme";

interface InternalThemeToggleProps {
  className?: string;
  theme?: InternalTheme;
  onToggle?: () => void;
}

export default function InternalThemeToggle({ className, theme, onToggle }: InternalThemeToggleProps) {
  const internalTheme = useInternalTheme();
  const resolvedTheme = theme ?? internalTheme.theme;
  const handleToggle = onToggle ?? internalTheme.toggleTheme;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleToggle}
      className={cn(
        "h-8 gap-1.5 border-border bg-card text-foreground hover:bg-secondary",
        className
      )}
      aria-label={resolvedTheme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
    >
      {resolvedTheme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      <span className="text-xs font-medium">{resolvedTheme === "dark" ? "Clair" : "Sombre"}</span>
    </Button>
  );
}
