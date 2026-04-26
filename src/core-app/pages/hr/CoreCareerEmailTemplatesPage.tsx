/**
 * CoreCareerEmailTemplatesPage — Manage email templates per recruitment stage.
 * Variables supported: {{name}}, {{position}}, {{interview_date}}, {{reason}}
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownEditor } from "@/core-app/components/careers/MarkdownEditor";
import { Mail, Save, Loader2, Variable } from "lucide-react";
import { toast } from "sonner";

type Tpl = {
  id: string;
  stage: string;
  language: string;
  subject: string;
  body_md: string;
  enabled: boolean;
};

const STAGES = [
  { key: "received", label: "Candidature reçue", desc: "Envoyé automatiquement à la soumission" },
  { key: "reviewing", label: "En révision", desc: "Quand passée en révision" },
  { key: "interview", label: "Invitation entrevue", desc: "Quand entrevue planifiée" },
  { key: "offer", label: "Offre envoyée", desc: "Quand offre transmise" },
  { key: "hired", label: "Embauche confirmée", desc: "Quand candidat embauché" },
  { key: "rejected", label: "Refus", desc: "Quand candidature refusée" },
];

const VARIABLES = [
  { token: "{{name}}", desc: "Nom du candidat" },
  { token: "{{position}}", desc: "Titre du poste" },
  { token: "{{interview_date}}", desc: "Date d'entrevue" },
  { token: "{{reason}}", desc: "Raison de refus" },
];

export default function CoreCareerEmailTemplatesPage() {
  const qc = useQueryClient();
  const [stage, setStage] = useState("received");
  const [form, setForm] = useState<Partial<Tpl>>({});

  const { data: templates = [] } = useQuery({
    queryKey: ["career-email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_email_templates")
        .select("*")
        .eq("language", "fr")
        .order("stage");
      if (error) throw error;
      return data as Tpl[];
    },
  });

  const current = templates.find((t) => t.stage === stage);

  useEffect(() => {
    if (current) {
      setForm({ ...current });
    } else {
      setForm({ stage, language: "fr", subject: "", body_md: "", enabled: true });
    }
  }, [stage, current]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        stage,
        language: "fr",
        subject: form.subject || "",
        body_md: form.body_md || "",
        enabled: form.enabled ?? true,
      };
      if (current) {
        const { error } = await supabase
          .from("job_email_templates")
          .update(payload)
          .eq("id", current.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("job_email_templates")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Template sauvegardé");
      qc.invalidateQueries({ queryKey: ["career-email-templates"] });
    },
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="w-6 h-6" /> Templates emails recrutement
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Personnalisez les courriels envoyés automatiquement aux candidats à chaque étape.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* Stage selector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Étapes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col">
              {STAGES.map((s) => {
                const tpl = templates.find((t) => t.stage === s.key);
                const isActive = stage === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStage(s.key)}
                    className={`text-left px-4 py-3 border-b hover:bg-muted/50 transition ${
                      isActive ? "bg-muted border-l-2 border-l-primary" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{s.label}</span>
                      {tpl?.enabled === false && (
                        <Badge variant="outline" className="text-[10px]">Off</Badge>
                      )}
                      {!tpl && (
                        <Badge variant="outline" className="text-[10px]">Non créé</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Editor */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {STAGES.find((s) => s.key === stage)?.label}
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.enabled ?? true}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
                />
                <Label className="text-xs">Actif</Label>
              </div>
              <Button onClick={() => save.mutate()} disabled={save.isPending} size="sm">
                {save.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Enregistrer
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Objet du courriel</Label>
              <Input
                value={form.subject ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="ex: Candidature reçue — {{position}}"
              />
            </div>

            <div className="space-y-2">
              <Label>Corps du message (Markdown)</Label>
              <MarkdownEditor
                value={form.body_md ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, body_md: v }))}
                rows={14}
                placeholder="Bonjour {{name}}, ..."
              />
            </div>

            <Card className="bg-muted/30 border-dashed">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-xs font-semibold mb-2">
                  <Variable className="w-3.5 h-3.5" />
                  Variables disponibles (cliquer pour copier)
                </div>
                <div className="flex flex-wrap gap-2">
                  {VARIABLES.map((v) => (
                    <button
                      key={v.token}
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(v.token);
                        toast.success(`${v.token} copié`);
                      }}
                      className="px-2 py-1 bg-background border rounded text-xs font-mono hover:border-primary"
                      title={v.desc}
                    >
                      {v.token}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
