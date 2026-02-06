/**
 * TypedSignatureInput - Signature tapée avec police cursive élégante
 * Le client tape son nom qui s'affiche en style signature manuscrite
 */

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TypedSignatureInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  previewClassName?: string;
  error?: string;
}

// Cursive fonts disponibles (Google Fonts loaded via index.html)
const SIGNATURE_FONTS = [
  "'Dancing Script', cursive",
  "'Great Vibes', cursive",
  "'Pacifico', cursive",
  "'Satisfy', cursive",
  "'Allura', cursive",
];

export function TypedSignatureInput({
  value,
  onChange,
  placeholder = "Tapez votre nom complet",
  label = "Signature",
  required = false,
  disabled = false,
  className,
  previewClassName,
  error,
}: TypedSignatureInputProps) {
  const [selectedFont, setSelectedFont] = useState(0);

  // Cycle through fonts on mount to show variety
  useEffect(() => {
    // Random font selection for variety
    setSelectedFont(Math.floor(Math.random() * SIGNATURE_FONTS.length));
  }, []);

  const signatureStyle = {
    fontFamily: SIGNATURE_FONTS[selectedFont],
    fontSize: "2rem",
    lineHeight: "1.4",
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Input field */}
      <div className="space-y-2">
        {label && (
          <Label htmlFor="signature-input">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <Input
          id="signature-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "text-lg",
            error && "border-destructive focus-visible:ring-destructive"
          )}
          autoComplete="name"
          maxLength={100}
        />
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>

      {/* Signature preview */}
      {value && (
        <div
          className={cn(
            "relative border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 bg-gradient-to-br from-background to-muted/30",
            previewClassName
          )}
        >
          {/* Signature line */}
          <div className="absolute bottom-8 left-8 right-8 border-b border-muted-foreground/40" />
          
          {/* Signature text */}
          <div
            className="text-foreground text-center pb-2 select-none"
            style={signatureStyle}
          >
            {value}
          </div>
          
          {/* Label below line */}
          <p className="text-xs text-muted-foreground text-center mt-4">
            Signature du client
          </p>
          
          {/* Font selector */}
          <div className="absolute top-2 right-2 flex gap-1">
            {SIGNATURE_FONTS.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setSelectedFont(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  selectedFont === index
                    ? "bg-primary"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
                title={`Style ${index + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Legal notice */}
      <p className="text-xs text-muted-foreground">
        En tapant votre nom ci-dessus, vous confirmez que cette signature électronique 
        a la même valeur juridique qu'une signature manuscrite conformément à la 
        Loi concernant le cadre juridique des technologies de l'information (L.R.Q., c. C-1.1).
      </p>
    </div>
  );
}

export default TypedSignatureInput;
