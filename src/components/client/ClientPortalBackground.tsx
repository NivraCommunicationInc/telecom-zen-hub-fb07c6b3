/**
 * ClientPortalBackground - Professional telecom ISP background for client portal
 * Clean, modern design with subtle animated elements
 */
const ClientPortalBackground = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient - Navy to deep blue */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950" />
      
      {/* Grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--primary)/0.1) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--primary)/0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
      
      {/* Accent orbs */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-cyan-500/10 via-teal-500/5 to-transparent rounded-full blur-3xl animate-pulse" 
           style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-blue-600/10 via-indigo-500/5 to-transparent rounded-full blur-3xl animate-pulse"
           style={{ animationDuration: '10s', animationDelay: '2s' }} />
      
      {/* Connection lines - Telecom aesthetic */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="20%" x2="100%" y2="60%" stroke="url(#lineGradient)" strokeWidth="1" />
        <line x1="0" y1="40%" x2="100%" y2="80%" stroke="url(#lineGradient)" strokeWidth="1" />
        <line x1="0" y1="60%" x2="100%" y2="100%" stroke="url(#lineGradient)" strokeWidth="1" />
      </svg>
      
      {/* Vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40" />
    </div>
  );
};

export default ClientPortalBackground;
