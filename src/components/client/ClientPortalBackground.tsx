/**
 * ClientPortalBackground - Premium professional telecom ISP background
 * Elegant navy/slate dark theme with sophisticated animated elements
 */
const ClientPortalBackground = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient - Deep navy professional */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0f1a] via-[#0d1526] to-[#0f1a2e]" />
      
      {/* Subtle noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Grid overlay - subtle tech feel */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(34, 211, 238, 0.3) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(34, 211, 238, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />
      
      {/* Primary glow orb - top right */}
      <div 
        className="absolute -top-32 -right-32 w-[700px] h-[700px] rounded-full blur-[120px] opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.4) 0%, rgba(20, 184, 166, 0.2) 40%, transparent 70%)',
          animation: 'pulse 12s ease-in-out infinite',
        }}
      />
      
      {/* Secondary glow orb - bottom left */}
      <div 
        className="absolute -bottom-48 -left-48 w-[600px] h-[600px] rounded-full blur-[100px] opacity-15"
        style={{
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, rgba(99, 102, 241, 0.2) 50%, transparent 70%)',
          animation: 'pulse 15s ease-in-out infinite',
          animationDelay: '3s',
        }}
      />
      
      {/* Accent glow - center */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full blur-[150px] opacity-[0.08]"
        style={{
          background: 'radial-gradient(ellipse, rgba(34, 211, 238, 0.3) 0%, transparent 60%)',
        }}
      />
      
      {/* Connection lines - professional network aesthetic */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.02]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="portalLineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="15%" x2="100%" y2="45%" stroke="url(#portalLineGradient)" strokeWidth="1" />
        <line x1="0" y1="35%" x2="100%" y2="65%" stroke="url(#portalLineGradient)" strokeWidth="1" />
        <line x1="0" y1="55%" x2="100%" y2="85%" stroke="url(#portalLineGradient)" strokeWidth="1" />
        <line x1="0" y1="75%" x2="100%" y2="100%" stroke="url(#portalLineGradient)" strokeWidth="1" />
      </svg>
      
      {/* Edge vignette for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1a]/90 via-transparent to-[#0a0f1a]/50" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f1a]/30 via-transparent to-[#0a0f1a]/30" />
    </div>
  );
};

export default ClientPortalBackground;
