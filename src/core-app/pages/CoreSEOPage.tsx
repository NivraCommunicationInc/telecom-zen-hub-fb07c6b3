import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Copy,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

interface ChecklistItem {
  status: "ok" | "warn" | "fail";
  label: string;
  hint?: string;
}

const CHECKLIST: ChecklistItem[] = [
  { status: "ok", label: "Meta tags installés (titre, description, OG, Twitter)" },
  { status: "ok", label: "Sitemap.xml créé et publié" },
  { status: "ok", label: "robots.txt créé et publié" },
  { status: "ok", label: "Schema markup installé (Organization, LocalBusiness, FAQ, Product)" },
  { status: "ok", label: "Landing pages SEO (4 pages haute valeur)" },
  { status: "warn", label: "Google Business — 2 profils détectés à fusionner" },
  { status: "fail", label: "Google Search Console — à configurer" },
  { status: "fail", label: "Reviews Google — 0 avis publiés" },
  { status: "fail", label: "Sitemap soumis à Google Search Console" },
  { status: "fail", label: "Google Analytics 4 — non connecté" },
];

const TARGET_KEYWORDS = [
  { kw: "internet sans contrat montréal", difficulty: "Élevé", volume: "1.2K/mois" },
  { kw: "internet prépayé québec", difficulty: "Élevé", volume: "880/mois" },
  { kw: "alternative bell vidéotron", difficulty: "Moyen", volume: "590/mois" },
  { kw: "internet pas cher montréal", difficulty: "Élevé", volume: "2.4K/mois" },
  { kw: "internet sans vérification crédit", difficulty: "Moyen", volume: "320/mois" },
  { kw: "forfait internet montréal", difficulty: "Élevé", volume: "1.9K/mois" },
  { kw: "internet giga montréal", difficulty: "Moyen", volume: "480/mois" },
];

const BACKLINKS = [
  { name: "Pages Jaunes Canada", url: "https://www.pagesjaunes.ca/", desc: "Annuaire #1 au Québec — créez une fiche entreprise complète." },
  { name: "Yelp Canada", url: "https://biz.yelp.ca/", desc: "Indexé par Google, important pour Local SEO." },
  { name: "Better Business Bureau", url: "https://www.bbb.org/ca/qc", desc: "Renforce la confiance et le ranking local." },
  { name: "Chambre de commerce de Montréal", url: "https://www.ccmm.ca/", desc: "Membre actif = backlink premium pour Montréal." },
  { name: "YP.ca", url: "https://www.yellowpages.ca/", desc: "Annuaire national, citation locale." },
  { name: "Canada411", url: "https://www.canada411.ca/", desc: "Annuaire historique, encore indexé." },
];

