import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Film, Music, Tv, Check, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend";
import type { StreamingCatalogItem } from "@/hooks/useStreamingCatalog";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";

const BG = '#020209';
const VIOLET = '#7C3AED';
const CYAN = '#06B6D4';
const VIOLET_LIGHT = '#A78BFA';

const categoryLabels: Record<string, { en: string; fr: string }> = {
  video: { en: "Video", fr: "Vidéo" },
  music: { en: "Music", fr: "Musique" },
};

const StreamingPlans = () => {
  const { language } = useLanguage();
  const { data: services, isLoading } = useQuery({
    queryKey: ["public-streaming-catalog"],
    queryFn: async () => {
      const { data, error } = await backendClient
        .from("streaming_catalog_public")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as StreamingCatalogItem[];
    },
    staleTime: 30000,
  });

  const videoServices = services?.filter(s => s.category === "video") || [];
  const musicServices = services?.filter(s => s.category === "music") || [];

  const texts = {
    en: {
      title: "Streaming+ Plans",
      subtitle: "All your favorite streaming services, one simple subscription",
      videoTitle: "Video Streaming",
      musicTitle: "Music Streaming",
      perMonth: "/month",
      subscribe: "Subscribe",
      noServices: "No streaming services available at the moment",
      loading: "Loading services...",
      bundleTitle: "Bundle & Save",
      bundleDesc: "Combine Streaming+ with Internet, TV, or Mobile for exclusive discounts!",
      viewPlans: "View Plans",
    },
    fr: {
      title: "Forfaits Streaming+",
      subtitle: "Tous vos services de streaming préférés, un seul abonnement simple",
      videoTitle: "Streaming Vidéo",
      musicTitle: "Streaming Musique",
      perMonth: "/mois",
      subscribe: "S'abonner",
      noServices: "Aucun service de streaming disponible pour le moment",
      loading: "Chargement des services...",
      bundleTitle: "Combinez et économisez",
      bundleDesc: "Combinez Streaming+ avec Internet, TV ou Mobile pour des rabais exclusifs!",
      viewPlans: "Voir les forfaits",
    },
  };

  const t = texts[language];

  const CategoryIcon = ({ category }: { category: string }) => {
    const isMusic = category === 'music';
    const color = isMusic ? CYAN : VIOLET_LIGHT;
    const bg = isMusic ? 'rgba(6,182,212,0.15)' : 'rgba(124,58,237,0.15)';
    const Icon = category === "video" ? Film : category === "music" ? Music : Tv;
    return (
      <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon style={{ width: 20, height: 20, color }} />
      </div>
    );
  };

  const ServiceCard = ({ service }: { service: StreamingCatalogItem }) => {
    const [hovered, setHovered] = useState(false);
    const isMusic = service.category === 'music';
    const accentColor = isMusic ? CYAN : VIOLET;
    return (
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: hovered ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${hovered ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 16,
          padding: 24,
          backdropFilter: 'blur(24px)',
          transition: 'all 0.3s ease',
          transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column' as const,
          cursor: 'default',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <CategoryIcon category={service.category} />
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: '#fff' }}>{service.name}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: isMusic ? CYAN : VIOLET_LIGHT, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {categoryLabels[service.category]?.[language] || service.category}
            </div>
          </div>
        </div>

        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 16, lineHeight: 1.6, flex: 1 }}>{service.description}</p>

        {Array.isArray(service.features) && service.features.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {service.features.map((feature, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <Check style={{ width: 14, height: 14, color: '#10B981', marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{feature}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", color: accentColor }}>
              ${service.price_monthly.toFixed(2)}
            </span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginLeft: 2 }}>{t.perMonth}</span>
          </div>
          <Link
            to="/portal/auth"
            style={{
              background: `linear-gradient(135deg, ${VIOLET}, ${CYAN})`,
              color: '#fff',
              borderRadius: 10,
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "'Space Grotesk', sans-serif",
              textDecoration: 'none',
              display: 'inline-block',
              transition: 'opacity 0.2s',
            }}
          >
            {t.subscribe}
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: BG, minHeight: '100vh' }}>
      <SEOHead {...SEO_DATA.streaming} />
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ paddingTop: 120, paddingBottom: 80 }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)', animation: 'n-aurora-1 18s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', animation: 'n-aurora-2 14s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)', backgroundSize: '80px 80px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.4), rgba(6,182,212,0.4), transparent)', animation: 'n-scanline 10s linear infinite', pointerEvents: 'none' }} />

        <div className="container mx-auto px-4 text-center" style={{ position: 'relative', zIndex: 2 }}>
          <div className="n-animate-in" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 100, padding: '6px 16px', marginBottom: 24 }}>
            <Sparkles style={{ width: 14, height: 14, color: VIOLET }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: VIOLET_LIGHT, letterSpacing: '0.08em' }}>STREAMING+</span>
          </div>
          <h1 className="n-animate-in-delay-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(36px, 5.5vw, 64px)', letterSpacing: '-2.5px', lineHeight: 1.0, marginBottom: 16, color: '#fff' }}>
            {language === 'fr' ? (
              <>Forfaits{' '}<span className="n-shimmer-text">Streaming+</span></>
            ) : (
              <><span className="n-shimmer-text">Streaming+</span>{' '}Plans</>
            )}
          </h1>
          <p className="n-animate-in-delay-2" style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', maxWidth: 560, margin: '0 auto' }}>
            {t.subtitle}
          </p>
        </div>
      </section>

      <main className="container mx-auto px-4" style={{ paddingBottom: 80 }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div className="animate-spin" style={{ width: 48, height: 48, borderRadius: '50%', border: `3px solid rgba(124,58,237,0.2)`, borderTopColor: VIOLET, margin: '0 auto 16px' }} />
            <p style={{ color: 'rgba(255,255,255,0.5)' }}>{t.loading}</p>
          </div>
        ) : !services || services.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <Tv style={{ width: 64, height: 64, color: 'rgba(255,255,255,0.2)', margin: '0 auto 16px' }} />
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18 }}>{t.noServices}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
            {videoServices.length > 0 && (
              <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Film style={{ width: 18, height: 18, color: VIOLET_LIGHT }} />
                  </div>
                  <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 24, color: '#fff', margin: 0 }}>{t.videoTitle}</h2>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {videoServices.map((service) => (
                    <ServiceCard key={service.id} service={service} />
                  ))}
                </div>
              </section>
            )}

            {musicServices.length > 0 && (
              <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(6,182,212,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Music style={{ width: 18, height: 18, color: CYAN }} />
                  </div>
                  <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 24, color: '#fff', margin: 0 }}>{t.musicTitle}</h2>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {musicServices.map((service) => (
                    <ServiceCard key={service.id} service={service} />
                  ))}
                </div>
              </section>
            )}

            {/* Bundle CTA */}
            <section style={{ marginTop: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 20, padding: '48px 32px', textAlign: 'center', backdropFilter: 'blur(24px)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-30%', left: '50%', transform: 'translateX(-50%)', width: 400, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 28, color: '#fff', marginBottom: 12 }}>{t.bundleTitle}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.6)', maxWidth: 480, margin: '0 auto 32px' }}>
                    {t.bundleDesc}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16 }}>
                    {[
                      { to: '/internet', label: `${t.viewPlans} — Internet` },
                      { to: '/tv', label: `${t.viewPlans} — TV` },
                      { to: '/mobile', label: `${t.viewPlans} — Mobile` },
                    ].map(({ to, label }) => (
                      <Link
                        key={to}
                        to={to}
                        style={{
                          background: 'rgba(124,58,237,0.12)',
                          border: '1px solid rgba(124,58,237,0.35)',
                          color: VIOLET_LIGHT,
                          borderRadius: 12,
                          padding: '10px 24px',
                          fontSize: 14,
                          fontWeight: 600,
                          fontFamily: "'Space Grotesk', sans-serif",
                          textDecoration: 'none',
                          display: 'inline-block',
                          transition: 'all 0.2s',
                        }}
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default StreamingPlans;
