/**
 * ClientLanguagePreference - Language preference selector
 * Saves FR/EN preference to profile
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Loader2, CheckCircle2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { toast } from "sonner";

interface ClientLanguagePreferenceProps {
  userId: string;
}

type Language = "fr" | "en";

const languages: { code: Language; label: string; flag: string }[] = [
  { code: "fr", label: "Français", flag: "🇨🇦" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

const ClientLanguagePreference = ({ userId }: ClientLanguagePreferenceProps) => {
  const queryClient = useQueryClient();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("fr");

  // Fetch current preference
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-language", userId],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("profiles")
        .select("preferred_language")
        .eq("user_id", userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (profile?.preferred_language) {
      setSelectedLanguage(profile.preferred_language as Language);
    }
  }, [profile]);

  // Save preference
  const saveMutation = useMutation({
    mutationFn: async (language: Language) => {
      const { error } = await portalSupabase
        .from("profiles")
        .update({ preferred_language: language })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: (_, language) => {
      queryClient.invalidateQueries({ queryKey: ["profile-language"] });
      queryClient.invalidateQueries({ queryKey: ["client-profile"] });
      toast.success(
        language === "fr" 
          ? "Langue préférée enregistrée: Français" 
          : "Preferred language saved: English"
      );
    },
    onError: () => {
      toast.error("Erreur lors de l'enregistrement");
    },
  });

  const handleLanguageChange = (language: Language) => {
    setSelectedLanguage(language);
    saveMutation.mutate(language);
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-cyan-400" />
          Langue préférée
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3">
          {languages.map((lang) => (
            <Button
              key={lang.code}
              variant={selectedLanguage === lang.code ? "default" : "outline"}
              className={`flex-1 h-auto py-4 flex flex-col gap-2 ${
                selectedLanguage === lang.code 
                  ? "bg-cyan-500 hover:bg-cyan-600 border-cyan-500" 
                  : "hover:border-cyan-500/50"
              }`}
              onClick={() => handleLanguageChange(lang.code)}
              disabled={saveMutation.isPending}
            >
              <span className="text-2xl">{lang.flag}</span>
              <span className="font-medium">{lang.label}</span>
              {selectedLanguage === lang.code && (
                <Badge className="bg-white/20 text-white text-xs">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Actif
                </Badge>
              )}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-4">
          Cette préférence sera utilisée pour les communications et l'interface du portail.
        </p>
      </CardContent>
    </Card>
  );
};

export default ClientLanguagePreference;
