/**
 * RepresentativesTable - Professional table for managing field sales representatives
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { adminClient as adminSupabase } from "@/integrations/backend/adminClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Search,
  Phone,
  Package,
  CheckCircle,
  Clock,
  Ban,
  MoreHorizontal,
  Eye,
  KeyRound,
  UserPlus,
  Mail,
  MapPin,
  TrendingUp,
} from "lucide-react";

interface Representative {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  territory?: string | null;
  is_active: boolean;
  status: string;
  onboarding_completed_at: string | null;
  terms_accepted_at: string | null;
  staff_pin_hash: string | null;
  last_login_at: string | null;
  created_at: string;
  total_sales: number;
  total_commission: number;
  pending_sales: number;
}

interface RepresentativesTableProps {
  representatives: Representative[] | undefined;
  isLoading: boolean;
  onViewDetails: (rep: Representative) => void;
  onCreateNew: () => void;
}

export function RepresentativesTable({
  representatives,
  isLoading,
  onViewDetails,
  onCreateNew,
}: RepresentativesTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ userId, newStatus }: { userId: string; newStatus: boolean }) => {
      const { error } = await adminSupabase
        .from("user_roles")
        .update({
          is_active: newStatus,
          status: newStatus ? "active" : "disabled",
        })
        .eq("user_id", userId)
        .eq("role", "field_sales");

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Statut mis à jour" });
      queryClient.invalidateQueries({ queryKey: ["admin-field-sales-reps"] });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Resend invitation mutation
  const resendInvitationMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await adminSupabase.functions.invoke("admin-manage-staff", {
        body: {
          action: "resend_invitation",
          user_id: userId,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Invitation renvoyée" });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Filter representatives
  const filteredReps = representatives?.filter((rep) => {
    const matchesSearch =
      !searchQuery ||
      rep.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rep.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rep.phone?.includes(searchQuery);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && rep.is_active && rep.status === "active") ||
      (statusFilter === "inactive" && (!rep.is_active || rep.status !== "active")) ||
      (statusFilter === "pending" && !rep.onboarding_completed_at);

    return matchesSearch && matchesStatus;
  }) || [];

  return (
    <Card className="border-slate-700 bg-slate-800/50">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-orange-400" />
              Représentants terrain
            </CardTitle>
            <CardDescription>
              Gérer les vendeurs porte-à-porte et leurs permissions
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64 bg-slate-900/50 border-slate-700"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 bg-slate-900/50 border-slate-700">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="inactive">Inactifs</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={onCreateNew}
              className="bg-gradient-to-r from-orange-500 to-amber-400 text-white"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Nouveau
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : filteredReps.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Aucun représentant trouvé</p>
            <p className="text-sm mt-1">
              {searchQuery || statusFilter !== "all"
                ? "Essayez de modifier vos filtres"
                : "Créez votre premier représentant terrain"}
            </p>
            {!searchQuery && statusFilter === "all" && (
              <Button
                onClick={onCreateNew}
                className="mt-4 bg-gradient-to-r from-orange-500 to-amber-400 text-white"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Créer un représentant
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead className="text-slate-400">Représentant</TableHead>
                <TableHead className="text-slate-400">Contact</TableHead>
                <TableHead className="text-slate-400">Statut</TableHead>
                <TableHead className="text-slate-400">Performance</TableHead>
                <TableHead className="text-slate-400">Commissions</TableHead>
                <TableHead className="text-slate-400">Dernière activité</TableHead>
                <TableHead className="text-slate-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReps.map((rep) => {
                const isActive = rep.is_active && rep.status === "active";
                const isOnboarded = !!rep.onboarding_completed_at;

                return (
                  <TableRow
                    key={rep.id}
                    className="border-slate-700 cursor-pointer hover:bg-slate-800/50"
                    onClick={() => onViewDetails(rep)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-white font-bold shadow-lg">
                          {rep.full_name?.charAt(0) || rep.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{rep.full_name || "—"}</p>
                          <p className="text-sm text-slate-400 flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {rep.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {rep.phone && (
                          <div className="flex items-center gap-2 text-slate-300">
                            <Phone className="h-3 w-3 text-slate-500" />
                            {rep.phone}
                          </div>
                        )}
                        {rep.territory && (
                          <div className="flex items-center gap-2 text-slate-400 text-sm">
                            <MapPin className="h-3 w-3" />
                            {rep.territory}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {isActive ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Actif
                        </Badge>
                      ) : !isOnboarded ? (
                        <Badge className="bg-amber-500/20 text-amber-400 border-0">
                          <Clock className="w-3 h-3 mr-1" />
                          Configuration
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <Ban className="w-3 h-3 mr-1" />
                          Inactif
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-slate-500" />
                          <span className="text-white font-bold">{rep.total_sales}</span>
                          <span className="text-slate-500 text-sm">ventes</span>
                        </div>
                        {rep.pending_sales > 0 && (
                          <Badge variant="outline" className="text-amber-400 border-amber-500/50">
                            {rep.pending_sales} sync
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">
                          ${rep.total_commission.toFixed(2)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-400 text-sm">
                        {rep.last_login_at
                          ? format(new Date(rep.last_login_at), "dd MMM HH:mm", { locale: fr })
                          : "Jamais connecté"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                          <DropdownMenuItem
                            onClick={() => onViewDetails(rep)}
                            className="text-white hover:bg-slate-700"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Voir profil complet
                          </DropdownMenuItem>
                          {!isOnboarded && (
                            <DropdownMenuItem
                              onClick={() => resendInvitationMutation.mutate(rep.user_id)}
                              disabled={resendInvitationMutation.isPending}
                              className="text-white hover:bg-slate-700"
                            >
                              <Mail className="h-4 w-4 mr-2" />
                              Renvoyer invitation
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-white hover:bg-slate-700">
                            <KeyRound className="h-4 w-4 mr-2" />
                            Réinitialiser PIN
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-slate-700" />
                          <DropdownMenuItem
                            onClick={() =>
                              toggleStatusMutation.mutate({
                                userId: rep.user_id,
                                newStatus: !isActive,
                              })
                            }
                            className={
                              isActive
                                ? "text-red-400 hover:bg-red-500/20"
                                : "text-emerald-400 hover:bg-emerald-500/20"
                            }
                          >
                            {isActive ? (
                              <>
                                <Ban className="h-4 w-4 mr-2" />
                                Désactiver
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Activer
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
