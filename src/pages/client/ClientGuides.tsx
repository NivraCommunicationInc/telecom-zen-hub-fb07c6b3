/**
 * Client Guides & Documents page
 * Public installation PDFs from the `installation-guides` storage bucket.
 * TV terminal guides only show when client has TV in any of their orders.
 */
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Wifi, Tv } from "lucide-react";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET_BASE = `${SUPABASE_URL}/storage/v1/object/public/installation-guides`;

const TV_KEYWORDS = ["terminal", "tv", "télé", "tele", "television", "télévision"];

interface GuideItem {
  filename: string;
  title: string;
  language: string;
  type: "wifi" | "tv";
}

const GUIDES: GuideItem[] = [
  { filename: "guide-borne-nivra-wifi-fr.pdf", title: "Borne Nivra WiFi", language: "Français", type: "wifi" },
  { filename: "guide-borne-nivra-wifi-en.pdf", title: "Borne Nivra WiFi", language: "English", type: "wifi" },
  { filename: "guide-terminal-nivra-tv-fr.pdf", title: "Terminal Nivra TV", language: "Français", type: "tv" },
  { filename: "guide-terminal-nivra-tv-en.pdf", title: "Terminal Nivra TV", language: "English", type: "tv" },
];

const ClientGuides = () => {
  const { user } = useClientAuth();
  const { data: canonical } = useCanonicalClientData(user?.id);

  const tvSources = [
    ...(canonical?.orders || []),
    ...(canonical?.orderItems || []),
    ...(canonical?.subscriptions || []),
    ...(canonical?.serviceInstances || []),
  ];
  const hasTv = tvSources
    .flatMap((item: any) => [item.plan_name, item.service_type, item.description, item.service_category, item.plan_type, item.product_type])
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
    .some((value) => TV_KEYWORDS.some((keyword) => value.includes(keyword)));

  const visibleGuides = GUIDES.filter(g => g.type === "wifi" || hasTv);

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Guides &amp; Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Téléchargez les guides d'installation officiels de Nivra Telecom.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Guides d'installation</CardTitle>
            <CardDescription>
              {hasTv
                ? "Vos guides Borne WiFi et Terminal TV sont disponibles ci-dessous."
                : "Téléchargez les guides pour votre Borne Nivra WiFi."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {visibleGuides.map(guide => {
              const url = `${BUCKET_BASE}/${guide.filename}`;
              const Icon = guide.type === "wifi" ? Wifi : Tv;
              const downloadLabel = guide.language === "English" ? "Download PDF" : "Télécharger PDF";
              return (
                <div
                  key={guide.filename}
                  className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {guide.title} — {guide.language}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <FileText className="h-3 w-3" /> PDF
                      </p>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline" className="flex-shrink-0">
                    <a href={url} target="_blank" rel="noopener noreferrer" download>
                      <Download className="h-4 w-4 mr-2" />
                      {downloadLabel}
                    </a>
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
};

export default ClientGuides;
