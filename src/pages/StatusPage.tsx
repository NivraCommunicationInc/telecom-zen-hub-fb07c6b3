import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PhotoBg } from "@/components/PhotoBg";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Wrench,
  Clock,
  Wifi,
  Tv,
  Smartphone,
  Film,
  Globe,
  CreditCard,
  Server,
  RefreshCw,
  Activity,
  Shield,
  ChevronRight,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { format, formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { useState } from "react";

const serviceIcons: Record<string, any> = {
  internet: Wifi,
  tv: Tv,
  mobile: Smartphone,
  streaming: Film,
  portal: Globe,
  billing: CreditCard,
};

const serviceStatusConfig: Record<string, { label: string; labelEn: string; accent: string; bg: string; border: string }> = {
  operational:    { label: "Opérationnel",          labelEn: "Operational",       accent: "#10B981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.3)"  },
  degraded:       { label: "Performance dégradée",  labelEn: "Degraded",          accent: "#F59E0B", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.3)"  },
  partial_outage: { label: "Panne partielle",       labelEn: "Partial Outage",    accent: "#F97316", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.3)"  },
  major_outage:   { label: "Panne majeure",         labelEn: "Major Outage",      accent: "#EF4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.3)"   },
  maintenance:    { label: "Maintenance en cours",  labelEn: "Under Maintenance", accent: "#3B82F6", bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.3)"  },
};

const StatusPage = () => {
  const { language } = useLanguage();
  const isFr = language === "fr";
  const dateLocale = isFr ? fr : enUS;
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Fetch service status from DB
  const { data: services, refetch: refetchServices } = useQuery({
    queryKey: ["public-service-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_status")
        .select("*")
        .order("display_name");
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  // Resolved incidents in the last 30 days — shown as transparency history
  // so customers can see Nivra acknowledges and resolves incidents.
  const { data: incidents } = useQuery({
    queryKey: ["public-service-incidents"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
      const { data, error } = await supabase
        .from("service_incidents")
        .select(
          "id, service_name, service_display_name, status_at_incident, incident_title, incident_message, started_at, resolved_at, duration_minutes",
        )
        .not("resolved_at", "is", null)
        .gte("started_at", thirtyDaysAgo)
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 120_000, // less aggressive — history doesn't change often
  });

  // Live health-check from edge function
  const { data: healthData } = useQuery({
    queryKey: ["health-check-live"],
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/health-check`,
        { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      return res.json();
    },
    refetchInterval: 60000,
    retry: 1,
  });

  const handleRefresh = async () => {
    await refetchServices();
    setLastRefresh(new Date());
  };

  // Calculate stats
  const operationalCount = services?.filter(s => s.status === "operational").length || 0;
  const degradedCount = services?.filter(s => s.status === "degraded").length || 0;
  const maintenanceCount = services?.filter(s => s.status === "maintenance").length || 0;
  const incidentCount = services?.filter(s => s.status === "partial_outage" || s.status === "major_outage").length || 0;
  const totalServices = services?.length || 0;

  // Determine overall status
  const getOverallStatus = () => {
    if (incidentCount > 0) return { label: isFr ? "Incident en cours" : "Ongoing Incident", severity: "critical", icon: AlertCircle };
    if (degradedCount > 0 || maintenanceCount > 0) return { label: isFr ? "Perturbation en cours" : "Service Disruption", severity: "warning", icon: AlertTriangle };
    return { label: isFr ? "Tous les systèmes opérationnels" : "All Systems Operational", severity: "success", icon: CheckCircle };
  };

  const overallStatus = getOverallStatus();

  const ServiceIcon = ({ name, color = "#fff" }: { name: string; color?: string }) => {
    const Icon = serviceIcons[name] || Server;
    return <Icon style={{ width: 18, height: 18, color }} />;
  };

  // Calculate display uptime based on status
  const getDisplayUptime = (service: any) => {
    const baseUptime = service.uptime_percent || 100;
    if (service.status === "operational") return baseUptime;
    if (service.status === "degraded") return Math.min(baseUptime, 97);
    if (service.status === "partial_outage") return Math.min(baseUptime, 85);
    if (service.status === "major_outage") return Math.min(baseUptime, 60);
    if (service.status === "maintenance") return baseUptime;
    return baseUptime;
  };

  const overallBg = overallStatus.severity === "success"
    ? "linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.1) 100%)"
    : overallStatus.severity === "warning"
      ? "linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.1) 100%)"
      : "linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(185,28,28,0.1) 100%)";
  const overallBorder = overallStatus.severity === "success" ? "rgba(16,185,129,0.35)" : overallStatus.severity === "warning" ? "rgba(245,158,11,0.35)" : "rgba(239,68,68,0.35)";
  const overallAccent = overallStatus.severity === "success" ? "#10B981" : overallStatus.severity === "warning" ? "#F59E0B" : "#EF4444";

  return (
    <div style={{ background: '#020209', minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Fiber optic rainbow — network monitoring, vibrant light signals */}
      <PhotoBg url="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80" opacity={0.13} filter="saturate(0.8) brightness(0.6)" />
      <div aria-hidden style={{ position: 'absolute', top: '-15%', right: '-8%', width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.14) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-15%', left: '-6%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.08) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
      <Header />

      <main className="relative flex-1 max-w-[1100px] mx-auto px-5 sm:px-10 w-full" style={{ paddingTop: 100, paddingBottom: 64 }}>
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div style={{ padding: 12, borderRadius: 14, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
              <Activity className="w-7 h-7" style={{ color: '#A78BFA' }} />
            </div>
            <div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(22px, 3vw, 32px)', letterSpacing: '-1px', color: '#fff' }}>
                {isFr ? "État des systèmes" : "System Status"}
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
                {isFr ? "Surveillance et état des services Nivra" : "Nivra services monitoring and status"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
              <Clock className="w-3 h-3" />
              {isFr ? "Dernière vérification:" : "Last check:"} {format(lastRefresh, "HH:mm")}
            </span>
            <button onClick={handleRefresh} className="flex items-center gap-2"
              style={{ height: 38, paddingLeft: 16, paddingRight: 16, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', fontSize: 13, cursor: 'pointer', transition: 'background .2s', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {isFr ? "Actualiser" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Overall Status Banner */}
        <div style={{ borderRadius: 18, background: overallBg, border: `1px solid ${overallBorder}`, padding: '22px 24px', marginBottom: 28, position: 'relative', overflow: 'hidden' }}>
          <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${overallAccent}, transparent)`, pointerEvents: 'none' }} />
          <div className="flex items-center gap-4">
            <div style={{ padding: 12, borderRadius: '50%', background: `${overallAccent}20`, border: `1px solid ${overallAccent}40` }}>
              <overallStatus.icon className="w-7 h-7" style={{ color: overallAccent }} />
            </div>
            <div className="flex-1">
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(16px, 2.5vw, 22px)', color: '#fff', letterSpacing: '-0.5px' }}>
                {overallStatus.label}
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 }}>
                {operationalCount}/{totalServices} {isFr ? "services opérationnels" : "services operational"}
              </p>
            </div>
            <div className="hidden md:flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
              <Shield className="w-3 h-3" />
              {format(lastRefresh, "HH:mm", { locale: dateLocale })}
            </div>
          </div>
        </div>

        {/* Service Status Grid */}
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services?.map((service) => {
              const config = serviceStatusConfig[service.status] || serviceStatusConfig.operational;
              const displayUptime = getDisplayUptime(service);
              return (
                <div key={service.id} style={{ borderRadius: 16, border: `1px solid ${config.border}`, background: config.bg, padding: '18px', backdropFilter: 'blur(12px)', transition: 'box-shadow .2s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 4px 24px ${config.bg}`)}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${config.accent}20`, border: `1px solid ${config.accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ServiceIcon name={service.service_name} color={config.accent} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: '#fff' }}>{service.display_name}</h3>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11.5, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{service.description}</p>
                    </div>
                  </div>
                  <span style={{ display: 'inline-block', background: `${config.accent}20`, border: `1px solid ${config.accent}40`, borderRadius: 999, padding: '3px 10px', color: config.accent, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, marginBottom: 12 }}>
                    {isFr ? config.label : config.labelEn}
                  </span>
                  {service.status_message && (
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '6px 10px' }}>
                      {service.status_message}
                    </p>
                  )}
                  <div className="flex items-center justify-between mb-2" style={{ fontSize: 11 }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: "'JetBrains Mono', monospace" }}>{isFr ? "Disponibilité" : "Uptime"}</span>
                    <span style={{ color: config.accent, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{displayUptime.toFixed(2)}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${displayUptime}%`, borderRadius: 99, background: config.accent, transition: 'width .6s' }} />
                  </div>
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                      {isFr ? "Mis à jour" : "Updated"}{' '}
                      {service.updated_at ? formatDistanceToNow(new Date(service.updated_at), { addSuffix: true, locale: dateLocale }) : '-'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            {[
              { icon: CheckCircle, count: operationalCount, label: isFr ? "Opérationnels" : "Operational", accent: "#10B981" },
              { icon: AlertTriangle, count: degradedCount,   label: isFr ? "Dégradés" : "Degraded",       accent: "#F59E0B" },
              { icon: Wrench,       count: maintenanceCount, label: isFr ? "Maintenance" : "Maintenance", accent: "#3B82F6" },
              { icon: AlertCircle,  count: incidentCount,    label: isFr ? "Incidents" : "Incidents",     accent: "#EF4444" },
            ].map(({ icon: Icon, count, label, accent }) => (
              <div key={label} className="flex items-center gap-3" style={{ borderRadius: 14, border: `1px solid ${accent}25`, background: `${accent}08`, padding: '14px 16px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon className="w-4.5 h-4.5" style={{ color: accent, width: 18, height: 18 }} />
                </div>
                <div>
                  <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 22, color: accent, lineHeight: 1 }}>{count}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace', marginTop: 2" }}>{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent incidents (last 30 days) — transparency history */}
        <div style={{ marginTop: 40 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: '#fff', marginBottom: 16 }}>
            {isFr ? "Incidents récents (30 derniers jours)" : "Recent incidents (last 30 days)"}
          </h2>
          {incidents === undefined && (
            <div style={{ height: 80, borderRadius: 14, background: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s infinite' }} />
          )}
          {incidents !== undefined && incidents.length === 0 && (
            <div style={{ borderRadius: 16, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.07)', padding: '32px 24px', textAlign: 'center' }}>
              <CheckCircle style={{ margin: '0 auto 8px', width: 40, height: 40, color: '#10B981' }} />
              <p style={{ color: '#34D399', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14 }}>
                {isFr ? "Aucun incident résolu au cours des 30 derniers jours." : "No resolved incidents in the last 30 days."}
              </p>
            </div>
          )}
          {incidents && incidents.length > 0 && (
            <div className="space-y-3">
              {incidents.map((inc: any) => (
                <div key={inc.id} style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', padding: '18px 20px' }}>
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: '#fff' }}>{inc.incident_title}</h3>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>{inc.service_display_name ?? inc.service_name}</p>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 999, padding: '3px 10px', color: '#34D399', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                      <CheckCircle className="w-2.5 h-2.5" /> {isFr ? "Résolu" : "Resolved"}
                    </span>
                  </div>
                  {inc.incident_message && (
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 10 }}>{inc.incident_message}</p>
                  )}
                  <div className="flex flex-wrap gap-x-6 gap-y-1" style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: "'JetBrains Mono', monospace" }}>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {isFr ? "Début" : "Started"}: {format(new Date(inc.started_at), "dd MMM HH:mm", { locale: dateLocale })}
                    </span>
                    {inc.resolved_at && (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {isFr ? "Résolu" : "Resolved"}: {format(new Date(inc.resolved_at), "dd MMM HH:mm", { locale: dateLocale })}
                      </span>
                    )}
                    {inc.duration_minutes != null && (
                      <span>
                        {isFr ? "Durée" : "Duration"}: {inc.duration_minutes < 60 ? `${inc.duration_minutes} min` : `${Math.floor(inc.duration_minutes / 60)} h ${inc.duration_minutes % 60} min`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact Support */}
        <div style={{ marginTop: 32, borderRadius: 18, border: '1px solid rgba(124,58,237,0.25)', background: 'linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(6,182,212,0.05) 100%)', padding: '24px 28px' }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: '#fff', marginBottom: 4 }}>
                {isFr ? "Besoin d'aide?" : "Need help?"}
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
                {isFr ? "Notre équipe de support est disponible pour vous aider." : "Our support team is available to help you."}
              </p>
            </div>
            <a href="/nous-joindre" className="inline-flex items-center gap-2"
              style={{ height: 42, padding: '0 22px', borderRadius: 10, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, textDecoration: 'none', flexShrink: 0, transition: 'box-shadow .15s', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 6px 28px rgba(124,58,237,0.6)')}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,58,237,0.4)')}
            >
              {isFr ? "Nous contacter" : "Contact us"}
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default StatusPage;
