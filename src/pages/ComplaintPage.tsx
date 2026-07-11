/**
 * ComplaintPage — public complaint submission form.
 * Route: /plainte (anonymous, no auth required)
 */
import { useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2, Loader2, Upload, X, FileText, Image as ImageIcon, Film,
  ShieldAlert,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PhotoBg } from "@/components/PhotoBg";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const CATEGORIES: { value: string; label: string; emoji: string }[] = [
  { value: "technique", label: "Problème technique", emoji: "🔧" },
  { value: "facturation", label: "Facturation", emoji: "💳" },
  { value: "service_client", label: "Service client", emoji: "👤" },
  { value: "installation", label: "Installation", emoji: "🔌" },
  { value: "equipement", label: "Équipement", emoji: "📦" },
  { value: "resiliation", label: "Résiliation", emoji: "❌" },
  { value: "autre", label: "Autre", emoji: "📝" },
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, `${c.emoji} ${c.label}`])
);

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "video/mp4"];

const SUBJECT_MAX = 150;
const DESC_MIN = 50;
const DESC_MAX = 2000;

function fileIcon(type: string) {
  if (type.startsWith("image/")) return ImageIcon;
  if (type === "application/pdf") return FileText;
  if (type === "video/mp4") return Film;
  return FileText;
}

