import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Wrench, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

type StaffRole = "admin" | "employee" | "technician";

const ROLE_CONFIG: Record<StaffRole, { icon: React.ElementType; label: string; description: string; color: string }> = {
  admin: {
    icon: Shield,
    label: "Administrateur",
    description: "Accès complet au système",
    color: "from-red-500 to-red-600",
  },
  employee: {
    icon: Users,
    label: "Employé",
    description: "Service client et commandes",
    color: "from-blue-500 to-blue-600",
  },
  technician: {
    icon: Wrench,
    label: "Technicien",
    description: "Rendez-vous et installations",
    color: "from-green-500 to-green-600",
  },
};

const loginSchema = z.object({
  email: z.string().email("Adresse courriel invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

export default function StaffLogin() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<StaffRole | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // Check if already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Check if user has any staff role
        const { data: roles } = await supabase.rpc("get_user_staff_roles", {
          _user_id: session.user.id,
        });
        
        if (roles && roles.length > 0) {
          // Redirect to role selection if multiple roles, or directly to dashboard
          if (roles.length === 1) {
            // Admin portal uses the dedicated /admin flow (secret code, tighter security)
            if (roles[0] === "admin") {
              navigate("/admin/login", { replace: true });
            } else {
              navigate(`/staff/${roles[0]}`);
            }
          } else {
            setChecking(false);
          }
        } else {
          setChecking(false);
        }
      } else {
        setChecking(false);
      }
    };
    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate inputs
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0] === "email") fieldErrors.email = err.message;
        if (err.path[0] === "password") fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (!selectedRole) {
      toast.error("Veuillez sélectionner un rôle");
      return;
    }

    // IMPORTANT: Admin portal uses the dedicated /admin login + secret code flow.
    // Staff app should not try to render admin UI under /staff/admin (it causes a blank page
    // because the admin UI expects the admin auth provider + secret code session).
    if (selectedRole === "admin") {
      navigate("/admin/login", { replace: true });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Identifiants incorrects");
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("Veuillez confirmer votre courriel");
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (!data.user) {
        toast.error("Erreur de connexion");
        return;
      }

      // Check if user has the selected role
      const { data: hasRole } = await supabase.rpc("has_staff_role", {
        _user_id: data.user.id,
        _role: selectedRole,
      });

      if (!hasRole) {
        await supabase.auth.signOut();
        toast.error(`Vous n'avez pas le rôle ${ROLE_CONFIG[selectedRole].label}`);
        return;
      }

      toast.success(`Bienvenue, ${ROLE_CONFIG[selectedRole].label}!`);
      navigate(`/staff/${selectedRole}`);
    } catch (err) {
      console.error("Login error:", err);
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and Title */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">Nivra Telecom</h1>
          <p className="text-slate-400">Portail du personnel</p>
        </div>

        {/* Role Selection */}
        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-lg">Sélectionnez votre rôle</CardTitle>
            <CardDescription className="text-slate-400">
              Choisissez le rôle avec lequel vous souhaitez vous connecter
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(Object.keys(ROLE_CONFIG) as StaffRole[]).map((role) => {
              const config = ROLE_CONFIG[role];
              const Icon = config.icon;
              const isSelected = selectedRole === role;

              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSelectedRole(role)}
                  className={`w-full p-4 rounded-lg border-2 transition-all duration-200 flex items-center gap-4 ${
                    isSelected
                      ? `border-white bg-gradient-to-r ${config.color} text-white`
                      : "border-slate-600 bg-slate-700/50 text-slate-300 hover:border-slate-500 hover:bg-slate-700"
                  }`}
                >
                  <div className={`p-2 rounded-lg ${isSelected ? "bg-white/20" : "bg-slate-600"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-medium">{config.label}</div>
                    <div className={`text-sm ${isSelected ? "text-white/80" : "text-slate-400"}`}>
                      {config.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Login Form */}
        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-lg">Connexion</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">
                  Courriel
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@nivra.ca"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                  disabled={loading}
                />
                {errors.email && (
                  <p className="text-red-400 text-sm flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">
                  Mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 pr-10"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-400 text-sm flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.password}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                disabled={loading || !selectedRole}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  "Se connecter"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-slate-500 text-sm">
          © {new Date().getFullYear()} Nivra Telecom. Réservé au personnel autorisé.
        </p>
      </div>
    </div>
  );
}
