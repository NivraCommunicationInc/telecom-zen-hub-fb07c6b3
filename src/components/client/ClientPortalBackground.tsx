/**
 * ClientPortalBackground - Professional light theme telecom ISP background
 * Clean white/light gray with subtle teal accents
 */
const ClientPortalBackground = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base - Clean light gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, hsl(210 20% 98%) 0%, hsl(210 20% 96%) 50%, hsl(210 15% 94%) 100%)",
        }}
      />
      
      {/* Subtle grid pattern for professional tech feel */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(168 76% 36% / 0.15) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(168 76% 36% / 0.10) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />
      
      {/* Soft accent glow - top right (teal) */}
      <div
        className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full blur-[120px]"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, hsl(168 76% 42% / 0.08) 0%, transparent 70%)",
        }}
      />
      
      {/* Soft accent glow - bottom left */}
      <div
        className="absolute -bottom-32 -left-32 h-[450px] w-[450px] rounded-full blur-[100px]"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, hsl(168 76% 42% / 0.06) 0%, transparent 70%)",
        }}
      />
    </div>
  );
};

export default ClientPortalBackground;
