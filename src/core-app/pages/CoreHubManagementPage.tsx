/**
 * CoreHubManagementPage — Full admin for Nivra Source Hub.
 * Tabs: 14 content sections + Tickets, Notifications, Analytics.
 * Bulk select / publish / unpublish / DELETE confirm / media upload.
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Loader2, Trash2, Pin, PinOff, Eye, EyeOff, Upload, X,
  Megaphone, Rss, BookOpen, ShoppingBag, Trophy, Calendar, Target,
  Lightbulb, BarChart3, ClipboardList, Ticket, GraduationCap,
  HelpCircle, Phone, Bell, BarChart2,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";

// ============================================================
// Tabs
// ============================================================

type TabKey =
  | "annonces" | "feed" | "documents" | "boutique" | "leaderboard"
  | "calendrier" | "concours" | "tips" | "pricing" | "formulaires"
  | "tickets" | "formation" | "faq" | "annuaire"
  | "notifications" | "analytics";

const TABS: Array<{ key: TabKey; label: string; icon: any; section?: string }> = [
  { key: "annonces",      label: "Annonces",       icon: Megaphone,     section: "annonces" },
  { key: "feed",          label: "Feed",           icon: Rss,           section: "feed" },
  { key: "documents",     label: "Documents",      icon: BookOpen },
  { key: "boutique",      label: "Boutique",       icon: ShoppingBag },
  { key: "leaderboard",   label: "Leaderboard",    icon: Trophy },
  { key: "calendrier",    label: "Calendrier",     icon: Calendar },
  { key: "concours",      label: "Concours",       icon: Target },
  { key: "tips",          label: "Conseils",       icon: Lightbulb,     section: "tips" },
  { key: "pricing",       label: "Forfaits & Prix",icon: BarChart3,     section: "pricing" },
  { key: "formulaires",   label: "Formulaires",    icon: ClipboardList },
  { key: "tickets",       label: "Tickets",        icon: Ticket },
  { key: "formation",     label: "Formation",      icon: GraduationCap, section: "training" },
  { key: "faq",           label: "FAQ",            icon: HelpCircle },
  { key: "annuaire",      label: "Annuaire",       icon: Phone },
  { key: "notifications", label: "Notifications",  icon: Bell },
  { key: "analytics",     label: "Analytics",      icon: BarChart2 },
];

const ROLE_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "field_sales", label: "Agents Field Sales" },
  { key: "employee",    label: "Employés" },
  { key: "technician",  label: "Techniciens" },
  { key: "hr",          label: "RH / HR" },
  { key: "admin",       label: "Administrateurs" },
];

export default function CoreHubManagementPage() {
  const [tab, setTab] = useState<TabKey>("annonces");
  const current = TABS.find((t) => t.key === tab)!;

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <div className="mb-4">
        <h1 className="text-lg font-bold tracking-tight">Nivra Source — Administration</h1>
        <p className="text-xs text-muted-foreground">
          Gérer le hub interne accessible aux portails Field, Employee, HR.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-5 overflow-x-auto">
        <div className="flex gap-0.5 min-w-max">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? "border-violet-600 text-violet-700"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {current.section && <PostsAdmin section={current.section} sectionLabel={current.label} />}
      {tab === "documents"     && <DocumentsAdmin />}
      {tab === "boutique"      && <BoutiqueAdmin />}
      {tab === "leaderboard"   && <LeaderboardAdmin />}
      {tab === "calendrier"    && <CalendarAdmin />}
      {tab === "concours"      && <ContestsAdmin />}
      {tab === "formulaires"   && <FormsAdmin />}
      {tab === "tickets"       && <TicketsAdmin />}
      {tab === "faq"           && <FaqAdmin />}
      {tab === "annuaire"      && <DirectoryAdmin />}
      {tab === "notifications" && <NotificationsAdmin />}
      {tab === "analytics"     && <AnalyticsAdmin />}
    </div>
  );
}

// ============================================================
// Shared helpers
// ============================================================

async function uploadToBucket(file: File, prefix: string): Promise<string | null> {
  const ext = file.name.split(".").pop();
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("hub-media").upload(path, file, {
    cacheControl: "3600", upsert: false,
  });
  if (error) { toast.error(`Upload échoué: ${error.message}`); return null; }
  const { data } = supabase.storage.from("hub-media").getPublicUrl(path);
  return data.publicUrl;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-blue-100 text-blue-700",
    in_progress: "bg-amber-100 text-amber-700",
    waiting: "bg-orange-100 text-orange-700",
    resolved: "bg-emerald-100 text-emerald-700",
    closed: "bg-gray-100 text-gray-700",
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-blue-100 text-blue-700",
    processing: "bg-violet-100 text-violet-700",
    shipped: "bg-indigo-100 text-indigo-700",
    delivered: "bg-emerald-100 text-emerald-700",
    upcoming: "bg-blue-100 text-blue-700",
    active: "bg-emerald-100 text-emerald-700",
    ended: "bg-gray-100 text-gray-700",
    published: "bg-emerald-100 text-emerald-700",
    draft: "bg-gray-100 text-gray-600",
    scheduled: "bg-violet-100 text-violet-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${map[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

function ConfirmDelete({ onConfirm, label = "Cet élément" }: { onConfirm: () => void; label?: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="p-2 rounded-lg text-red-600 hover:bg-red-50 min-h-[36px]" aria-label="Supprimer">
          <Trash2 className="h-4 w-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
          <AlertDialogDescription>{label} sera définitivement supprimé. Cette action est irréversible.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================
// PostsAdmin — used for Annonces, Feed, Tips, Pricing, Formation
// ============================================================

function PostsAdmin({ section, sectionLabel }: { section: string; sectionLabel: string }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: posts = [] } = useQuery({
    queryKey: ["admin-posts", section, filter],
    queryFn: async () => {
      let q = supabase.from("hub_posts").select("*").eq("section", section).order("created_at", { ascending: false });
      if (filter === "published") q = q.eq("is_published", true);
      if (filter === "draft") q = q.eq("is_published", false);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const bulkUpdate = useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: any }) => {
      const { error } = await supabase.from("hub_posts").update(patch).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Mis à jour"); setSelected(new Set()); qc.invalidateQueries({ queryKey: ["admin-posts", section] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("hub_posts").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Supprimé"); setSelected(new Set()); qc.invalidateQueries({ queryKey: ["admin-posts", section] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePin = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await supabase.from("hub_posts").update({ is_pinned: pinned }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-posts", section] }),
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, pub }: { id: string; pub: boolean }) => {
      const { error } = await supabase.from("hub_posts").update({
        is_published: pub,
        published_at: pub ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-posts", section] }),
  });

  const allSelected = posts.length > 0 && posts.every((p: any) => selected.has(p.id));

  if (showForm || editing) {
    return (
      <PostForm
        section={section}
        existing={editing}
        onClose={() => { setShowForm(false); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-posts", section] }); }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs">
            <option value="all">Tous</option>
            <option value="published">Publiés</option>
            <option value="draft">Brouillons</option>
          </select>
          {selected.size > 0 && (
            <>
              <span className="text-xs text-muted-foreground">{selected.size} sélectionné(s)</span>
              <button onClick={() => bulkUpdate.mutate({ ids: [...selected], patch: { is_published: true, published_at: new Date().toISOString() } })}
                className="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                Publier sélection
              </button>
              <button onClick={() => bulkUpdate.mutate({ ids: [...selected], patch: { is_published: false } })}
                className="text-xs px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50">
                Dépublier
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700">
                    Supprimer sélection
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer {selected.size} élément(s) ?</AlertDialogTitle>
                    <AlertDialogDescription>Action irréversible.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => bulkDelete.mutate([...selected])} className="bg-red-600">
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
        <button onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 min-h-[44px]">
          <Plus className="h-4 w-4" /> Nouveau {sectionLabel.toLowerCase()}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-left w-8">
                <Checkbox checked={allSelected}
                  onCheckedChange={(v) => {
                    if (v) setSelected(new Set(posts.map((p: any) => p.id)));
                    else setSelected(new Set());
                  }} />
              </th>
              <th className="p-3 text-left">Titre</th>
              <th className="p-3 text-left">Statut</th>
              <th className="p-3 text-left">Vues</th>
              <th className="p-3 text-left">Publié le</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">Aucun élément</td></tr>
            )}
            {posts.map((p: any) => (
              <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                <td className="p-3">
                  <Checkbox checked={selected.has(p.id)}
                    onCheckedChange={(v) => {
                      const n = new Set(selected);
                      if (v) n.add(p.id); else n.delete(p.id);
                      setSelected(n);
                    }} />
                </td>
                <td className="p-3">
                  <div className="font-semibold flex items-center gap-1.5">
                    {p.is_pinned && <Pin className="h-3 w-3 text-violet-600" />}
                    {p.title}
                  </div>
                  {p.category && <div className="text-[11px] text-muted-foreground">{p.category}</div>}
                </td>
                <td className="p-3"><StatusBadge status={p.is_published ? "published" : "draft"} /></td>
                <td className="p-3 text-muted-foreground">{p.view_count ?? 0}</td>
                <td className="p-3 text-[11px] text-muted-foreground">
                  {p.published_at ? new Date(p.published_at).toLocaleDateString("fr-CA") : "—"}
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => togglePublish.mutate({ id: p.id, pub: !p.is_published })}
                      title={p.is_published ? "Dépublier" : "Publier"}
                      className="p-2 rounded-lg hover:bg-muted">
                      {p.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button onClick={() => togglePin.mutate({ id: p.id, pinned: !p.is_pinned })}
                      title={p.is_pinned ? "Désépingler" : "Épingler"}
                      className="p-2 rounded-lg hover:bg-muted">
                      {p.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </button>
                    <button onClick={() => setEditing(p)}
                      className="text-xs px-2 py-1 rounded hover:bg-muted">Éditer</button>
                    <ConfirmDelete onConfirm={() => bulkDelete.mutate([p.id])} label={p.title} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PostForm({ section, existing, onClose }: { section: string; existing: any | null; onClose: () => void }) {
  const isEdit = !!existing;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [category, setCategory] = useState(existing?.category ?? "");
  const [tags, setTags] = useState<string>((existing?.tags ?? []).join(", "));
  const [visibleTo, setVisibleTo] = useState<string[]>(existing?.visible_to ?? ["field_sales", "employee", "technician", "hr", "admin"]);
  const [media, setMedia] = useState<string[]>(existing?.media_urls ?? []);
  const [docs, setDocs] = useState<string[]>(existing?.document_urls ?? []);
  const [videos, setVideos] = useState<string[]>(existing?.video_urls ?? []);
  const [links, setLinks] = useState<Array<{ label: string; url: string }>>(
    Array.isArray(existing?.external_links) ? existing.external_links : []
  );
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "scheduled">(
    existing?.is_published ? "published" : "draft"
  );
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>(existing?.expires_at?.slice(0, 16) ?? "");
  const [pinned, setPinned] = useState<boolean>(existing?.is_pinned ?? false);
  const [featured, setFeatured] = useState<boolean>(existing?.is_featured ?? false);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null, target: "media" | "docs" | "videos") => {
    if (!files) return;
    setUploading(true);
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      const url = await uploadToBucket(f, `${section}/${target}`);
      if (url) urls.push(url);
    }
    if (target === "media") setMedia([...media, ...urls]);
    if (target === "docs") setDocs([...docs, ...urls]);
    if (target === "videos") setVideos([...videos, ...urls]);
    setUploading(false);
  };

  const save = useMutation({
    mutationFn: async (publishNow: boolean) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        section, title, content, category: category || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        visible_to: visibleTo,
        media_urls: media, document_urls: docs, video_urls: videos,
        external_links: links,
        is_pinned: pinned, is_featured: featured,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        author_id: user?.id ?? null,
        is_published: publishNow || status === "published",
        published_at: (publishNow || status === "published") ? new Date().toISOString()
          : status === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      };
      if (isEdit) {
        const { error } = await supabase.from("hub_posts").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("hub_posts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(isEdit ? "Mis à jour" : "Créé"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">{isEdit ? "Modifier" : "Nouveau"} — {section}</h2>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Fermer</button>
      </div>

      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre (requis)"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold" />

      <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Contenu (Markdown supporté)"
        rows={8} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Catégorie"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (séparés par virgules)"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      </div>

      {/* Media */}
      <div className="rounded-xl border border-dashed border-border p-3 space-y-2">
        <label className="block text-xs font-semibold">📷 Ajouter des photos</label>
        <input type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files, "media")}
          className="text-xs" />
        {media.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {media.map((url, i) => (
              <div key={url} className="relative aspect-square">
                <img src={url} alt="" className="w-full h-full object-cover rounded-lg" />
                <button onClick={() => setMedia(media.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-600 text-white flex items-center justify-center">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-dashed border-border p-3 space-y-2">
        <label className="block text-xs font-semibold">📄 Ajouter des documents (PDF, DOCX, XLSX)</label>
        <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" multiple onChange={(e) => handleFiles(e.target.files, "docs")}
          className="text-xs" />
        {docs.map((url, i) => (
          <div key={url} className="flex items-center gap-2 text-xs">
            <Upload className="h-3 w-3 shrink-0" />
            <span className="flex-1 truncate">{url.split("/").pop()}</span>
            <button onClick={() => setDocs(docs.filter((_, j) => j !== i))}
              className="text-red-600"><X className="h-3 w-3" /></button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-border p-3 space-y-2">
        <label className="block text-xs font-semibold">🎥 Ajouter une vidéo</label>
        <input type="file" accept="video/*" onChange={(e) => handleFiles(e.target.files, "videos")} className="text-xs" />
        <div className="flex gap-2">
          <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Ou collez un lien YouTube/Vimeo"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs" />
          <button onClick={() => { if (videoUrl) { setVideos([...videos, videoUrl]); setVideoUrl(""); } }}
            className="text-xs px-3 rounded-lg bg-violet-600 text-white">Ajouter</button>
        </div>
        {videos.map((url, i) => (
          <div key={url} className="flex items-center gap-2 text-xs">
            <span className="flex-1 truncate">{url}</span>
            <button onClick={() => setVideos(videos.filter((_, j) => j !== i))}
              className="text-red-600"><X className="h-3 w-3" /></button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-border p-3 space-y-2">
        <label className="block text-xs font-semibold">🔗 Ajouter un lien</label>
        <div className="flex gap-2">
          <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Libellé"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs" />
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…"
            className="flex-[2] rounded-lg border border-border bg-background px-3 py-2 text-xs" />
          <button onClick={() => {
            if (linkLabel && linkUrl) { setLinks([...links, { label: linkLabel, url: linkUrl }]); setLinkLabel(""); setLinkUrl(""); }
          }} className="text-xs px-3 rounded-lg bg-violet-600 text-white">+</button>
        </div>
        {links.map((l, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="font-semibold">{l.label}</span>
            <span className="flex-1 truncate text-muted-foreground">{l.url}</span>
            <button onClick={() => setLinks(links.filter((_, j) => j !== i))}
              className="text-red-600"><X className="h-3 w-3" /></button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border p-3 space-y-2">
        <label className="block text-xs font-semibold">Audience cible</label>
        <div className="grid grid-cols-2 gap-1.5">
          {ROLE_OPTIONS.map((r) => (
            <label key={r.key} className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox checked={visibleTo.includes(r.key)}
                onCheckedChange={(v) => {
                  setVisibleTo(v ? [...visibleTo, r.key] : visibleTo.filter((x) => x !== r.key));
                }} />
              {r.label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1">Statut</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="draft">Brouillon</option>
            <option value="published">Publié</option>
            <option value="scheduled">Programmé</option>
          </select>
        </div>
        {status === "scheduled" && (
          <div>
            <label className="block text-xs font-semibold mb-1">Publication prévue</label>
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold mb-1">Expiration (optionnel)</label>
          <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs">
          <Checkbox checked={pinned} onCheckedChange={(v) => setPinned(!!v)} /> Épingler en haut
        </label>
        <label className="flex items-center gap-2 text-xs">
          <Checkbox checked={featured} onCheckedChange={(v) => setFeatured(!!v)} /> Mettre en avant
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <button onClick={onClose} className="text-xs px-4 py-2 rounded-lg hover:bg-muted">Annuler</button>
        <button onClick={() => { setStatus("draft"); save.mutate(false); }} disabled={!title || save.isPending || uploading}
          className="text-xs px-4 py-2 rounded-lg border border-border hover:bg-muted disabled:opacity-50 min-h-[40px]">
          Enregistrer brouillon
        </button>
        <button onClick={() => save.mutate(true)} disabled={!title || save.isPending || uploading}
          className="text-xs px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 min-h-[40px] inline-flex items-center gap-1.5">
          {save.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          Publier maintenant
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Documents / Boutique / Calendrier — keep existing CRUD
// ============================================================

function DocumentsAdmin() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("guide");
  const [fileUrl, setFileUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["admin-hub-docs"],
    queryFn: async () => (await supabase.from("hub_documents").select("*").order("created_at", { ascending: false })).data || [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hub_documents").insert({ title, category, file_url: fileUrl, is_published: true });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Document publié"); setTitle(""); setFileUrl(""); qc.invalidateQueries({ queryKey: ["admin-hub-docs"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("hub_documents").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Supprimé"); qc.invalidateQueries({ queryKey: ["admin-hub-docs"] }); },
  });

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          {["contract","policy","guide","form","fiscal","branding","faq","other"].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex gap-2">
          <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="URL ou téléverser →"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            setUploading(true);
            const url = await uploadToBucket(f, "documents");
            if (url) setFileUrl(url);
            setUploading(false);
          }} className="text-xs" />
        </div>
        <button onClick={() => create.mutate()} disabled={!title || !fileUrl || create.isPending || uploading}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50 min-h-[44px]">
          {(create.isPending || uploading) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Ajouter
        </button>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
            <tr><th className="p-3 text-left">Titre</th><th className="p-3">Catégorie</th><th className="p-3">Version</th><th className="p-3 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {data.map((d: any) => (
              <tr key={d.id} className="border-t border-border">
                <td className="p-3 font-semibold">{d.title}</td>
                <td className="p-3 text-xs text-muted-foreground">{d.category}</td>
                <td className="p-3 text-xs text-muted-foreground">v{d.version}</td>
                <td className="p-3 text-right"><ConfirmDelete onConfirm={() => remove.mutate(d.id)} label={d.title} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BoutiqueAdmin() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("apparel");
  const [imgUrl, setImgUrl] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["admin-hub-items"],
    queryFn: async () => (await supabase.from("hub_store_items").select("*").order("name")).data || [],
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["admin-hub-orders"],
    queryFn: async () => (await supabase.from("hub_store_orders").select("*").order("created_at", { ascending: false }).limit(50)).data || [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hub_store_items").insert({ name, category, image_url: imgUrl, is_available: true });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Article ajouté"); setName(""); setImgUrl(""); qc.invalidateQueries({ queryKey: ["admin-hub-items"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("hub_store_orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Statut mis à jour"); qc.invalidateQueries({ queryKey: ["admin-hub-orders"] }); },
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("hub_store_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-hub-items"] }),
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-xs font-bold uppercase text-muted-foreground mb-2">Articles ({items.length})</h2>
        <div className="rounded-xl border border-border bg-card p-4 space-y-2 mb-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l'article"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Catégorie"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input type="file" accept="image/*" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            const url = await uploadToBucket(f, "boutique"); if (url) setImgUrl(url);
          }} className="text-xs" />
          {imgUrl && <img src={imgUrl} alt="" className="h-20 rounded-lg" />}
          <button onClick={() => create.mutate()} disabled={!name || create.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50 min-h-[44px]">
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {items.map((it: any) => (
            <div key={it.id} className="rounded-xl border border-border bg-card p-3 text-sm flex items-center gap-2">
              {it.image_url && <img src={it.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />}
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{it.name}</div>
                <div className="text-[11px] text-muted-foreground">{it.category}</div>
              </div>
              <ConfirmDelete onConfirm={() => removeItem.mutate(it.id)} label={it.name} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-bold uppercase text-muted-foreground mb-2">Commandes récentes ({orders.length})</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
              <tr><th className="p-3 text-left">#</th><th className="p-3">Qté</th><th className="p-3">Taille</th><th className="p-3">Statut</th><th className="p-3">Date</th></tr>
            </thead>
            <tbody>
              {orders.map((o: any) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="p-3 font-mono text-[10px] text-muted-foreground">{o.id.slice(0, 8)}</td>
                  <td className="p-3 text-xs">{o.quantity}</td>
                  <td className="p-3 text-xs">{o.size || "—"}</td>
                  <td className="p-3">
                    <select value={o.status} onChange={(e) => updateOrder.mutate({ id: o.id, status: e.target.value })}
                      className="rounded-lg border border-border bg-background px-2 py-1 text-xs">
                      {["pending","approved","processing","shipped","delivered","cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="p-3 text-[11px] text-muted-foreground">{new Date(o.created_at).toLocaleDateString("fr-CA")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CalendarAdmin() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [type, setType] = useState("general");

  const { data = [] } = useQuery({
    queryKey: ["admin-hub-cal"],
    queryFn: async () => (await supabase.from("hub_calendar_events").select("*").order("start_date", { ascending: true })).data || [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hub_calendar_events").insert({ title, start_date: new Date(start).toISOString(), event_type: type });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Événement créé"); setTitle(""); setStart(""); qc.invalidateQueries({ queryKey: ["admin-hub-cal"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("hub_calendar_events").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-hub-cal"] }),
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <select value={type} onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          {["general","formation","contest","meeting","deadline","maintenance","other"].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => create.mutate()} disabled={!title || !start || create.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50 min-h-[44px]">
          <Plus className="h-4 w-4" /> Créer
        </button>
      </div>
      <div className="space-y-2">
        {data.map((ev: any) => (
          <div key={ev.id} className="rounded-xl border border-border bg-card p-3 text-sm flex items-center gap-3">
            <div className="font-semibold flex-1">{ev.title}</div>
            <div className="text-[11px] text-muted-foreground">{new Date(ev.start_date).toLocaleString("fr-CA")}</div>
            <ConfirmDelete onConfirm={() => remove.mutate(ev.id)} label={ev.title} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Leaderboard (read-only — based on field_commissions)
// ============================================================

function LeaderboardAdmin() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
      Le classement est calculé automatiquement à partir des ventes Field. Aucune configuration manuelle requise.
    </div>
  );
}

// ============================================================
// Concours
// ============================================================

function ContestsAdmin() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["admin-contests"],
    queryFn: async () => (await supabase.from("hub_contests").select("*").order("start_date", { ascending: false })).data || [],
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("hub_contests").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-contests"] }),
  });

  if (open || editing) return <ContestForm existing={editing} onClose={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-contests"] }); }} />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold min-h-[44px]">
          <Plus className="h-4 w-4" /> Nouveau concours
        </button>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
            <tr><th className="p-3 text-left">Titre</th><th className="p-3">Prix</th><th className="p-3">Début</th><th className="p-3">Fin</th><th className="p-3">Statut</th><th className="p-3 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {data.map((c: any) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3 font-semibold">{c.title}</td>
                <td className="p-3 text-xs">{c.prize} ({c.prize_value}$)</td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(c.start_date).toLocaleDateString("fr-CA")}</td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(c.end_date).toLocaleDateString("fr-CA")}</td>
                <td className="p-3"><StatusBadge status={c.status} /></td>
                <td className="p-3 text-right">
                  <button onClick={() => setEditing(c)} className="text-xs px-2 py-1 rounded hover:bg-muted">Éditer</button>
                  <ConfirmDelete onConfirm={() => remove.mutate(c.id)} label={c.title} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContestForm({ existing, onClose }: { existing: any | null; onClose: () => void }) {
  const isEdit = !!existing;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [rules, setRules] = useState(existing?.rules ?? "");
  const [prize, setPrize] = useState(existing?.prize ?? "");
  const [prizeValue, setPrizeValue] = useState<number>(existing?.prize_value ?? 0);
  const [start, setStart] = useState<string>(existing?.start_date?.slice(0, 16) ?? "");
  const [end, setEnd] = useState<string>(existing?.end_date?.slice(0, 16) ?? "");
  const [status, setStatus] = useState<string>(existing?.status ?? "upcoming");
  const [visibleTo, setVisibleTo] = useState<string[]>(existing?.visible_to ?? ["field_sales"]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title, description, rules, prize, prize_value: prizeValue,
        start_date: new Date(start).toISOString(), end_date: new Date(end).toISOString(),
        status, visible_to: visibleTo,
      };
      const op = isEdit
        ? supabase.from("hub_contests").update(payload).eq("id", existing.id)
        : supabase.from("hub_contests").insert(payload);
      const { error } = await op;
      if (error) throw error;
    },
    onSuccess: () => { toast.success(isEdit ? "Mis à jour" : "Créé"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3 max-w-3xl">
      <h2 className="text-base font-bold">{isEdit ? "Modifier" : "Nouveau"} concours</h2>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={3}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      <textarea value={rules} onChange={(e) => setRules(e.target.value)} placeholder="Règles" rows={4}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      <div className="grid grid-cols-2 gap-3">
        <input value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="Prix"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input type="number" value={prizeValue} onChange={(e) => setPrizeValue(Number(e.target.value))} placeholder="Valeur ($)"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      </div>
      <select value={status} onChange={(e) => setStatus(e.target.value)}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
        {["upcoming","active","ended","cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <div>
        <label className="block text-xs font-semibold mb-1">Audience</label>
        <div className="grid grid-cols-2 gap-1.5">
          {ROLE_OPTIONS.map((r) => (
            <label key={r.key} className="flex items-center gap-2 text-xs">
              <Checkbox checked={visibleTo.includes(r.key)}
                onCheckedChange={(v) => setVisibleTo(v ? [...visibleTo, r.key] : visibleTo.filter((x) => x !== r.key))} />
              {r.label}
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button onClick={onClose} className="text-xs px-4 py-2 rounded-lg hover:bg-muted">Annuler</button>
        <button onClick={() => save.mutate()} disabled={!title || !start || !end || save.isPending}
          className="text-xs px-4 py-2 rounded-lg bg-violet-600 text-white disabled:opacity-50 min-h-[40px]">
          Enregistrer
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Formulaires (placeholder — links to forms)
// ============================================================

function FormsAdmin() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
      Les formulaires de contact, plaintes et incidents sont gérés via les types de tickets dans <strong>Tickets</strong>.
    </div>
  );
}

// ============================================================
// Tickets — full triage
// ============================================================

function TicketsAdmin() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [open, setOpen] = useState<any | null>(null);

  const { data: tickets = [] } = useQuery({
    queryKey: ["admin-tickets", statusFilter, priorityFilter],
    queryFn: async () => {
      let q = supabase.from("hub_tickets").select("*").order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (priorityFilter !== "all") q = q.eq("priority", priorityFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const exportCsv = () => {
    const header = "ticket_number,section,subject,priority,status,created_at\n";
    const rows = tickets.map((t: any) => `${t.ticket_number},${t.section},"${t.subject}",${t.priority},${t.status},${t.created_at}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `tickets-${Date.now()}.csv`; a.click();
  };

  if (open) return <TicketDetail ticket={open} onClose={() => { setOpen(null); qc.invalidateQueries({ queryKey: ["admin-tickets"] }); }} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs">
          <option value="all">Tous statuts</option>
          {["open","in_progress","waiting","resolved","closed"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs">
          <option value="all">Toutes priorités</option>
          {["low","normal","high","urgent"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={exportCsv} className="ml-auto text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted">
          Exporter CSV
        </button>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-left">#</th>
              <th className="p-3 text-left">Section</th>
              <th className="p-3 text-left">Sujet</th>
              <th className="p-3">Priorité</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Créé</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t: any) => (
              <tr key={t.id} onClick={() => setOpen(t)} className="border-t border-border hover:bg-muted/30 cursor-pointer">
                <td className="p-3 font-mono text-[11px]">{t.ticket_number}</td>
                <td className="p-3 text-xs">{t.section}</td>
                <td className="p-3 text-xs font-semibold truncate max-w-xs">{t.subject}</td>
                <td className="p-3"><StatusBadge status={t.priority} /></td>
                <td className="p-3"><StatusBadge status={t.status} /></td>
                <td className="p-3 text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleDateString("fr-CA")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TicketDetail({ ticket, onClose }: { ticket: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);

  const { data: messages = [] } = useQuery({
    queryKey: ["admin-ticket-msgs", ticket.id],
    queryFn: async () => (await supabase.from("hub_ticket_messages").select("*").eq("ticket_id", ticket.id).order("created_at")).data || [],
  });

  const send = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("hub_ticket_messages").insert({
        ticket_id: ticket.id, sender_id: user?.id, message: reply, is_internal_note: internal,
      });
      if (error) throw error;
    },
    onSuccess: () => { setReply(""); qc.invalidateQueries({ queryKey: ["admin-ticket-msgs", ticket.id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("hub_tickets").update(patch).eq("id", ticket.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Mis à jour"); qc.invalidateQueries({ queryKey: ["admin-tickets"] }); },
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">{ticket.ticket_number} — {ticket.subject}</h2>
          <p className="text-xs text-muted-foreground">Section: {ticket.section}</p>
        </div>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Retour</button>
      </div>

      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span>Statut</span>
        <select value={status} onChange={(e) => { setStatus(e.target.value); update.mutate({ status: e.target.value }); }}
          className="rounded-lg border border-border bg-background px-2 py-1">
          {["open","in_progress","waiting","resolved","closed"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="ml-2">Priorité</span>
        <select value={priority} onChange={(e) => { setPriority(e.target.value); update.mutate({ priority: e.target.value }); }}
          className="rounded-lg border border-border bg-background px-2 py-1">
          {["low","normal","high","urgent"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="rounded-xl bg-muted/40 p-3 text-sm whitespace-pre-wrap">{ticket.description}</div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {messages.map((m: any) => (
          <div key={m.id} className={`p-3 rounded-xl text-sm ${m.is_internal_note ? "bg-amber-50 border border-amber-200" : "bg-muted/30"}`}>
            {m.is_internal_note && <div className="text-[10px] uppercase font-bold text-amber-700 mb-1">Note interne</div>}
            <p className="whitespace-pre-wrap">{m.message}</p>
            <div className="text-[10px] text-muted-foreground mt-1">{new Date(m.created_at).toLocaleString("fr-CA")}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Répondre…" rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={internal} onCheckedChange={(v) => setInternal(!!v)} />
            Note interne (cachée à l'agent)
          </label>
          <button onClick={() => send.mutate()} disabled={!reply || send.isPending}
            className="text-xs px-4 py-2 rounded-lg bg-violet-600 text-white disabled:opacity-50 min-h-[40px]">
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FAQ
// ============================================================

function FaqAdmin() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [category, setCategory] = useState("general");

  const { data = [] } = useQuery({
    queryKey: ["admin-faq"],
    queryFn: async () => (await supabase.from("hub_faq").select("*").order("order_index")).data || [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hub_faq").insert({ question: q, answer: a, category, is_published: true });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ajouté"); setQ(""); setA(""); qc.invalidateQueries({ queryKey: ["admin-faq"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("hub_faq").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-faq"] }),
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Question"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold" />
        <textarea value={a} onChange={(e) => setA(e.target.value)} placeholder="Réponse" rows={4}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Catégorie"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button onClick={() => create.mutate()} disabled={!q || !a || create.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50 min-h-[44px]">
          <Plus className="h-4 w-4" /> Ajouter
        </button>
      </div>
      <div className="space-y-2">
        {data.map((f: any) => (
          <div key={f.id} className="rounded-xl border border-border bg-card p-3 text-sm">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <div className="font-semibold">{f.question}</div>
                <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{f.answer}</div>
              </div>
              <ConfirmDelete onConfirm={() => remove.mutate(f.id)} label={f.question} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Annuaire
// ============================================================

function DirectoryAdmin() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["admin-directory"],
    queryFn: async () => (await supabase.from("hub_directory").select("*").order("order_index")).data || [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hub_directory").insert({ name, role, email, phone, is_visible: true });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ajouté"); setName(""); setRole(""); setEmail(""); setPhone(""); qc.invalidateQueries({ queryKey: ["admin-directory"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("hub_directory").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-directory"] }),
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Rôle"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <button onClick={() => create.mutate()} disabled={!name || !role || create.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50 min-h-[44px]">
          <Plus className="h-4 w-4" /> Ajouter
        </button>
      </div>
      <div className="space-y-2">
        {data.map((d: any) => (
          <div key={d.id} className="rounded-xl border border-border bg-card p-3 text-sm flex items-center gap-3">
            <div className="flex-1">
              <div className="font-semibold">{d.name}</div>
              <div className="text-xs text-muted-foreground">{d.role} · {d.email} · {d.phone}</div>
            </div>
            <ConfirmDelete onConfirm={() => remove.mutate(d.id)} label={d.name} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Notifications
// ============================================================

function NotificationsAdmin() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [roles, setRoles] = useState<string[]>(["field_sales", "employee"]);

  const { data = [] } = useQuery({
    queryKey: ["admin-notifs"],
    queryFn: async () => (await supabase.from("hub_notifications").select("*").order("created_at", { ascending: false }).limit(100)).data || [],
  });

  const send = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("hub_notifications").insert({
        title, message, target_roles: roles, sent_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Notification envoyée"); setTitle(""); setMessage(""); qc.invalidateQueries({ queryKey: ["admin-notifs"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("hub_notifications").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-notifs"] }),
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} placeholder="Titre (60 caractères max)"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 200))} placeholder="Message (200 max)" rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <div>
          <label className="block text-xs font-semibold mb-1">Cibles</label>
          <div className="grid grid-cols-2 gap-1.5">
            {ROLE_OPTIONS.map((r) => (
              <label key={r.key} className="flex items-center gap-2 text-xs">
                <Checkbox checked={roles.includes(r.key)}
                  onCheckedChange={(v) => setRoles(v ? [...roles, r.key] : roles.filter((x) => x !== r.key))} />
                {r.label}
              </label>
            ))}
          </div>
        </div>
        <button onClick={() => send.mutate()} disabled={!title || !message || send.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50 min-h-[44px]">
          <Bell className="h-4 w-4" /> Envoyer maintenant
        </button>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
            <tr><th className="p-3 text-left">Titre</th><th className="p-3">Cibles</th><th className="p-3">Lus</th><th className="p-3">Envoyé</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {data.map((n: any) => (
              <tr key={n.id} className="border-t border-border">
                <td className="p-3 font-semibold text-xs">{n.title}</td>
                <td className="p-3 text-[11px] text-muted-foreground">{(n.target_roles || []).join(", ")}</td>
                <td className="p-3 text-xs">{(n.is_read_by || []).length}</td>
                <td className="p-3 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleDateString("fr-CA")}</td>
                <td className="p-3 text-right"><ConfirmDelete onConfirm={() => remove.mutate(n.id)} label={n.title} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Analytics
// ============================================================

function AnalyticsAdmin() {
  const { data: topPosts = [] } = useQuery({
    queryKey: ["analytics-top-posts"],
    queryFn: async () => (await supabase.from("hub_posts").select("title, section, view_count").order("view_count", { ascending: false }).limit(10)).data || [],
  });
  const { data: ticketStats } = useQuery({
    queryKey: ["analytics-tickets"],
    queryFn: async () => {
      const { data } = await supabase.from("hub_tickets").select("status");
      const counts: Record<string, number> = {};
      (data || []).forEach((t: any) => { counts[t.status] = (counts[t.status] ?? 0) + 1; });
      return counts;
    },
  });
  const { data: orderStats } = useQuery({
    queryKey: ["analytics-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("hub_store_orders").select("status");
      const counts: Record<string, number> = {};
      (data || []).forEach((o: any) => { counts[o.status] = (counts[o.status] ?? 0) + 1; });
      return counts;
    },
  });

  const exportReport = () => {
    const lines = [
      "=== Top posts ===",
      ...topPosts.map((p: any) => `${p.title} (${p.section}): ${p.view_count ?? 0}`),
      "",
      "=== Tickets ===",
      ...Object.entries(ticketStats || {}).map(([k, v]) => `${k}: ${v}`),
      "",
      "=== Orders ===",
      ...Object.entries(orderStats || {}).map(([k, v]) => `${k}: ${v}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `hub-report-${Date.now()}.txt`; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={exportReport} className="text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted">
          Exporter rapport
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold mb-3">Top 10 articles consultés</h3>
          <ol className="space-y-1 text-xs">
            {topPosts.map((p: any, i: number) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">{i + 1}. {p.title}</span>
                <span className="font-mono text-muted-foreground">{p.view_count ?? 0} vues</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold mb-3">Tickets par statut</h3>
          <ul className="space-y-1 text-xs">
            {Object.entries(ticketStats || {}).map(([k, v]) => (
              <li key={k} className="flex justify-between"><StatusBadge status={k} /><span className="font-mono">{v}</span></li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold mb-3">Commandes boutique par statut</h3>
          <ul className="space-y-1 text-xs">
            {Object.entries(orderStats || {}).map(([k, v]) => (
              <li key={k} className="flex justify-between"><StatusBadge status={k} /><span className="font-mono">{v}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
