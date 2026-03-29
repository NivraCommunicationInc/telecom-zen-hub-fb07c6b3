import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, MapPin, Shield, AlertTriangle } from "lucide-react";

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Temps plein",
  part_time: "Temps partiel",
  contract: "Contractuel",
};

const SALARY_TYPE_LABELS: Record<string, string> = {
  hourly: "Horaire",
  fixed: "Fixe",
  commission: "Commission uniquement",
};

type Props = { profile: any };

export default function Employee360Profile({ profile }: Props) {
  const fields = [
    { label: "Nom complet", value: profile.full_name },
    { label: "Email", value: profile.email, icon: Mail },
    { label: "Téléphone", value: profile.phone, icon: Phone },
    { label: "Poste", value: profile.job_title },
    { label: "Département", value: profile.department },
    { label: "No. employé", value: profile.employee_number },
    { label: "Type d'emploi", value: EMPLOYMENT_LABELS[profile.employment_type] || profile.employment_type },
    { label: "Type de rémunération", value: SALARY_TYPE_LABELS[profile.salary_type] || profile.salary_type },
    { label: "Langue préférée", value: profile.preferred_language === "fr" ? "Français" : profile.preferred_language === "en" ? "English" : profile.preferred_language },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Informations personnelles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Informations personnelles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center justify-between">
              <span className="text-muted-foreground">{f.label}</span>
              <span className="text-foreground">{f.value || "—"}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Contact d'urgence */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Contact d'urgence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Nom</span>
            <span className="text-foreground">{profile.emergency_contact_name || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Téléphone</span>
            <span className="text-foreground">{profile.emergency_contact_phone || "—"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Adresse */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Adresse de service
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-foreground">
          {profile.service_address ? (
            <div>
              <p>{profile.service_address}</p>
              <p>{[profile.service_city, profile.service_province, profile.service_postal_code].filter(Boolean).join(", ")}</p>
            </div>
          ) : (
            <p className="text-muted-foreground">—</p>
          )}
        </CardContent>
      </Card>

      {/* Sécurité */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Sécurité
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">MFA</span>
            <Badge variant={profile.mfa_enabled ? "default" : "secondary"}>{profile.mfa_enabled ? "Activé" : "Désactivé"}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Statut sécurité</span>
            <Badge variant={profile.security_status === "clear" ? "default" : "destructive"}>{profile.security_status}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Accès en ligne</span>
            <span className="text-foreground">{profile.online_access_status || "—"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
