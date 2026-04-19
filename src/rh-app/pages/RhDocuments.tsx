/**
 * RhDocuments — Employee uploads HR documents (medical, signed forms…).
 * Stored in private bucket 'hr-documents' under {user_id}/<filename>.
 */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Upload, FileText, Loader2, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const DOC_TYPE_LABELS: Record<string, string> = {
  medical_certificate: "Certificat médical",
  absence_justification: "Justificatif d'absence",
  requested_by_hr: "Document demandé par RH",
  signed_form: "Formulaire signé",
  other: "Autre",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending_review: "outline",
  approved: "default",
  rejected: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  pending_review: "En revue",
  approved: "Approuvé",
  rejected: "Rejeté",
};

export default function RhDocuments() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [docType, setDocType] = useState("medical_certificate");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { data: userId } = useQuery({
    queryKey: ["rh-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["rh-my-hr-documents", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("hr_documents")
        .select("*")
        .eq("employee_id", userId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Non authentifié");
      if (!file) throw new Error("Sélectionnez un fichier");
      if (!title.trim()) throw new Error("Titre requis");
      if (file.size > 10 * 1024 * 1024) throw new Error("Fichier trop volumineux (max 10 MB)");

      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${userId}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;

      const up = await supabase.storage.from("hr-documents").upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (up.error) throw up.error;

      const { error } = await supabase.from("hr_documents").insert({
        employee_id: userId,
        uploaded_by: userId,
        document_type: docType,
        title: title.trim(),
        file_path: path,
        file_size: file.size,
        mime_type: file.type || null,
      });
      if (error) {
        // Best-effort cleanup
        await supabase.storage.from("hr-documents").remove([path]);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Document téléversé. RH a été notifié.");
      setOpen(false);
      setFile(null);
      setTitle("");
      setDocType("medical_certificate");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["rh-my-hr-documents"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const deleteMut = useMutation({
    mutationFn: async (doc: any) => {
      // Only allow deleting pending docs
      await supabase.storage.from("hr-documents").remove([doc.file_path]);
      const { error } = await supabase.from("hr_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document supprimé");
      qc.invalidateQueries({ queryKey: ["rh-my-hr-documents"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const viewDoc = async (path: string) => {
    const { data, error } = await supabase.storage.from("hr-documents").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Impossible d'ouvrir le fichier");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-violet-600" />
            Mes documents RH
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Certificats médicaux, justificatifs et formulaires signés
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Upload className="h-4 w-4" />Téléverser
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Historique</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : documents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun document téléversé.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Téléversé le</TableHead>
                  <TableHead>Note RH</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium text-sm">{d.title}</TableCell>
                    <TableCell className="text-xs">{DOC_TYPE_LABELS[d.document_type] ?? d.document_type}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[d.status] ?? "secondary"} className="text-[11px]">
                        {STATUS_LABEL[d.status] ?? d.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(d.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate text-muted-foreground">
                      {d.review_note ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => viewDoc(d.file_path)} title="Voir">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {d.status === "pending_review" && (
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => deleteMut.mutate(d)} disabled={deleteMut.isPending}
                            title="Supprimer">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Upload dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Téléverser un document</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Type de document *</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Titre / description *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="ex. Certificat Dr. Tremblay 15 avril" />
            </div>
            <div>
              <Label>Fichier (PDF, JPG, PNG · max 10 MB) *</Label>
              <Input type="file" ref={fileRef}
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {file && (
                <p className="text-xs text-muted-foreground mt-1">
                  {file.name} · {(file.size / 1024).toFixed(0)} KB
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button disabled={uploadMut.isPending || !file || !title.trim()}
              onClick={() => uploadMut.mutate()}>
              {uploadMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Téléverser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
