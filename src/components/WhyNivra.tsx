import { Shield, Zap, Headphones, CheckCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const WhyNivra = () => {
  const { t } = useLanguage();

  const points = [
    { icon: Shield, titleKey: "why.nocontract", textKey: "why.nocontract.desc", accent: '#7C3AED' },
    { icon: CheckCircle, titleKey: "why.simple", textKey: "why.simple.desc", accent: '#7C3AED' },
    { icon: Headphones, titleKey: "why.support", textKey: "why.support.desc", accent: '#7C3AED' },
    { icon: Zap, titleKey: "why.fast", textKey: "why.fast.desc", accent: '#7C3AED' },
  ];

  return (
    <section style={{ background: '#0A0A18', padding: '80px 0' }}>
      <div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">

        {/* Section header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-4" style={{
            background: 'rgba(124,58,237,0.12)',
            border: '1px solid rgba(124,58,237,0.3)',
            borderRadius: 999,
          }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#A78BFA' }} />
            <span className="font-bold uppercase" style={{ color: '#C4B5FD', fontSize: 10.5, letterSpacing: 1.6 }}>
              {t('why.title')}
            </span>
          </div>
          <h2
            className="font-bold text-white"
            style={{
              fontSize: 'clamp(26px, 4vw, 40px)',
              letterSpacing: '-1px',
              lineHeight: 1.1,
            }}
          >
            {t('why.title')}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-[1080px] mx-auto">
          {points.map((p) => (
            <div
              key={p.titleKey}
              className="group cursor-default"
              style={{
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 16,
                padding: '28px 24px',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(124,58,237,0.2)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.35)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              }}
            >
              <div style={{
                width: 48, height: 48,
                borderRadius: 12,
                background: 'rgba(124,58,237,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 18,
                transition: 'background 0.2s',
              }}>
                <p.icon className="w-5 h-5" style={{ color: '#A78BFA' }} strokeWidth={2} />
              </div>
              <h3 className="font-bold mb-2 text-white" style={{ fontSize: 15, lineHeight: 1.3 }}>
                {t(p.titleKey)}
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13.5, lineHeight: 1.6 }}>
                {t(p.textKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyNivra;
