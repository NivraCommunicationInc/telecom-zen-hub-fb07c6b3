/**
 * HubFeed — Instagram-style vertical feed of hub_posts (section='feed').
 * Reactions inline. Real-time appended posts.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Rss, ThumbsUp, Check, Flame, Heart, Hand } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

const REACTIONS = [
  { key: "thumbs_up", icon: ThumbsUp, label: "👍" },
  { key: "check",     icon: Check,    label: "✅" },
  { key: "fire",      icon: Flame,    label: "🔥" },
  { key: "clap",      icon: Hand,     label: "👏" },
  { key: "heart",     icon: Heart,    label: "❤️" },
] as const;

export default function HubFeed({ search = "" }: { search?: string }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["hub-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_posts")
        .select("*")
        .eq("section", "feed")
        .eq("is_published", true)
        .order("is_pinned", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("hub-feed-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_posts", filter: "section=eq.feed" }, () => {
        qc.invalidateQueries({ queryKey: ["hub-feed"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const filtered = (data || []).filter((p: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (p.title || "").toLowerCase().includes(s) || (p.content || "").toLowerCase().includes(s);
  });

  const react = async (postId: string, reaction: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Non authentifié"); return; }
    const { error } = await supabase.from("hub_reactions").upsert(
      { user_id: user.id, post_id: postId, reaction },
      { onConflict: "user_id,post_id,reaction" }
    );
    if (error) toast.error(error.message);
  };

  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!filtered.length) return <EmptyState />;

  return (
    <div className="max-w-2xl space-y-4">
      {filtered.map((p: any) => (
        <article key={p.id} className="rounded-2xl border border-border bg-card overflow-hidden">
          {p.media_urls?.[0] && (
            <img src={p.media_urls[0]} alt={p.title} className="w-full max-h-[400px] object-cover bg-muted" loading="lazy" />
          )}
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">{p.title}</span>
              <span>·</span>
              <span>{p.published_at && formatDistanceToNow(new Date(p.published_at), { addSuffix: true, locale: fr })}</span>
            </div>
            {p.content && <p className="text-sm text-foreground whitespace-pre-line">{p.content}</p>}
            {p.external_links && Array.isArray(p.external_links) && (
              <div className="flex flex-wrap gap-1.5">
                {p.external_links.map((l: any, i: number) => (
                  <a key={i} href={l.url} target="_blank" rel="noreferrer" className="text-xs text-violet-600 hover:underline">{l.label || l.url}</a>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1 pt-2 border-t border-border">
              {REACTIONS.map(r => (
                <button
                  key={r.key}
                  onClick={() => react(p.id, r.key)}
                  className="text-base h-9 w-9 rounded-full hover:bg-secondary transition-colors"
                  title={r.key}
                  aria-label={r.key}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <Rss className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Aucune publication pour l'instant.</p>
    </div>
  );
}
