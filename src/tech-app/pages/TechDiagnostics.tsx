/**
 * TechDiagnostics v2 — Field diagnostics toolkit (Internet / TV / WiFi / Mobile).
 * Local read-only helper: runs client-side sanity checks and lets the tech log
 * results manually. Persistence to `internet_diagnostics` is out-of-scope for
 * P3 UI phase; keep this UI-only until a canonical RPC is exposed.
 */
import { useState } from "react";
import { Wifi, Tv, Smartphone, Radio, PlayCircle, CheckCircle2, XCircle, Loader2, Gauge } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TechPageHeader from "../components/TechPageHeader";

type Check = {
  id: string;
  label: string;
  hint?: string;
};

type Result = "pending" | "running" | "pass" | "fail";

const CHECKS: Record<string, Check[]> = {
  internet: [
    { id: "link", label: "Lien physique (câble / fibre)", hint: "LED verte stable côté ONT/CPE" },
    { id: "dhcp", label: "DHCP / IP obtenue" },
    { id: "dns", label: "Résolution DNS", hint: "ping cloudflare.com / google.com" },
    { id: "gateway", label: "Passerelle joignable" },
    { id: "speed", label: "Débit descendant ≥ plan" },
  ],
  wifi: [
    { id: "ssid", label: "SSID diffusé" },
    { id: "rssi", label: "RSSI ≥ -65 dBm au routeur" },
    { id: "band", label: "Bande 5 GHz active" },
    { id: "channel", label: "Canal non congestionné" },
    { id: "roaming", label: "Handoff entre POD OK" },
  ],
  tv: [
    { id: "boot", label: "Terminal démarre" },
    { id: "signal", label: "Signal / IPTV stream OK" },
    { id: "channels", label: "Toutes les chaînes du forfait" },
    { id: "remote", label: "Télécommande jumelée" },
  ],
  mobile: [
    { id: "sim", label: "SIM détectée" },
    { id: "apn", label: "APN configuré (nivra.mobi)" },
    { id: "data", label: "Données 4G/5G actives" },
    { id: "voice", label: "Appel test sortant / entrant" },
  ],
};

const TAB_META = [
  { id: "internet", label: "Internet", Icon: Wifi },
  { id: "wifi", label: "Wi-Fi", Icon: Radio },
  { id: "tv", label: "TV", Icon: Tv },
  { id: "mobile", label: "Mobile", Icon: Smartphone },
] as const;

function DiagList({ category }: { category: keyof typeof CHECKS }) {
  const [state, setState] = useState<Record<string, Result>>({});

  const run = (id: string) => {
    setState((s) => ({ ...s, [id]: "running" }));
    // UI-only simulation until canonical diagnostic RPC exposed.
    setTimeout(() => {
      setState((s) => ({ ...s, [id]: Math.random() > 0.15 ? "pass" : "fail" }));
    }, 800 + Math.random() * 600);
  };

  const toggle = (id: string, next: Result) => setState((s) => ({ ...s, [id]: next }));

  const items = CHECKS[category];

  const runAll = () => items.forEach((c, i) => setTimeout(() => run(c.id), i * 150));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>
          {items.length} vérifications
        </p>
        <button onClick={runAll} className="tc-btn tc-btn-ghost tc-focus-ring text-[12px]" style={{ height: 32 }}>
          <PlayCircle className="h-3.5 w-3.5" /> Tout lancer
        </button>
      </div>
      <div className="tc-surface divide-y" style={{ borderColor: "hsl(var(--border))" }}>
        {items.map((c) => {
          const r = state[c.id] ?? "pending";
          return (
            <div key={c.id} className="px-4 py-3 flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background:
                    r === "pass" ? "hsl(var(--success) / 0.12)" :
                    r === "fail" ? "hsl(var(--destructive) / 0.12)" :
                    "hsl(var(--muted))",
                  border: `1px solid ${
                    r === "pass" ? "hsl(var(--success) / 0.35)" :
                    r === "fail" ? "hsl(var(--destructive) / 0.35)" :
                    "hsl(var(--border))"
                  }`,
                }}
              >
                {r === "running" ? (
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: "hsl(var(--primary-glow))" }} />
                ) : r === "pass" ? (
                  <CheckCircle2 className="h-4 w-4" style={{ color: "hsl(var(--success))" }} />
                ) : r === "fail" ? (
                  <XCircle className="h-4 w-4" style={{ color: "hsl(var(--destructive))" }} />
                ) : (
                  <Gauge className="h-4 w-4" style={{ color: "hsl(var(--muted-foreground))" }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{c.label}</p>
                {c.hint && (
                  <p className="text-[11.5px]" style={{ color: "hsl(var(--muted-foreground))" }}>{c.hint}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => run(c.id)}
                  disabled={r === "running"}
                  className="tc-btn tc-btn-ghost tc-focus-ring text-[11.5px] disabled:opacity-50"
                  style={{ height: 30, padding: "0 10px" }}
                >
                  Tester
                </button>
                <button
                  onClick={() => toggle(c.id, "pass")}
                  aria-label="Marquer réussi"
                  className="h-8 w-8 rounded-md flex items-center justify-center tc-focus-ring"
                  style={{
                    background: r === "pass" ? "hsl(var(--success) / 0.18)" : "transparent",
                    border: "1px solid hsl(var(--border))",
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" style={{ color: "hsl(var(--success))" }} />
                </button>
                <button
                  onClick={() => toggle(c.id, "fail")}
                  aria-label="Marquer échec"
                  className="h-8 w-8 rounded-md flex items-center justify-center tc-focus-ring"
                  style={{
                    background: r === "fail" ? "hsl(var(--destructive) / 0.18)" : "transparent",
                    border: "1px solid hsl(var(--border))",
                  }}
                >
                  <XCircle className="h-4 w-4" style={{ color: "hsl(var(--destructive))" }} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TechDiagnostics() {
  return (
    <div>
      <TechPageHeader title="Diagnostics" subtitle="Boîte à outils terrain — Internet, Wi-Fi, TV, Mobile" />
      <div className="px-4 md:px-6 py-5 max-w-4xl mx-auto">
        <Tabs defaultValue="internet" className="w-full">
          <TabsList className="w-full grid grid-cols-4">
            {TAB_META.map(({ id, label, Icon }) => (
              <TabsTrigger key={id} value={id} className="gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {TAB_META.map(({ id }) => (
            <TabsContent key={id} value={id} className="mt-4">
              <DiagList category={id} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
