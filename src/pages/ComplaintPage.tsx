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
import { useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
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

// Design tokens
const C = {
  bg: "#0A0A0F",
  card: "#111118",
  border: "#1E1E2E",
  accent: "#8B5CF6",
  accentHover: "#7C3AED",
  textPrimary: "#F8F8FF",
  textSecondary: "#A0A0B0",
  inputBg: "#1A1A28",
  inputBorder: "#2E2E45",
  placeholder: "#606080",
  success: "#10B981",
  error: "#EF4444",
};

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

const inputBaseStyle: React.CSSProperties = {
  background: C.inputBg,
  border: `1px solid ${C.inputBorder}`,
  color: C.textPrimary,
};

const inputClass =
  "w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors min-h-[44px]";

function DarkInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(inputClass, props.className)}
      style={{ ...inputBaseStyle, ...(props.style || {}) }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = C.accent;
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = C.inputBorder;
        props.onBlur?.(e);
      }}
    />
  );
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
        .select("id, ticket_number, public_token")
        .single();

      if (insErr || !complaint) {
        throw insErr || new Error("Échec de création de la plainte.");
      }

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
      <div
        className="min-h-screen flex items-center justify-center px-4 py-12"
        style={{ background: C.bg, color: C.textPrimary }}
      >
        <Helmet>
          <title>Plainte soumise — Nivra Telecom</title>
          <meta name="robots" content="noindex,nofollow" />
        </Helmet>
        <div
          className="max-w-xl w-full text-center rounded-2xl p-8 shadow-2xl"
          style={{ background: C.card, border: `1px solid ${C.border}` }}
        >
          <div
            className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 animate-in zoom-in-95"
            style={{ background: "rgba(16, 185, 129, 0.15)", border: `1px solid ${C.success}` }}
          >
            <CheckCircle2 className="w-12 h-12" style={{ color: C.success }} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: C.textPrimary }}>
            Plainte soumise avec succès!
          </h1>
          <p className="mb-6" style={{ color: C.textSecondary }}>
            Votre plainte a bien été enregistrée. Nous vous contacterons rapidement.
          </p>
          <div
            className="rounded-xl px-5 py-4 mb-5"
            style={{ background: C.inputBg, border: `1px solid ${C.border}` }}
          >
            <div className="text-xs uppercase tracking-wide mb-1" style={{ color: C.textSecondary }}>
              Votre numéro de ticket
            </div>
            <div className="text-2xl font-mono font-bold" style={{ color: C.textPrimary }}>
              {success.ticket}
            </div>
          </div>
          <p className="text-sm mb-2" style={{ color: C.textSecondary }}>
            Vous recevrez une confirmation par courriel sous quelques minutes.
          </p>
          <p className="text-sm mb-6" style={{ color: C.textSecondary }}>
            <strong style={{ color: C.textPrimary }}>Délai de traitement :</strong> 72 heures
          </p>
          <button
            type="button"
            onClick={() => (window.location.href = "/")}
            className="inline-flex items-center justify-center h-12 px-6 rounded-lg font-semibold transition-colors"
            style={{ background: C.accent, color: "#FFFFFF" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.accentHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = C.accent)}
          >
            Retour à l accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.textPrimary }}>
      <Helmet>
        <title>Soumettre une plainte — Nivra Telecom</title>
        <meta name="description" content="Soumettez une plainte à Nivra Telecom. Délais de réponse garantis." />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
              style={{ background: C.accent, color: "#FFFFFF" }}
            >
              N
            </div>
            <span className="text-xl font-bold tracking-tight" style={{ color: C.textPrimary }}>
              Nivra Telecom
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: C.textPrimary }}>
            Soumettre une plainte
          </h1>
          <p className="max-w-xl mx-auto" style={{ color: C.textSecondary }}>
            Nous prenons chaque plainte au sérieux. Délai de réponse garanti.
          </p>
        </header>


        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SECTION 1 */}
          <section className="rounded-2xl p-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: C.textPrimary }}>
              Vos coordonnées
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="firstName" className="text-sm font-medium" style={{ color: C.textSecondary }}>
                  Prénom *
                </label>
                <DarkInput
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="lastName" className="text-sm font-medium" style={{ color: C.textSecondary }}>
                  Nom *
                </label>
                <DarkInput
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium" style={{ color: C.textSecondary }}>
                  Courriel *
                </label>
                <DarkInput
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium" style={{ color: C.textSecondary }}>
                  Téléphone
                </label>
                <DarkInput
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="account" className="text-sm font-medium" style={{ color: C.textSecondary }}>
                  Numéro de compte Nivra
                </label>
                <DarkInput
                  id="account"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                />
                <p className="text-xs" style={{ color: C.textSecondary }}>
                  Trouvez votre numéro dans votre courriel de confirmation.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 2 */}
          <section className="rounded-2xl p-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: C.textPrimary }}>
              Votre plainte
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: C.textSecondary }}>
                  Catégorie *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  className={inputClass}
                  style={inputBaseStyle}
                >
                  <option value="" disabled>
                    Choisir une catégorie
                  </option>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value} style={{ background: C.card, color: C.textPrimary }}>
                      {c.emoji} {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="subject" className="flex justify-between text-sm font-medium" style={{ color: C.textSecondary }}>
                  <span>Sujet *</span>
                  <span className="text-xs" style={{ color: subjectLeft < 0 ? C.error : C.textSecondary }}>
                    {subjectLeft} restants
                  </span>
                </label>
                <DarkInput
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value.slice(0, SUBJECT_MAX))}
                  maxLength={SUBJECT_MAX}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="flex justify-between text-sm font-medium" style={{ color: C.textSecondary }}>
                  <span>Description *</span>
                  <span
                    className="text-xs"
                    style={{
                      color:
                        description.length < DESC_MIN
                          ? "#F59E0B"
                          : descLeft < 0
                          ? C.error
                          : C.textSecondary,
                    }}
                  >
                    {description.length < DESC_MIN
                      ? `${DESC_MIN - description.length} caractères minimum`
                      : `${descLeft} restants`}
                  </span>
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
                  rows={7}
                  required
                  placeholder="Décrivez votre problème en détail. Plus vous donnez d informations, plus nous pourrons vous aider rapidement."
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors resize-y"
                  style={inputBaseStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = C.inputBorder)}
                />
              </div>
            </div>
          </section>

          {/* SECTION 3 — Files */}
          <section className="rounded-2xl p-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: C.textPrimary }}>
              Pièces jointes (optionnel)
            </h2>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className="block border-2 border-dashed rounded-xl px-4 py-8 text-center cursor-pointer transition-colors"
              style={{
                borderColor: dragging ? C.accent : C.inputBorder,
                background: dragging ? "rgba(139, 92, 246, 0.08)" : C.inputBg,
              }}
            >
              <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: C.accent }} />
              <div className="text-sm" style={{ color: C.textPrimary }}>
                Glissez vos fichiers ici ou cliquez
              </div>
              <div className="text-xs mt-1" style={{ color: C.textSecondary }}>
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
                      className="flex items-center gap-3 rounded-lg p-2"
                      style={{ background: C.inputBg, border: `1px solid ${C.border}` }}
                    >
                      {url ? (
                        <img src={url} alt="" className="w-12 h-12 rounded object-cover" />
                      ) : (
                        <div
                          className="w-12 h-12 rounded flex items-center justify-center"
                          style={{ background: "rgba(139, 92, 246, 0.15)" }}
                        >
                          <Icon className="w-5 h-5" style={{ color: C.accent }} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate" style={{ color: C.textPrimary }}>{f.name}</div>
                        <div className="text-xs" style={{ color: C.textSecondary }}>{bytes(f.size)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="p-2 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                        style={{ color: C.textSecondary }}
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
            <div
              className="flex items-start gap-2 rounded-lg p-3 text-sm"
              style={{ border: `1px solid ${C.error}`, background: "rgba(239, 68, 68, 0.1)", color: "#FCA5A5" }}
            >
              <ShieldAlert className="w-5 h-5 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full h-12 rounded-lg text-base font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: C.accent, color: "#FFFFFF" }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) e.currentTarget.style.background = C.accentHover;
            }}
            onMouseLeave={(e) => (e.currentTarget.style.background = C.accent)}
          >
            {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
            Soumettre ma plainte
          </button>

          <p className="text-center text-xs" style={{ color: C.textSecondary }}>
            Nous vous répondrons par courriel dans les plus brefs délais.
          </p>
        </form>
      </div>
    </div>
  );
}
