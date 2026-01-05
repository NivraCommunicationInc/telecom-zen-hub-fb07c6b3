import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Users, Wrench, Lock } from "lucide-react";

const MembersAccess = () => {
  useEffect(() => {
    // Add noindex meta tag dynamically
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Accès Membres</CardTitle>
          <CardDescription>
            Portails internes Nivra - Accès réservé au personnel autorisé
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link to="/admin/login" className="block">
            <Button variant="outline" className="w-full justify-start gap-3 h-14">
              <Shield className="h-5 w-5 text-primary" />
              <div className="text-left">
                <div className="font-medium">Portail Administrateur</div>
                <div className="text-xs text-muted-foreground">Gestion complète du système</div>
              </div>
            </Button>
          </Link>
          
          <Link to="/staff/login" className="block">
            <Button variant="outline" className="w-full justify-start gap-3 h-14">
              <Users className="h-5 w-5 text-blue-600" />
              <div className="text-left">
                <div className="font-medium">Portail Employés</div>
                <div className="text-xs text-muted-foreground">Accès équipe interne</div>
              </div>
            </Button>
          </Link>
          
          <Link to="/technician/login" className="block">
            <Button variant="outline" className="w-full justify-start gap-3 h-14">
              <Wrench className="h-5 w-5 text-orange-600" />
              <div className="text-left">
                <div className="font-medium">Portail Technicien</div>
                <div className="text-xs text-muted-foreground">Ordres de travail et installations</div>
              </div>
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default MembersAccess;
