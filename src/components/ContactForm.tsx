import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, CheckCircle, User, Mail, Phone } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(100, "Le nom est trop long"),
  email: z.string().trim().email("Adresse courriel invalide").max(255, "Courriel trop long"),
  phone: z.string().trim().min(10, "Numéro de téléphone invalide").max(20, "Numéro trop long"),
});

const ContactForm = () => {
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = contactSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    
    const { error } = await supabase.from("contact_requests").insert({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
    });
    
    setIsLoading(false);
    
    if (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue. Veuillez réessayer.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitted(true);
    toast({
      title: "Demande envoyée!",
      description: "Nous vous contacterons dans les 24 heures.",
    });
  };

  if (isSubmitted) {
    return (
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 md:p-10 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-cyan-500/20 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-cyan-400" />
        </div>
        <h3 className="font-display text-2xl font-bold text-primary-foreground mb-3">
          Merci pour votre demande!
        </h3>
        <p className="text-cyan-100/70">
          Un de nos experts vous contactera dans les 24 heures pour planifier votre consultation gratuite.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 md:p-10">
      <h3 className="font-display text-xl md:text-2xl font-bold text-primary-foreground mb-6 text-center">
        Demandez votre consultation gratuite
      </h3>
      
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-cyan-100/80 flex items-center gap-2">
            <User className="w-4 h-4" />
            Nom complet
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="Jean Tremblay"
            value={formData.name}
            onChange={handleChange}
            className="bg-background/50 border-border/50 text-primary-foreground placeholder:text-muted-foreground focus:border-cyan-400 h-12"
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-cyan-100/80 flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Adresse courriel
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="jean@exemple.com"
            value={formData.email}
            onChange={handleChange}
            className="bg-background/50 border-border/50 text-primary-foreground placeholder:text-muted-foreground focus:border-cyan-400 h-12"
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-cyan-100/80 flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Téléphone
          </Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="(514) 555-0123"
            value={formData.phone}
            onChange={handleChange}
            className="bg-background/50 border-border/50 text-primary-foreground placeholder:text-muted-foreground focus:border-cyan-400 h-12"
          />
          {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
        </div>

        <Button 
          type="submit" 
          variant="hero" 
          size="lg" 
          className="w-full group"
          disabled={isLoading}
        >
          {isLoading ? "Envoi en cours..." : "Réserver ma consultation"}
          {!isLoading && <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />}
        </Button>

        <p className="text-xs text-center text-cyan-100/50">
          En soumettant ce formulaire, vous acceptez d'être contacté par Nivra concernant nos services.
        </p>
      </div>
    </form>
  );
};

export default ContactForm;
