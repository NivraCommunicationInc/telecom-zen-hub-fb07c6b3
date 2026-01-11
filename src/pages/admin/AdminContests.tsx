import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Trophy,
  Users,
  Search,
  Download,
  Gift,
  Loader2,
  Copy,
  CheckCircle,
  Save,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const CONTEST_SLUG = "welcome-500-2026";

interface ContestEntry {
  id: string;
  contest_slug: string;
  user_id: string;
  order_id: string | null;
  full_name_snapshot: string | null;
  email_snapshot: string;
  phone_snapshot: string | null;
  promo_code_snapshot: string | null;
  created_at: string;
}

interface ContestWinner {
  id: string;
  contest_slug: string;
  winner_user_id: string;
  winner_entry_id: string;
  winner_name: string | null;
  winner_email: string | null;
  drawn_at: string;
  drawn_by_admin_id: string | null;
}

const AdminContests = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWinner, setSelectedWinner] = useState<ContestEntry | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<ContestEntry | null>(null);

  // Fetch contest entries
  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ["contest-entries", CONTEST_SLUG],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contest_entries")
        .select("*")
        .eq("contest_slug", CONTEST_SLUG)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ContestEntry[];
    },
  });

  // Fetch existing winner
  const { data: existingWinner } = useQuery({
    queryKey: ["contest-winner", CONTEST_SLUG],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contest_winners")
        .select("*")
        .eq("contest_slug", CONTEST_SLUG)
        .maybeSingle();

      if (error) throw error;
      return data as ContestWinner | null;
    },
  });

  // Save winner mutation
  const saveWinnerMutation = useMutation({
    mutationFn: async (entry: ContestEntry) => {
      // First delete any existing winner for this contest
      await supabase
        .from("contest_winners")
        .delete()
        .eq("contest_slug", CONTEST_SLUG);

      // Insert new winner
      const { error } = await supabase.from("contest_winners").insert({
        contest_slug: CONTEST_SLUG,
        winner_user_id: entry.user_id,
        winner_entry_id: entry.id,
        winner_name: entry.full_name_snapshot,
        winner_email: entry.email_snapshot,
        drawn_by_admin_id: user?.id || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contest-winner", CONTEST_SLUG] });
      toast({
        title: "Gagnant enregistré",
        description: "Le gagnant du tirage a été sauvegardé avec succès.",
      });
    },
    onError: (error) => {
      console.error("Error saving winner:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le gagnant.",
        variant: "destructive",
      });
    },
  });

  // Filter entries by search
  const filteredEntries = entries.filter((entry) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (entry.full_name_snapshot?.toLowerCase().includes(term)) ||
      (entry.email_snapshot?.toLowerCase().includes(term)) ||
      (entry.phone_snapshot?.includes(term))
    );
  });

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ["Date", "Nom", "Email", "Téléphone", "Code Promo", "User ID", "Order ID"];
    const rows = entries.map((e) => [
      format(new Date(e.created_at), "yyyy-MM-dd HH:mm"),
      e.full_name_snapshot || "",
      e.email_snapshot,
      e.phone_snapshot || "",
      e.promo_code_snapshot || "",
      e.user_id,
      e.order_id || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `concours-${CONTEST_SLUG}-participants.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: "Export réussi", description: `${entries.length} participants exportés.` });
  };

  // Spin the wheel
  const handleSpin = () => {
    if (entries.length === 0) {
      toast({
        title: "Aucun participant",
        description: "Il n'y a aucun participant à ce concours.",
        variant: "destructive",
      });
      return;
    }

    setIsSpinning(true);
    setSpinResult(null);

    // Animate through names
    let iterations = 0;
    const maxIterations = 30;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * entries.length);
      setSelectedWinner(entries[randomIndex]);
      iterations++;

      if (iterations >= maxIterations) {
        clearInterval(interval);
        // Final selection
        const winnerIndex = Math.floor(Math.random() * entries.length);
        const winner = entries[winnerIndex];
        setSelectedWinner(winner);
        setSpinResult(winner);
        setIsSpinning(false);
      }
    }, 100);
  };

  // Copy winner info
  const handleCopyWinner = () => {
    if (!spinResult) return;
    const info = `Gagnant: ${spinResult.full_name_snapshot || spinResult.email_snapshot || "N/A"}\nEmail: ${spinResult.email_snapshot}\nTéléphone: ${spinResult.phone_snapshot || "N/A"}`;
    navigator.clipboard.writeText(info);
    toast({ title: "Copié!", description: "Informations du gagnant copiées." });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Trophy className="w-8 h-8 text-primary" />
              Concours
            </h1>
            <p className="text-muted-foreground mt-1">
              Gestion du tirage 500$ — Code BIENVENUE
            </p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            <Gift className="w-4 h-4 mr-2" />
            {entries.length} participants
          </Badge>
        </div>

        <Tabs defaultValue="participants" className="space-y-4">
          <TabsList>
            <TabsTrigger value="participants" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Participants
            </TabsTrigger>
            <TabsTrigger value="wheel" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Tirage
            </TabsTrigger>
          </TabsList>

          {/* Participants Tab */}
          <TabsContent value="participants" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Liste des participants
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                    <Button variant="outline" onClick={handleExportCSV} disabled={entries.length === 0}>
                      <Download className="w-4 h-4 mr-2" />
                      Exporter CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {entriesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "Aucun résultat trouvé" : "Aucun participant pour le moment"}
                  </div>
                ) : (
                  <div className="rounded-md border overflow-auto max-h-[500px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Nom</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Téléphone</TableHead>
                          <TableHead>Code Promo</TableHead>
                          <TableHead>Order ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEntries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(entry.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                            </TableCell>
                            <TableCell className="font-medium">
                              {entry.full_name_snapshot || entry.email_snapshot || "—"}
                            </TableCell>
                            <TableCell>{entry.email_snapshot}</TableCell>
                            <TableCell>{entry.phone_snapshot || "—"}</TableCell>
                            <TableCell>
                              {entry.promo_code_snapshot ? (
                                <Badge variant="secondary">{entry.promo_code_snapshot}</Badge>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono">
                              {entry.order_id ? entry.order_id.slice(0, 8) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Wheel/Tirage Tab */}
          <TabsContent value="wheel" className="space-y-4">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Wheel Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    Tirage au sort
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Current spinning name */}
                  <div className="min-h-[120px] flex items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20">
                    {isSpinning || selectedWinner ? (
                      <div className="text-center p-6">
                        <p className="text-2xl font-bold text-primary animate-pulse">
                          {selectedWinner?.full_name_snapshot || selectedWinner?.email_snapshot || "Participant"}
                        </p>
                        {isSpinning && (
                          <p className="text-sm text-muted-foreground mt-2">Tirage en cours...</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        Cliquez sur "Lancer le tirage" pour sélectionner un gagnant
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSpin}
                      disabled={isSpinning || entries.length === 0}
                      className="flex-1"
                      size="lg"
                    >
                      {isSpinning ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Tirage en cours...
                        </>
                      ) : (
                        <>
                          <Gift className="w-4 h-4 mr-2" />
                          Lancer le tirage
                        </>
                      )}
                    </Button>
                    {spinResult && (
                      <Button variant="outline" onClick={() => { setSpinResult(null); setSelectedWinner(null); }}>
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {entries.length === 0 && (
                    <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
                      <AlertCircle className="w-4 h-4" />
                      Aucun participant inscrit au concours.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Winner Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    Gagnant
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {spinResult ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                        <div className="space-y-2">
                          <div>
                            <p className="text-sm text-muted-foreground">Nom</p>
                            <p className="font-semibold text-lg">
                              {spinResult.full_name_snapshot || spinResult.email_snapshot || "Non spécifié"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Email</p>
                            <p className="font-medium">{spinResult.email_snapshot}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Téléphone</p>
                            <p className="font-medium">{spinResult.phone_snapshot || "Non spécifié"}</p>
                          </div>
                          {spinResult.promo_code_snapshot && (
                            <div>
                              <p className="text-sm text-muted-foreground">Code utilisé</p>
                              <Badge variant="secondary">{spinResult.promo_code_snapshot}</Badge>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" onClick={handleCopyWinner} className="flex-1">
                          <Copy className="w-4 h-4 mr-2" />
                          Copier
                        </Button>
                        <Button
                          onClick={() => saveWinnerMutation.mutate(spinResult)}
                          disabled={saveWinnerMutation.isPending}
                          className="flex-1"
                        >
                          {saveWinnerMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
                          Enregistrer le gagnant
                        </Button>
                      </div>
                    </div>
                  ) : existingWinner ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-muted/50 border">
                        <div className="flex items-center gap-2 mb-3">
                          <Trophy className="w-5 h-5 text-amber-500" />
                          <span className="font-semibold">Gagnant enregistré</span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <p>
                            <span className="text-muted-foreground">Nom:</span>{" "}
                            {existingWinner.winner_name || "N/A"}
                          </p>
                          <p>
                            <span className="text-muted-foreground">Email:</span>{" "}
                            {existingWinner.winner_email}
                          </p>
                          <p>
                            <span className="text-muted-foreground">Date du tirage:</span>{" "}
                            {format(new Date(existingWinner.drawn_at), "d MMM yyyy HH:mm", { locale: fr })}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Un nouveau tirage remplacera le gagnant existant.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>Aucun gagnant sélectionné</p>
                      <p className="text-sm">Lancez le tirage pour sélectionner un gagnant</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminContests;