function bytes(n: number) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / 1024 / 1024).toFixed(2)} Mo`;
}

export default function ComplaintPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [category, setCategory] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ ticket: string; trackingUrl: string } | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit =
    !!firstName.trim() &&
    !!lastName.trim() &&
    emailValid &&
    !!category &&
    subject.trim().length > 0 &&
    subject.length <= SUBJECT_MAX &&
    description.trim().length >= DESC_MIN &&
    description.length <= DESC_MAX &&
    !submitting;

  const onPickFiles = useCallback((picked: FileList | File[]) => {
    setError(null);
    const next: File[] = [...files];
    for (const f of Array.from(picked)) {
      if (next.length >= MAX_FILES) break;
      if (!ALLOWED_TYPES.includes(f.type)) {
        setError(`Type non autorisé : ${f.name}`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        setError(`Fichier trop volumineux (max 10 Mo) : ${f.name}`);
        continue;
      }
      next.push(f);
    }
    setFiles(next);
  }, [files]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) onPickFiles(e.dataTransfer.files);
  };

  const removeFile = (idx: number) =>
    setFiles((arr) => arr.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

      const { data: rpcRes, error: rpcErr } = await supabase.rpc(
        "submit_public_complaint" as any,
        {
          p_name: fullName,
          p_email: email.trim(),
          p_phone: phone.trim() || null,
          p_category: category,
          p_subject: subject.trim(),
          p_description: description.trim(),
        }
      );

      if (rpcErr) throw rpcErr;
      const res = rpcRes as { ok: boolean; error?: string; id?: string; ticket_number?: string; public_token?: string };
      if (!res?.ok || !res.id) {
        throw new Error(res?.error || "Échec de création de la plainte.");
      }
      const complaint = { id: res.id, ticket_number: res.ticket_number!, public_token: res.public_token! };


      if (files.length > 0) {
        for (const f of files) {
          const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${complaint.id}/${Date.now()}_${safeName}`;
          const { error: upErr } = await supabase.storage
            .from("complaint-attachments")
            .upload(path, f, { contentType: f.type, upsert: false });
          if (!upErr) {
            await supabase.from("complaint_attachments").insert({
              complaint_id: complaint.id,
              file_name: f.name,
              file_path: path,
              file_size: f.size,
              file_type: f.type,
            } as any);
          }
        }
      }

      const priorityLabel = "Normale";
      const slaLabel = "72 heures";
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const portalUrl = `${origin}/plainte/suivi/${(complaint as any).public_token}`;

      await enqueueCommunication({
        channel: "email",
        templateKey: "complaint_confirmation",
        recipient: email.trim(),
        idempotencyKey: `complaint_confirmation:${complaint.id}`,
        templateVars: {
          first_name: firstName.trim(),
          ticket_number: complaint.ticket_number,
          category_label: CATEGORY_LABEL[category],
          category,
          priority_label: priorityLabel,
          sla_label: slaLabel,
          portal_url: portalUrl,
        },
        entityType: "complaint",
        entityId: complaint.id,
      });

      await enqueueCommunication({
        channel: "email",
        templateKey: "complaint_escalated",
        recipient: "support@nivra-telecom.ca",
        idempotencyKey: `complaint_escalated:${complaint.id}`,
        templateVars: {
          ticket_number: complaint.ticket_number,
          client_name: fullName,
          submitted_by_email: email.trim(),
          submitted_by_phone: phone.trim() || "—",
          category_label: CATEGORY_LABEL[category],
          category,
          priority_label: priorityLabel,
          priority: "normal",
          subject: subject.trim(),
          description: description.trim(),
          core_complaint_url:
            typeof window !== "undefined"
              ? `${window.location.origin}/core/complaints`
              : "/core/complaints",
        },
        entityType: "complaint",
        entityId: complaint.id,
      });

      setSuccess({ ticket: complaint.ticket_number, trackingUrl: portalUrl });
    } catch (err: any) {
      setError(err?.message ?? "Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  const subjectLeft = SUBJECT_MAX - subject.length;
  const descLeft = DESC_MAX - description.length;

  if (success) {
    return (
      <div style={{ background: '#020209' }} className="relative min-h-screen flex items-center justify-center px-4 py-12 text-foreground overflow-hidden">
      <PhotoBg url="https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1920&q=80" opacity={0.10} filter="saturate(0.5) brightness(0.6)" />
        <Helmet>
          <title>Plainte soumise — Nivra Telecom</title>
          <meta name="robots" content="noindex,nofollow" />
        </Helmet>
        <Card className="max-w-xl w-full text-center rounded-2xl shadow-2xl">
          <CardContent className="p-8">
            <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 animate-in zoom-in-95 bg-green-500/15 border border-green-500">
              <CheckCircle2 className="w-12 h-12 text-green-500" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-3 text-foreground">
              Plainte soumise avec succès!
            </h1>
            <p className="mb-6 text-muted-foreground">
              Votre plainte a bien été enregistrée. Nous vous contacterons rapidement.
            </p>
            <div className="rounded-xl px-5 py-4 mb-5 bg-muted border border-border">
              <div className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">
                Votre numéro de ticket
              </div>
              <div className="text-2xl font-mono font-bold text-foreground">
                {success.ticket}
              </div>
            </div>
            <p className="text-sm mb-2 text-muted-foreground">
              Vous recevrez une confirmation par courriel sous quelques minutes.
            </p>
            <p className="text-sm mb-6 text-muted-foreground">
              <strong className="text-foreground">Délai de traitement :</strong> 72 heures
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild className="h-12 px-6">
                <a href={success.trackingUrl}>Suivre ma plainte</a>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 px-6"
                onClick={() => (window.location.href = "/")}
              >
                Retour à l'accueil
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ background: '#020209' }} className="relative min-h-screen text-foreground overflow-hidden">
      <PhotoBg url="https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1920&q=80" opacity={0.10} filter="saturate(0.5) brightness(0.6)" />
      <div aria-hidden style={{ position: 'absolute', top: '-15%', right: '-8%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-15%', left: '-6%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
      <Helmet>
        <title>Soumettre une plainte — Nivra Telecom</title>
        <meta name="description" content="Soumettez une plainte à Nivra Telecom. Délais de réponse garantis." />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <Header />

      <div className="max-w-3xl mx-auto px-4 pt-8 pb-14">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3 text-foreground">
            Soumettre une plainte
          </h1>
          <p className="max-w-xl mx-auto text-muted-foreground">
            Nous prenons chaque plainte au sérieux. Délai de réponse garanti.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SECTION 1 */}
          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4 text-foreground">
                Vos coordonnées
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom *</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom *</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Courriel *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="account">Numéro de compte Nivra</Label>
                  <Input
                    id="account"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Trouvez votre numéro dans votre courriel de confirmation.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 2 */}
          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4 text-foreground">
                Votre plainte
              </h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Catégorie *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.emoji} {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject" className="flex justify-between">
                    <span>Sujet *</span>
                    <span className={cn("text-xs", subjectLeft < 0 ? "text-destructive" : "text-muted-foreground")}>
                      {subjectLeft} restants
                    </span>
                  </Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value.slice(0, SUBJECT_MAX))}
                    maxLength={SUBJECT_MAX}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="flex justify-between">
                    <span>Description *</span>
                    <span
                      className={cn(
                        "text-xs",
                        description.length < DESC_MIN
                          ? "text-yellow-500"
                          : descLeft < 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                      )}
                    >
                      {description.length < DESC_MIN
                        ? `${DESC_MIN - description.length} caractères minimum`
                        : `${descLeft} restants`}
                    </span>
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
                    rows={7}
                    required
                    placeholder="Décrivez votre problème en détail. Plus vous donnez d'informations, plus nous pourrons vous aider rapidement."
                    className="resize-y"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 3 — Files */}
          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4 text-foreground">
                Pièces jointes (optionnel)
              </h2>
              <label
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                  "block border-2 border-dashed rounded-xl px-4 py-8 text-center cursor-pointer transition-colors",
                  dragging ? "border-primary bg-primary/5" : "border-border bg-muted"
                )}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-primary" />
                <div className="text-sm text-foreground">
                  Glissez vos fichiers ici ou cliquez
                </div>
                <div className="text-xs mt-1 text-muted-foreground">
                  JPG, PNG, WEBP, PDF, MP4 — max 10 Mo chacun · {MAX_FILES} fichiers max
                </div>
                <input
                  type="file"
                  multiple
                  accept={ALLOWED_TYPES.join(",")}
                  className="hidden"
                  onChange={(e) => e.target.files && onPickFiles(e.target.files)}
                />
              </label>

              {files.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {files.map((f, i) => {
                    const Icon = fileIcon(f.type);
                    const isImage = f.type.startsWith("image/");
                    const url = isImage ? URL.createObjectURL(f) : null;
                    return (
                      <li
                        key={i}
                        className="flex items-center gap-3 rounded-lg p-2 bg-muted border border-border"
                      >
                        {url ? (
                          <img src={url} alt="" className="w-12 h-12 rounded object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded flex items-center justify-center bg-primary/15">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate text-foreground">{f.name}</div>
                          <div className="text-xs text-muted-foreground">{bytes(f.size)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="p-2 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground"
                          aria-label={`Retirer ${f.name}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {error && (
            <div className="flex items-start gap-2 rounded-lg p-3 text-sm border border-destructive bg-destructive/10 text-destructive">
              <ShieldAlert className="w-5 h-5 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full h-12 text-base font-semibold"
          >
            {submitting && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
            Soumettre ma plainte
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Nous vous répondrons par courriel dans les plus brefs délais.
          </p>

          {/* CCTS notice — CRTC regulatory requirement */}
          <Card className="rounded-2xl border-border/50 bg-muted/40">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold mb-2 text-foreground flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-muted-foreground shrink-0" />
                Droits d'escalade — CCTS
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Si votre plainte n'est pas résolue dans un délai raisonnable (généralement 30 jours),
                vous avez le droit de la soumettre au{" "}
                <strong className="text-foreground">CCTS</strong> — Commission des plaintes relatives
                aux services de télécom-télévision, l'organisme indépendant et <strong className="text-foreground">gratuit</strong> de
                résolution de plaintes pour les clients de services de télécommunications au Canada.
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <a
                  href="https://www.ccts-cprst.ca/plaintes/deposer-une-plainte/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  ccts-cprst.ca
                </a>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">1-888-221-1687</span>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
      <Footer />
    </div>
  );
}
