import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ArrowRight } from "lucide-react";

const AdminUsers = () => {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Utilisateurs & Rôles</h1>
          <p className="text-muted-foreground">Cette section a été centralisée</p>
        </div>

        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground">Gestion centralisée</h3>
                <p className="text-muted-foreground mt-2 max-w-md">
                  La gestion des utilisateurs est maintenant centralisée dans la section 
                  "Utilisateurs & Accès" pour une meilleure organisation.
                </p>
              </div>
              <Button asChild size="lg" className="mt-4">
                <Link to="/admin/users-access">
                  Ouvrir Utilisateurs & Accès
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;
