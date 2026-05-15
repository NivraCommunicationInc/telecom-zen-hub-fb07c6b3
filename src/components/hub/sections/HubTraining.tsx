/**
 * HubTraining — Training videos and articles (hub_posts section='training').
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, GraduationCap, PlayCircle, FileText } from "lucide-react";

export default function HubTraining({ search = "" }: { search?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["hub-training"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_posts")
        .select("*")
        .eq("section", "training")
        .eq("is_published", true)
        .order("is_featured", { ascending: false })
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const filtered = (data || []).filter((p: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (p.title || "").toLowerCase().includes(s) || (p.content || "").toLowerCase().includes(s);
  });

  if (!filtered.length) {
    return (
      <div className="text-center py-16">
        <GraduationCap className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Aucune formation disponible.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl">
      {filtered.map((p: any) => {
        const hasVideo = (p.video_urls?.length ?? 0) > 0;
        const Icon = hasVideo ? PlayCircle : FileText;
        return (
          <article key={p.id} className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow">
            {p.media_urls?.[0] && (
              <div className="relative aspect-video bg-muted">
                <img src={p.media_urls[0]} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                {hasVideo && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <PlayCircle className="h-10 w-10 text-white drop-shadow-lg" />
                  </div>
                )}
              </div>
            )}
            <div className="p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                <Icon className="h-3 w-3" />
                {hasVideo ? "Vidéo" : "Article"}
                {p.category && <><span>·</span><span>{p.category}</span></>}
              </div>
              <h4 className="text-sm font-semibold text-foreground line-clamp-2">{p.title}</h4>
              {p.content && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.content}</p>}
              {p.video_urls?.[0] && (
                <a href={p.video_urls[0]} target="_blank" rel="noreferrer" className="block mt-2 text-xs font-semibold text-violet-600 hover:underline">
                  Voir la vidéo →
                </a>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
