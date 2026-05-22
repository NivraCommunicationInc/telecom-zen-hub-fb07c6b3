/**
 * CoreSocialMediaPage — admin manager for the Réseaux Sociaux agent.
 * Lists pending / published posts, lets admin approve, reject or mark as published.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Share2, CheckCircle2, XCircle, ExternalLink, Sparkles, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type SocialPost = {
  id: string;
  platform: "facebook" | "instagram" | "both";
  post_text: string;
  hashtags: string[] | null;
  post_type: string | null;
  status: "pending" | "approved" | "published" | "rejected";
  generated_by: string | null;
  published_at: string | null;
  facebook_post_id: string | null;
  reach: number;
  likes: number;
  shares: number;
  created_at: string;
};

const STATUS_BADGE: Record<SocialPost["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "secondary" },
  approved: { label: "Approuvé", variant: "default" },
  published: { label: "Publié", variant: "outline" },
  rejected: { label: "Rejeté", variant: "destructive" },
};

function usePosts(status: SocialPost["status"] | "all") {
  return useQuery({
    queryKey: ["social_media_posts", status],
    queryFn: async () => {
      let q = supabase
        .from("social_media_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SocialPost[];
    },
  });
}

function PostCard({ post, onChange }: { post: SocialPost; onChange: () => void }) {
  const setStatus = useMutation({
    mutationFn: async (newStatus: SocialPost["status"]) => {
      const patch: Partial<SocialPost> = { status: newStatus };
      if (newStatus === "published") patch.published_at = new Date().toISOString();
      const { error } = await supabase.from("social_media_posts").update(patch).eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Post mis à jour" });
      onChange();
    },
    onError: (e: any) => toast({ title: "Erreur", description: String(e?.message || e), variant: "destructive" }),
  });

  const copy = async () => {
    const text = `${post.post_text}\n\n${(post.hashtags ?? []).join(" ")}`;
    await navigator.clipboard.writeText(text);
    toast({ title: "Copié dans le presse-papier" });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={STATUS_BADGE[post.status].variant}>{STATUS_BADGE[post.status].label}</Badge>
            {post.post_type && <Badge variant="outline">{post.post_type}</Badge>}
            <Badge variant="outline">{post.platform}</Badge>
          </div>
          <CardTitle className="text-sm text-muted-foreground font-normal">
            {new Date(post.created_at).toLocaleString("fr-CA")} · généré par {post.generated_by ?? "Nova"}
          </CardTitle>
        </div>
        <Button variant="ghost" size="sm" onClick={copy}>
          <Copy className="h-4 w-4 mr-1" /> Copier
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="whitespace-pre-wrap text-sm">{post.post_text}</p>
        {post.hashtags && post.hashtags.length > 0 && (
          <p className="text-xs text-primary">{post.hashtags.join(" ")}</p>
        )}
        {post.status === "published" && (
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div>Reach: {post.reach}</div>
            <div>Likes: {post.likes}</div>
            <div>Shares: {post.shares}</div>
          </div>
        )}
        {post.status === "pending" && (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" onClick={() => setStatus.mutate("approved")} disabled={setStatus.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Approuver
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStatus.mutate("rejected")} disabled={setStatus.isPending}>
              <XCircle className="h-4 w-4 mr-1" /> Rejeter
            </Button>
          </div>
        )}
        {post.status === "approved" && (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" onClick={() => setStatus.mutate("published")} disabled={setStatus.isPending}>
              <ExternalLink className="h-4 w-4 mr-1" /> Marquer publié
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PostList({ status }: { status: SocialPost["status"] | "all" }) {
  const qc = useQueryClient();
  const { data, isLoading } = usePosts(status);
  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">Aucun post.</p>;
  return (
    <div className="grid gap-3">
      {data.map(p => (
        <PostCard key={p.id} post={p} onChange={() => qc.invalidateQueries({ queryKey: ["social_media_posts"] })} />
      ))}
    </div>
  );
}

async function triggerGenerate() {
  const { data, error } = await supabase.functions.invoke("agent-social", { body: {} });
  if (error) throw error;
  return data;
}

export default function CoreSocialMediaPage() {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);

  const onGenerate = async () => {
    setGenerating(true);
    try {
      await triggerGenerate();
      toast({ title: "Génération lancée", description: "Un nouveau post est en cours de préparation." });
      qc.invalidateQueries({ queryKey: ["social_media_posts"] });
    } catch (e: any) {
      toast({ title: "Erreur", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Share2 className="h-6 w-6" /> Réseaux Sociaux
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Posts Facebook & Instagram générés par l'agent Nova 3× par semaine.
          </p>
        </div>
        <Button onClick={onGenerate} disabled={generating}>
          <Sparkles className="h-4 w-4 mr-1" /> {generating ? "Génération..." : "Générer un nouveau post"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connecter Facebook (à venir)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            La publication automatique sur Facebook/Instagram nécessite un Facebook Page Access Token.
            En attendant, les posts sont générés ici, copiez-les dans Facebook ou Instagram manuellement
            après approbation.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">En attente</TabsTrigger>
          <TabsTrigger value="approved">Approuvés</TabsTrigger>
          <TabsTrigger value="published">Publiés</TabsTrigger>
          <TabsTrigger value="rejected">Rejetés</TabsTrigger>
          <TabsTrigger value="all">Tous</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4"><PostList status="pending" /></TabsContent>
        <TabsContent value="approved" className="mt-4"><PostList status="approved" /></TabsContent>
        <TabsContent value="published" className="mt-4"><PostList status="published" /></TabsContent>
        <TabsContent value="rejected" className="mt-4"><PostList status="rejected" /></TabsContent>
        <TabsContent value="all" className="mt-4"><PostList status="all" /></TabsContent>
      </Tabs>
    </div>
  );
}
