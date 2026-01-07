import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Mail, User, Key, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { adminClient as supabase } from "@/integrations/backend";

const bootstrapSchema = z.object({
  email: z.string().email("Adresse courriel invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  fullName: z.string().min(1, "Le nom est requis"),
  bootstrapToken: z.string().min(1, "Le jeton bootstrap est requis"),
});

const AdminBootstrap = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check if bootstrap is still available
  useEffect(() => {
    const checkBootstrapStatus = async () => {
      try {
        const { data: existingAdmins } = await supabase
          .from("user_roles")
          .select("id")
          .eq("role", "admin")
          .limit(1);

        if (existingAdmins && existingAdmins.length > 0) {
          setIsDisabled(true);
        }
      } catch (error) {
        console.error("Error checking bootstrap status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkBootstrapStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = bootstrapSchema.safeParse({ email, password, fullName, bootstrapToken });
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

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("admin-bootstrap", {
        body: {
          email,
          password,
          full_name: fullName,
          bootstrap_token: bootstrapToken,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.disabled) {
        setIsDisabled(true);
        toast({
          title: "Bootstrap désactivé",
          description: "Un administrateur existe déjà.",
          variant: "destructive",
        });
        return;
      }

      if (data?.error) {
        toast({
          title: "Erreur",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Administrateur créé!",
        description: "Vous pouvez maintenant vous connecter.",
      });

      navigate("/admin/login");
    } catch (error: any) {
      console.error("Bootstrap error:", error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hero">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  if (isDisabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hero p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto rounded-xl bg-gradient-to-br from-red-500 to-red-400 flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-primary-foreground mb-4">
            Bootstrap désactivé
          </h1>
          <p className="text-muted-foreground mb-6">
            Un administrateur existe déjà. Le bootstrap initial n'est plus disponible.
          </p>
          <Link to="/admin/login">
            <Button variant="hero">
              Aller à la connexion
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-hero p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-xl bg-gradient-to-br from-amber-500 to-amber-400 flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-navy-900" />
          </div>
          <h1 className="font-display text-2xl font-bold text-primary-foreground">
            Bootstrap Admin
          </h1>
          <p className="text-muted-foreground mt-2">
            Créez le premier compte administrateur
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-foreground flex items-center gap-2">
                <User className="w-4 h-4" />
                Nom complet
              </Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jean Tremblay"
                className="bg-background/50 border-border/50 text-foreground placeholder:text-muted-foreground focus:border-cyan-400 h-12"
              />
              {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Adresse courriel
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@nivra.ca"
                className="bg-background/50 border-border/50 text-foreground placeholder:text-muted-foreground focus:border-cyan-400 h-12"
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-background/50 border-border/50 text-foreground placeholder:text-muted-foreground focus:border-cyan-400 h-12 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bootstrapToken" className="text-foreground flex items-center gap-2">
                <Key className="w-4 h-4" />
                Jeton Bootstrap
              </Label>
              <div className="relative">
                <Input
                  id="bootstrapToken"
                  type={showToken ? "text" : "password"}
                  value={bootstrapToken}
                  onChange={(e) => setBootstrapToken(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="bg-background/50 border-border/50 text-foreground placeholder:text-muted-foreground focus:border-cyan-400 h-12 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.bootstrapToken && <p className="text-sm text-destructive">{errors.bootstrapToken}</p>}
            </div>

            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Création..." : "Créer l'administrateur"}
            </Button>
          </div>
        </form>

        <p className="text-center text-muted-foreground text-sm mt-6">
          <Link to="/" className="hover:text-cyan-400 transition-colors">
            ← Retour au site
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AdminBootstrap;
