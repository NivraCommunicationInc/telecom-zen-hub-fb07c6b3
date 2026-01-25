/**
 * ClientPortalBackground - Premium professional telecom ISP background
 * Corporate telecom portal background (token-based, no hardcoded colors)
 */
const ClientPortalBackground = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient - token based */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--background)) 40%, hsl(var(--card)) 100%)",
        }}
      />
      
      {/* Subtle noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Grid overlay - subtle tech feel */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--primary) / 0.14) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--primary) / 0.10) 1px, transparent 1px)
          `,
          backgroundSize: '96px 96px',
        }}
      />
      
      {/* Accent glows - restrained, corporate */}
      <div
        className="absolute -top-40 -right-40 h-[680px] w-[680px] rounded-full blur-[120px]"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, hsl(var(--primary) / 0.18) 0%, transparent 60%)",
        }}
      />
      <div
        className="absolute -bottom-48 -left-48 h-[720px] w-[720px] rounded-full blur-[140px]"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, hsl(var(--accent) / 0.14) 0%, transparent 62%)",
        }}
      />
      
      {/* Connection lines - professional network aesthetic */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="portalLineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
            <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="15%" x2="100%" y2="45%" stroke="url(#portalLineGradient)" strokeWidth="1" />
        <line x1="0" y1="35%" x2="100%" y2="65%" stroke="url(#portalLineGradient)" strokeWidth="1" />
        <line x1="0" y1="55%" x2="100%" y2="85%" stroke="url(#portalLineGradient)" strokeWidth="1" />
        <line x1="0" y1="75%" x2="100%" y2="100%" stroke="url(#portalLineGradient)" strokeWidth="1" />
      </svg>
      
      {/* Edge vignette for depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--background) / 0.10) 0%, hsl(var(--background) / 0.45) 72%, hsl(var(--background) / 0.85) 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, hsl(var(--background) / 0.65) 0%, transparent 22%, transparent 78%, hsl(var(--background) / 0.65) 100%)",
        }}
      />
    </div>
  );
};

export default ClientPortalBackground;
