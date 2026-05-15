/**
 * HrProfile — Employee profile + Sécurité (2FA TOTP, mot de passe, sessions, contact).
 */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  User, Loader2, Mail, Phone, Briefcase, MapPin, Shield, Key, Smartphone, LogOut,
  CheckCircle2, AlertTriangle, Save,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

export default function HrProfile() {
  const qc = useQueryClient();

  // ─── Profile ───
  const { data: profile, isLoading } = useQuery({
    queryKey: ["rh-my-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      return data;
    },
  });

  const { data: roleData } = useQuery({
    queryKey: ["rh-my-role"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role, status, is_active, onboarding_completed_at")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
  });

  // ─── Editable contact ───
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  useEffect(() => {
    if (profile) {
      setPhone(profile.phone ?? "");
      setAddress(profile.address ?? "");
    }
  }, [profile]);

  const saveContactMut = useMutation({
    mutationFn: async () => {
      if (!profile?.user_id) throw new Error("Profil introuvable");
      const { error } = await supabase
        .from("profiles")
        .update({ phone: phone.trim() || null, address: address.trim() || null })
        .eq("user_id", profile.user_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coordonnées mises à jour");
      qc.invalidateQueries({ queryKey: ["rh-my-profile"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  // ─── Password change ───
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const pwMut = useMutation({
    mutationFn: async () => {
      if (pw1.length < 8) throw new Error("Au moins 8 caractères");
      if (pw1 !== pw2) throw new Error("Les mots de passe ne correspondent pas");
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mot de passe mis à jour");
      setPw1(""); setPw2("");
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  // ─── 2FA TOTP ───
  const { data: factors, refetch: refetchFactors } = useQuery({
    queryKey: ["rh-mfa-factors"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data;
    },
  });

  const totpFactor = factors?.totp?.[0];
  const has2FA = !!totpFactor && totpFactor.status === "verified";

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [qrSvg, setQrSvg] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [factorId, setFactorId] = useState<string>("");
  const [otp, setOtp] = useState("");

  const startEnroll = async () => {
    try {
      // Clean up any unverified factor first
      if (totpFactor && totpFactor.status !== "verified") {
        await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "Nivra Hub Secure",
        friendlyName: "Nivra Hub Secure",
      });
      if (error) throw error;
      setFactorId(data.id);
      setSecret(data.totp.secret);
      const svg = await QRCode.toString(data.totp.uri, { type: "svg", margin: 1, width: 220 });
      setQrSvg(svg);
      setEnrollOpen(true);
    } catch (e: any) {
      toast.error(e.message || "Impossible de démarrer la configuration 2FA");
    }
  };

  const verifyEnroll = async () => {
    try {
      const { error: ve } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: otp.trim(),
      });
      if (ve) throw ve;
      toast.success("2FA activée");
      setEnrollOpen(false);
      setOtp(""); setSecret(""); setQrSvg(""); setFactorId("");
      refetchFactors();
    } catch (e: any) {
      toast.error(e.message || "Code invalide");
    }
  };

  const disable2FA = async () => {
    if (!totpFactor) return;
    if (!confirm("Désactiver l'authentification à deux facteurs ?")) return;
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
      if (error) throw error;
      toast.success("2FA désactivée");
      refetchFactors();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  // ─── Sessions ───
  const signOutEverywhere = async () => {
    if (!confirm("Se déconnecter de tous les appareils ?")) return;
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      toast.success("Déconnecté de tous les appareils");
      window.location.href = "/auth";
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const fields = [
    { icon: Mail, label: "Courriel", value: profile?.email },
    { icon: Phone, label: "Téléphone", value: profile?.phone },
    { icon: Briefcase, label: "Poste", value: profile?.job_title },
    { icon: MapPin, label: "Adresse", value: profile?.address },
    { icon: User, label: "Numéro d'agent", value: profile?.agent_number || "En cours d'attribution", readOnly: true },
    { icon: User, label: "Badge", value: profile?.agent_number || "En cours d'attribution", readOnly: true },
    { icon: Mail, label: "Courriel professionnel", value: profile?.professional_email ? `${profile.professional_email} (à venir)` : "À venir", readOnly: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <User className="h-6 w-6 text-violet-600" />
          Mon profil employé
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Informations personnelles, sécurité et préférences
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="h-3.5 w-3.5" /> Profil
          </TabsTrigger>
          <TabsTrigger value="contact" className="gap-1.5">
            <Phone className="h-3.5 w-3.5" /> Coordonnées
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Sécurité
            {!has2FA && (
              <Badge variant="destructive" className="ml-1 h-4 px-1.5 text-[10px]">!</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── Profil ─── */}
        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {profile?.first_name} {profile?.last_name}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Rôle : <span className="font-medium">{roleData?.role || "—"}</span>{" · "}
                Statut : <Badge variant={roleData?.is_active ? "default" : "secondary"}>{roleData?.status || "—"}</Badge>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((f) => (
                <div key={f.label} className="flex items-center gap-3">
                  <f.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{f.label}</p>
                    <p className="text-sm font-medium text-foreground">{f.value || "—"}</p>
                  </div>
                </div>
              ))}
              <Separator />
              <p className="text-xs text-muted-foreground">
                Pour modifier votre prénom, nom ou poste, contactez HR via une demande.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Coordonnées éditables ─── */}
        <TabsContent value="contact" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mes coordonnées</CardTitle>
              <p className="text-xs text-muted-foreground">
                Téléphone et adresse postale — utilisés pour vos documents officiels et communications RH.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Téléphone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="(514) 555-1234" />
              </div>
              <div>
                <Label>Adresse postale</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Rue, Ville, QC H0H 0H0" />
              </div>
              <Button onClick={() => saveContactMut.mutate()} disabled={saveContactMut.isPending} className="gap-1.5">
                {saveContactMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Sécurité ─── */}
        <TabsContent value="security" className="mt-4 space-y-4">
          {/* 2FA */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-violet-600" />
                Authentification à deux facteurs (2FA)
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Ajoute une couche de sécurité supplémentaire avec Google Authenticator, Authy ou 1Password.
              </p>
            </CardHeader>
            <CardContent>
              {has2FA ? (
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="font-medium">Activée</span>
                    <Badge variant="outline" className="text-[10px]">{totpFactor.friendly_name ?? "TOTP"}</Badge>
                  </div>
                  <Button size="sm" variant="outline" onClick={disable2FA}>Désactiver</Button>
                </div>
              ) : (
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-muted-foreground">Non activée — votre compte est moins protégé</span>
                  </div>
                  <Button size="sm" onClick={startEnroll} className="gap-1.5">
                    <Shield className="h-4 w-4" /> Activer la 2FA
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mot de passe */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4 text-violet-600" />
                Changer le mot de passe
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Au moins 8 caractères. Évitez les mots de passe réutilisés.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Nouveau mot de passe</Label>
                <Input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)}
                  autoComplete="new-password" />
              </div>
              <div>
                <Label>Confirmer</Label>
                <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)}
                  autoComplete="new-password" />
              </div>
              <Button onClick={() => pwMut.mutate()} disabled={pwMut.isPending || !pw1 || !pw2} className="gap-1.5">
                {pwMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                Mettre à jour
              </Button>
            </CardContent>
          </Card>

          {/* Sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <LogOut className="h-4 w-4 text-violet-600" />
                Sessions actives
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Si vous avez perdu un appareil ou si vous suspectez un accès non autorisé, déconnectez-vous partout.
              </p>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={signOutEverywhere} className="gap-1.5">
                <LogOut className="h-4 w-4" /> Se déconnecter de tous les appareils
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── 2FA Enroll dialog ─── */}
      <Dialog open={enrollOpen} onOpenChange={(o) => {
        if (!o && factorId) {
          // Cancel: clean up unverified factor
          supabase.auth.mfa.unenroll({ factorId }).catch(() => {});
        }
        setEnrollOpen(o);
        if (!o) { setOtp(""); setSecret(""); setQrSvg(""); setFactorId(""); refetchFactors(); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurer la 2FA</DialogTitle>
            <DialogDescription>
              1) Scannez le code QR avec votre application d'authentification.
              2) Entrez le code à 6 chiffres pour confirmer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {qrSvg && (
              <div className="flex justify-center bg-white p-4 rounded border"
                dangerouslySetInnerHTML={{ __html: qrSvg }} />
            )}
            {secret && (
              <div>
                <Label className="text-xs">Clé secrète (au cas où le QR ne fonctionne pas)</Label>
                <Input readOnly value={secret} className="font-mono text-xs" />
              </div>
            )}
            <div>
              <Label>Code à 6 chiffres</Label>
              <Input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456" inputMode="numeric" maxLength={6}
                className="text-center text-lg font-mono tracking-widest" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollOpen(false)}>Annuler</Button>
            <Button onClick={verifyEnroll} disabled={otp.length !== 6}>
              Activer la 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
