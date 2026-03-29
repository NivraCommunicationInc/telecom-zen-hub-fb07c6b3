import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileText } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Props = { userId: string };

export default function Employee360Documents({ userId }: Props) {
  const { data: taxDocs, isLoading: loadTax } = useQuery({
    queryKey: ["e360-tax-docs", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tax_documents")
        .select("*")
        .eq("employee_id", userId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: letters, isLoading: loadLetters } = useQuery({
    queryKey: ["e360-letters", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("employment_letters")
        .select("*")
        .eq("employee_id", userId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const loading = loadTax || loadLetters;

  if (loading) {
    return <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Tabs defaultValue="tax" className="space-y-4">
      <TabsList>
        <TabsTrigger value="tax">Documents fiscaux ({taxDocs?.length ?? 0})</TabsTrigger>
        <TabsTrigger value="letters">Lettres d'emploi ({letters?.length ?? 0})</TabsTrigger>
      </TabsList>

      <TabsContent value="tax">
        <Card>
          <CardContent className="p-0">
            {!taxDocs?.length ? (
              <p className="p-4 text-sm text-muted-foreground">Aucun document fiscal.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Année</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead>PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxDocs.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="flex items-center gap-2"><FileText className="h-3 w-3" />{d.document_type}</TableCell>
                      <TableCell>{d.tax_year}</TableCell>
                      <TableCell><Badge variant={d.status === "generated" ? "default" : "secondary"}>{d.status}</Badge></TableCell>
                      <TableCell className="text-xs">{format(new Date(d.created_at), "dd MMM yyyy", { locale: fr })}</TableCell>
                      <TableCell>{d.pdf_url ? <a href={d.pdf_url} target="_blank" rel="noreferrer" className="text-primary underline text-xs">Voir</a> : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="letters">
        <Card>
          <CardContent className="p-0">
            {!letters?.length ? (
              <p className="p-4 text-sm text-muted-foreground">Aucune lettre d'emploi.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Demandé le</TableHead>
                    <TableHead>PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {letters.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.letter_type}</TableCell>
                      <TableCell><Badge variant={l.status === "generated" ? "default" : l.status === "approved" ? "default" : "secondary"}>{l.status}</Badge></TableCell>
                      <TableCell className="text-xs">{format(new Date(l.created_at), "dd MMM yyyy", { locale: fr })}</TableCell>
                      <TableCell>{l.pdf_url ? <a href={l.pdf_url} target="_blank" rel="noreferrer" className="text-primary underline text-xs">Voir</a> : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
