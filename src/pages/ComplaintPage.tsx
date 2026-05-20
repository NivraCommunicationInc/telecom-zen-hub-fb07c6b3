/**
 * ComplaintPage — public complaint submission form.
 * Route: /plainte (anonymous, no auth required)
 *
 * Inserts into `complaints`, uploads optional attachments into the
 * `complaint-attachments` bucket, links them via `complaint_attachments`,
 * and queues two emails:
 *   - complaint_confirmation → submitter
 *   - complaint_escalated    → nivratelecom@gmail.com (internal alert)
 */
import { useMemo, useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, Loader2, Upload, X, FileText, Image as ImageIcon, Film,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
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
  const [success, setSuccess] = useState<{ ticket: string } | null>(null);

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

      // 1) Insert complaint
      const { data: complaint, error: insErr } = await supabase
        .from("complaints")
        .insert({
          submitted_by_name: fullName,
          submitted_by_email: email.trim(),
          submitted_by_phone: phone.trim() || null,
          category,
          subject: subject.trim(),
          description: description.trim(),
          priority: "normal",
          status: "new",
        } as any)
        .select("id, ticket_number")
        .single();

      if (insErr || !complaint) {
        throw insErr || new Error("Échec de création de la plainte.");
      }

      // 2) Upload attachments (best-effort; don't block success)
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

      // 3) Queue emails (confirmation to client + internal escalation)
      const priorityLabel = "Normale";
      const slaLabel = "72 heures";
      const portalUrl =
        typeof window !== "undefined" ? `${window.location.origin}/plainte` : "/plainte";

      await supabase.from("email_queue").insert([
        {
          event_key: `complaint_confirmation_${complaint.id}`,
          to_email: email.trim(),
          template_key: "complaint_confirmation",
          template_vars: {
            first_name: firstName.trim(),
            ticket_number: complaint.ticket_number,
            category_label: CATEGORY_LABEL[category],
            category,
            priority_label: priorityLabel,
            sla_label: slaLabel,
            portal_url: portalUrl,
          },
          status: "queued",
        },
        {
          event_key: `complaint_escalated_${complaint.id}`,
          to_email: "nivratelecom@gmail.com",
          template_key: "complaint_escalated",
          template_vars: {
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
          status: "queued",
        },
      ] as any);

      setSuccess({ ticket: complaint.ticket_number });
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
      <div className="min-h-screen bg-[#0a0118] text-white flex items-center justify-center px-4 py-12">
        <Helmet>
          <title>Plainte soumise — Nivra Telecom</title>
          <meta name="robots" content="noindex,nofollow" />
        </Helmet>
        <div className="max-w-xl w-full text-center bg-white/5 border border-purple-500/20 rounded-2xl p-8 shadow-2xl">
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mb-6 animate-in zoom-in-95">
            <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold mb-3">Plainte soumise avec succès!</h1>
          <p className="text-white/70 mb-6">
            Votre plainte a bien été enregistrée. Nous vous contacterons rapidement.
          </p>
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-5 py-4 mb-5">
            <div className="text-xs uppercase tracking-wide text-purple-200 mb-1">
              Votre numéro de ticket
            </div>
            <div className="text-2xl font-mono font-bold text-white">{success.ticket}</div>
          </div>
          <p className="text-sm text-white/60 mb-2">
            Vous recevrez une confirmation par courriel sous quelques minutes.
          </p>
          <p className="text-sm text-white/60 mb-6">
            <strong className="text-white">Délai de traitement :</strong> 72 heures
          </p>
          <Button
            onClick={() => (window.location.href = "/")}
            className="bg-purple-600 hover:bg-purple-700 rounded-full"
          >
            Retour à l accueil
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0118] text-white">
      <Helmet>
        <title>Soumettre une plainte — Nivra Telecom</title>
        <meta name="description" content="Soumettez une plainte à Nivra Telecom. Délais de réponse garantis." />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="inline-block mb-4">
            <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              Nivra
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Soumettre une plainte</h1>
          <p className="text-white/70 max-w-xl mx-auto">
            Nous prenons chaque plainte au sérieux. Délai de réponse garanti.
          </p>
        </header>

        {/* SLA bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs sm:text-sm mb-8">
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-center">
            🔴 <span className="font-semibold">Urgent</span> · 4h
          </div>
          <div className="rounded-lg bg-orange-500/10 border border-orange-500/30 px-3 py-2 text-center">
            🟠 <span className="font-semibold">Élevée</span> · 24h
          </div>
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-center">
            🟡 <span className="font-semibold">Normale</span> · 72h
          </div>
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-center">
            🟢 <span className="font-semibold">Faible</span> · 7 j
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* SECTION 1 */}
          <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
            <h2 className="text-lg font-semibold mb-4">Vos coordonnées</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-white/80">Prénom *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-white/80">Nom *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/80">Courriel *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white/80">Téléphone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="account" className="text-white/80">Numéro de compte Nivra</Label>
                <Input
                  id="account"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="bg-white/5 border-white/20 text-white"
                />
                <p className="text-xs text-white/50">
                  Trouvez votre numéro dans votre courriel de confirmation.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 2 */}
          <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
            <h2 className="text-lg font-semibold mb-4">Votre plainte</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white/80">Catégorie *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-white/5 border-white/20 text-white">
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
                <Label htmlFor="subject" className="text-white/80 flex justify-between">
                  <span>Sujet *</span>
                  <span className={cn("text-xs", subjectLeft < 0 ? "text-red-400" : "text-white/50")}>
                    {subjectLeft} restants
                  </span>
                </Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value.slice(0, SUBJECT_MAX))}
                  maxLength={SUBJECT_MAX}
                  required
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-white/80 flex justify-between">
                  <span>Description *</span>
                  <span className={cn("text-xs",
                    description.length < DESC_MIN ? "text-amber-400" :
                    descLeft < 0 ? "text-red-400" : "text-white/50"
                  )}>
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
                  placeholder="Décrivez votre problème en détail. Plus vous donnez d informations, plus nous pourrons vous aider rapidement."
                  className="bg-white/5 border-white/20 text-white resize-y"
                />
              </div>
            </div>
          </section>

          {/* SECTION 3 — Files */}
          <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
            <h2 className="text-lg font-semibold mb-4">Pièces jointes (optionnel)</h2>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "block border-2 border-dashed rounded-xl px-4 py-8 text-center cursor-pointer transition-colors",
                dragging ? "border-purple-400 bg-purple-500/10" : "border-white/20 hover:border-purple-500/50 hover:bg-white/5"
              )}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-purple-300" />
              <div className="text-sm text-white/80">Glissez vos fichiers ici ou cliquez</div>
              <div className="text-xs text-white/50 mt-1">
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
                    <li key={i} className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 p-2">
                      {url ? (
                        <img src={url} alt="" className="w-12 h-12 rounded object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-purple-500/20 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-purple-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{f.name}</div>
                        <div className="text-xs text-white/50">{bytes(f.size)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="p-2 rounded-full hover:bg-white/10 text-white/60"
                        aria-label={`Retirer ${f.name}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              <ShieldAlert className="w-5 h-5 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full h-12 text-base bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 rounded-full font-semibold shadow-lg"
          >
            {submitting && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
            Soumettre ma plainte
          </Button>

          <p className="text-center text-xs text-white/40">
            Nous vous répondrons par courriel dans les délais SLA indiqués ci-dessus.
          </p>
        </form>
      </div>
    </div>
  );
}
