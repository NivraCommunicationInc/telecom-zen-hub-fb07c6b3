/**
 * CreerMotDePasse — Password creation page for new guest checkout accounts.
 * Reached via the recovery link sent after auto-account creation.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function CreerMotDePasse() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const isValid = password.length >= 8 && password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Minimum 8 caractères");
      return;
    }
    if (password !== confirm) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setDone(true);
    toast.success("Mot de passe créé avec succès!");
    setTimeout(() => navigate("/portal"), 2500);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-[420px] border-border shadow-lg">
        <CardContent className="p-8 sm:p-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
              Créez votre mot de passe
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Choisissez un mot de passe pour accéder à votre espace client Nivra Telecom.
            </p>
          </div>

          {done ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
              <p className="text-base font-semibold text-foreground">
                Mot de passe créé!
              </p>
              <p className="text-sm text-muted-foreground">
                Redirection vers votre espace client...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password" className="text-sm text-muted-foreground">
                  Nouveau mot de passe
                </Label>
                <div className="relative mt-1.5">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 caractères"
                    className="h-12 text-base pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirm" className="text-sm text-muted-foreground">
                  Confirmer le mot de passe
                </Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Répétez votre mot de passe"
                  className="h-12 text-base mt-1.5"
                />
              </div>

              {password.length > 0 && password.length < 8 && (
                <p className="text-xs text-destructive">
                  Le mot de passe doit contenir au moins 8 caractères
                </p>
              )}
              {confirm.length > 0 && password !== confirm && (
                <p className="text-xs text-destructive">
                  Les mots de passe ne correspondent pas
                </p>
              )}

              <Button
                type="submit"
                disabled={!isValid || loading}
                className="w-full h-12 text-base font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  "Accéder à mon espace client →"
                )}
              </Button>
            </form>
          )}

          <p className="text-center mt-6 text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" />
            Connexion sécurisée SSL 256-bit
          </p>
        </CardContent>
      </Card>
    </div>
  );
}