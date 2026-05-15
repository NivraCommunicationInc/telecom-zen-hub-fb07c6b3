export function LogoIcon({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="40" height="40" rx="10" fill="#7c3aed"/>
      <text x="20" y="28" textAnchor="middle" fontFamily="Helvetica, Arial, system-ui, sans-serif" fontSize="24" fontWeight="700" fill="#ffffff">N</text>
    </svg>
  );
}