export default function CoreSEOPage() {
  const [reviewLink] = useState("https://g.page/r/nivra-telecom/review");

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
  };

  const StatusIcon = ({ s }: { s: ChecklistItem["status"] }) =>
    s === "ok" ? (
      <CheckCircle2 className="h-5 w-5 text-green-600" />
    ) : s === "warn" ? (
      <AlertTriangle className="h-5 w-5 text-yellow-600" />
    ) : (
      <XCircle className="h-5 w-5 text-red-600" />
    );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Globe className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">SEO &amp; Visibilité</h1>
          <p className="text-sm text-muted-foreground">
            Centre de pilotage SEO pour Nivra Telecom
          </p>
        </div>
      </div>

      <Tabs defaultValue="checklist">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="gbp">Google Business</TabsTrigger>
          <TabsTrigger value="keywords">Mots-clés</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="backlinks">Backlinks</TabsTrigger>
        </TabsList>

        {/* TAB 1 */}
        <TabsContent value="checklist" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>État du SEO Nivra Telecom</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {CHECKLIST.map((c) => (
                  <li key={c.label} className="flex items-start gap-3">
                    <StatusIcon s={c.status} />
                    <span className="text-sm">{c.label}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2 */}
        <TabsContent value="gbp" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>1. Fusionner vos 2 profils Google Business</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                Deux fiches Google Business détectées pour Nivra Telecom. Google pénalise les
                doublons. Étapes:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Connectez-vous à Google Business Profile.</li>
                <li>Identifiez le profil principal (le plus complet/vérifié).</li>
                <li>Demandez la fusion via "Réclamer" ou contactez le support Google.</li>
                <li>Supprimez ou marquez "fermé définitivement" le doublon.</li>
              </ol>
              <Button asChild variant="outline" size="sm">
                <a href="https://business.google.com/" target="_blank" rel="noopener noreferrer">
                  Ouvrir Google Business <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Corriger l'URL vers nivra-telecom.ca</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Dans Google Business → Informations → Site Web, assurez-vous que l'URL est exactement
              <code className="mx-1 px-2 py-0.5 rounded bg-muted">https://nivra-telecom.ca</code>
              (sans <code>www</code>, sans trailing slash).
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Demander des avis Google à vos clients</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Lien direct d'avis à envoyer par email ou SMS après installation:
              </p>
              <div className="flex gap-2 items-center bg-muted p-3 rounded">
                <code className="flex-1 truncate text-xs">{reviewLink}</code>
                <Button size="sm" variant="outline" onClick={() => copy(reviewLink, "Lien d'avis")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Note: générez le lien réel depuis Google Business → Avis → Partager.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Vérifier votre numéro de téléphone</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p className="text-red-600">
                <strong>Incohérence détectée:</strong> (438) 544-2233 listé sur Google Business.
              </p>
              <p className="text-green-700">
                <strong>Devrait être:</strong> (438) 540-3112
              </p>
              <p className="text-xs text-muted-foreground">
                Un NAP (Nom-Adresse-Téléphone) incohérent nuit gravement au ranking local.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3 */}
        <TabsContent value="keywords" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mots-clés cibles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Mot-clé</th>
                      <th className="text-left p-2">Difficulté</th>
                      <th className="text-left p-2">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TARGET_KEYWORDS.map((k) => (
                      <tr key={k.kw} className="border-b">
                        <td className="p-2 font-medium">{k.kw}</td>
                        <td className="p-2">{k.difficulty}</td>
                        <td className="p-2 text-muted-foreground">{k.volume}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configurer Google Search Console</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Allez sur Google Search Console.</li>
                <li>Ajoutez la propriété <code>https://nivra-telecom.ca</code>.</li>
                <li>Vérifiez via meta tag (à ajouter dans <code>src/config/seo.ts</code> → <code>googleSiteVerification</code>).</li>
                <li>Soumettez le sitemap: <code>https://nivra-telecom.ca/sitemap.xml</code>.</li>
              </ol>
              <Button asChild variant="outline" size="sm">
                <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer">
                  Ouvrir Search Console <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4 */}
        <TabsContent value="analytics" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Connecter Google Analytics 4</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Créez une propriété GA4 sur <a className="text-primary underline" href="https://analytics.google.com" target="_blank" rel="noopener noreferrer">analytics.google.com</a>.</li>
                <li>Récupérez votre Measurement ID (format <code>G-XXXXXXXXXX</code>).</li>
                <li>Ajoutez le snippet ci-dessous dans <code>index.html</code> juste avant <code>&lt;/head&gt;</code>.</li>
              </ol>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{`<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>`}</pre>
              <Button size="sm" variant="outline" onClick={() => copy(`<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>`, "Snippet GA4")}>
                <Copy className="h-4 w-4 mr-2" /> Copier le snippet
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5 */}
        <TabsContent value="backlinks" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Annuaires gratuits — Soumission recommandée</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {BACKLINKS.map((b) => (
                <div key={b.name} className="flex items-start justify-between gap-4 border-b pb-3 last:border-0">
                  <div>
                    <p className="font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.desc}</p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a href={b.url} target="_blank" rel="noopener noreferrer">
                      Soumettre <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
