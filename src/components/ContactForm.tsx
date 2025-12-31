import { useState, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, CheckCircle, User, Mail, Phone, MessageSquare } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

const ContactForm = forwardRef<HTMLFormElement>((_, ref) => {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const contactSchema = z.object({
    name: z.string().trim().min(1, language === 'fr' ? "Nom requis" : "Name required").max(100),
    email: z.string().trim().email(language === 'fr' ? "Courriel invalide" : "Invalid email").max(255),
    phone: z.string().trim().min(10, language === 'fr' ? "Téléphone invalide" : "Invalid phone").max(20),
    message: z.string().trim().max(1000).optional(),
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
      notes: formData.message || null,
    });
    
    setIsLoading(false);
    
    if (error) {
      toast({
        title: t('common.error'),
        description: t('common.error'),
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitted(true);
    toast({
      title: t('contact.success.title'),
      description: t('contact.success.text'),
    });
  };

  if (isSubmitted) {
    return (
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 md:p-10 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-cyan-500/20 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-cyan-400" />
        </div>
        <h3 className="font-display text-2xl font-bold text-primary-foreground mb-3">
          {t('contact.success.title')}
        </h3>
        <p className="text-cyan-100/70">
          {t('contact.success.text')}
        </p>
      </div>
    );
  }

  return (
    <form ref={ref} onSubmit={handleSubmit} className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 md:p-10">
      <h3 className="font-display text-xl md:text-2xl font-bold text-primary-foreground mb-6 text-center">
        {t('contact.title')}
      </h3>
      
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-cyan-100/80 flex items-center gap-2">
            <User className="w-4 h-4" />
            {language === 'fr' ? "Nom complet" : "Full Name"}
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder={language === 'fr' ? "Votre nom" : "Your name"}
            value={formData.name}
            onChange={handleChange}
            className="bg-background/50 border-border/50 text-primary-foreground placeholder:text-muted-foreground focus:border-cyan-400 h-12"
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-cyan-100/80 flex items-center gap-2">
            <Mail className="w-4 h-4" />
            {language === 'fr' ? "Courriel" : "Email"}
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="votre@courriel.com"
            value={formData.email}
            onChange={handleChange}
            className="bg-background/50 border-border/50 text-primary-foreground placeholder:text-muted-foreground focus:border-cyan-400 h-12"
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-cyan-100/80 flex items-center gap-2">
            <Phone className="w-4 h-4" />
            {language === 'fr' ? "Téléphone" : "Phone"}
          </Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder={t('contact.phone.placeholder')}
            value={formData.phone}
            onChange={handleChange}
            className="bg-background/50 border-border/50 text-primary-foreground placeholder:text-muted-foreground focus:border-cyan-400 h-12"
          />
          {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="message" className="text-cyan-100/80 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            {language === 'fr' ? "Commentaire / Message" : "Comment / Message"}
          </Label>
          <Textarea
            id="message"
            name="message"
            placeholder={language === 'fr' ? "Écrivez votre message ici..." : "Write your message here..."}
            value={formData.message}
            onChange={handleChange}
            rows={4}
            className="bg-background/50 border-border/50 text-primary-foreground placeholder:text-muted-foreground focus:border-cyan-400 resize-none"
          />
          {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
        </div>

        <Button 
          type="submit" 
          variant="hero" 
          size="lg" 
          className="w-full group"
          disabled={isLoading}
        >
          {isLoading ? t('contact.sending') : t('contact.submit')}
          {!isLoading && <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />}
        </Button>

        <p className="text-xs text-center text-cyan-100/50">
          {t('contact.subtitle')}
        </p>
      </div>
    </form>
  );
});

ContactForm.displayName = "ContactForm";

export default ContactForm;