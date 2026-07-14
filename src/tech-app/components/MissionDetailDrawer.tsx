/**
 * MissionDetailDrawer — Quick-view drawer for a technician assignment.
 * Pure UI — links out to /tech/installation/:id for full workflow.
 * Uses shadcn Sheet + tech-core.css primitives.
 */
import { Link } from "react-router-dom";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  MapPin, Phone, Mail, Wrench, Package, Clock, ChevronRight,
  Navigation, MessageSquare, FileText, User,
} from "lucide-react";
import type { ComponentType } from "react";

interface Mission {
  id: string;
  client_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  client_address?: string | null;
  service_type?: string | null;
  category?: string | null;
  status: string;
  scheduled_date?: string | null;
  scheduled_time_start?: string | null;
  scheduled_time_end?: string | null;
  order_number?: string | null;
  appointment_number?: string | null;
  internal_notes?: string | null;
  order_items?: Array<{ plan_name?: string | null; description?: string | null; quantity?: number | null }>;
}

interface Props {
  mission: Mission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_LABELS: Record<string, { label: string; variant: string }> = {
  scheduled:   { label: "Planifié",  variant: "is-offline" },
  accepted:    { label: "Accepté",   variant: "is-available" },
  confirmed:   { label: "Confirmé",  variant: "is-available" },
  en_route:    { label: "En route",  variant: "is-route" },
  arrived:     { label: "Sur place", variant: "is-route" },
  in_progress: { label: "En cours",  variant: "is-route" },
  completed:   { label: "Terminé",   variant: "is-available" },
  cancelled:   { label: "Annulé",    variant: "is-offline" },
  missed:      { label: "Manqué",    variant: "is-pause" },
  no_show:     { label: "Absent",    variant: "is-pause" },
};

function Row({ icon: Icon, label, value, href }: { icon: ComponentType<{ className?: string }>; label: string; value: string | null | undefined; href?: string }) {
  if (!value) return null;
  const inner = (
    <>
      <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "hsl(var(--muted))" }}>
        <Icon className="h-4 w-4" style={{ color: "hsl(var(--muted-foreground))" }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>{label}</p>
        <p className="text-[13.5px] font-medium mt-0.5 break-words" style={{ color: "hsl(var(--foreground))" }}>{value}</p>
      </div>
      {href && <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />}
    </>
  );
  const base = "flex items-center gap-3 py-2.5";
  return href
    ? <a href={href} className={`${base} tc-focus-ring rounded-lg hover:bg-[hsl(var(--accent))] px-2 -mx-2`}>{inner}</a>
    : <div className={base}>{inner}</div>;
}

export default function MissionDetailDrawer({ mission, open, onOpenChange }: Props) {
  if (!mission) return null;
  const status = STATUS_LABELS[mission.status] ?? { label: mission.status, variant: "is-offline" };
  const timeLabel = [mission.scheduled_time_start?.slice(0, 5), mission.scheduled_time_end?.slice(0, 5)].filter(Boolean).join(" – ") || "Heure non fixée";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto p-0"
        style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
      >
        <div className="p-5 border-b" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`tc-pill ${status.variant}`}><span className="tc-pill-dot" />{status.label}</span>
            {mission.order_number && (
              <span className="text-[11px] font-medium tc-tabular" style={{ color: "hsl(var(--muted-foreground))" }}>
                #{mission.order_number}
              </span>
            )}
          </div>
          <SheetHeader className="text-left space-y-1">
            <SheetTitle className="text-[22px] font-bold tracking-tight" style={{ color: "hsl(var(--foreground))" }}>
              {mission.client_name || "Client"}
            </SheetTitle>
            <SheetDescription className="flex items-center gap-1.5 text-[13px]" style={{ color: "hsl(var(--muted-foreground))" }}>
              <Clock className="h-3.5 w-3.5" /> {mission.scheduled_date} · {timeLabel}
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2 p-4">
          {mission.client_phone && (
            <a href={`tel:${mission.client_phone}`} className="tc-btn tc-btn-ghost h-11 flex-col gap-0.5 !p-2">
              <Phone className="h-4 w-4" />
              <span className="text-[10.5px] font-semibold">Appeler</span>
            </a>
          )}
          {mission.client_address && (
            <a
              href={`https://maps.apple.com/?daddr=${encodeURIComponent(mission.client_address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tc-btn tc-btn-ghost h-11 flex-col gap-0.5 !p-2"
            >
              <Navigation className="h-4 w-4" />
              <span className="text-[10.5px] font-semibold">Itinéraire</span>
            </a>
          )}
          <Link to={`/tech/installation/${mission.id}`} className="tc-btn tc-btn-primary h-11 flex-col gap-0.5 !p-2">
            <Wrench className="h-4 w-4" />
            <span className="text-[10.5px] font-semibold">Ouvrir</span>
          </Link>
        </div>

        {/* Details */}
        <div className="px-5 pb-5 space-y-4">
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
              Coordonnées
            </h3>
            <div className="tc-surface p-3 divide-y" style={{ borderColor: "hsl(var(--border))" }}>
              <Row icon={User} label="Client" value={mission.client_name} />
              <Row icon={MapPin} label="Adresse" value={mission.client_address} />
              <Row icon={Phone} label="Téléphone" value={mission.client_phone} href={mission.client_phone ? `tel:${mission.client_phone}` : undefined} />
              <Row icon={Mail} label="Courriel" value={mission.client_email} href={mission.client_email ? `mailto:${mission.client_email}` : undefined} />
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
              Service
            </h3>
            <div className="tc-surface p-3 divide-y" style={{ borderColor: "hsl(var(--border))" }}>
              <Row icon={Wrench} label="Type" value={mission.service_type || mission.category} />
              <Row icon={FileText} label="RDV" value={mission.appointment_number} />
            </div>
          </section>

          {(mission.order_items && mission.order_items.length > 0) && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                Équipements & services commandés
              </h3>
              <div className="tc-surface p-2 space-y-1">
                {mission.order_items.map((it, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: "hsl(var(--muted) / 0.4)" }}>
                    <Package className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--primary-glow))" }} />
                    <span className="flex-1 text-[13px] font-medium truncate" style={{ color: "hsl(var(--foreground))" }}>
                      {it.plan_name || it.description || "Item"}
                    </span>
                    {(it.quantity ?? 0) > 1 && (
                      <span className="text-[12px] tc-tabular font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>
                        ×{it.quantity}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {mission.internal_notes && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                Instructions / notes
              </h3>
              <div className="tc-surface p-3">
                <p className="text-[13px] whitespace-pre-wrap" style={{ color: "hsl(var(--foreground))" }}>
                  {mission.internal_notes}
                </p>
              </div>
            </section>
          )}

          <section className="pt-2 grid grid-cols-2 gap-2">
            <Link to="/tech/chat" className="tc-btn tc-btn-ghost">
              <MessageSquare className="h-4 w-4" />
              Contacter dispatch
            </Link>
            <Link to={`/tech/installation/${mission.id}`} className="tc-btn tc-btn-primary">
              Ouvrir la mission
              <ChevronRight className="h-4 w-4" />
            </Link>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
