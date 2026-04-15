export function LogoIcon({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="40" height="40" rx="10" fill="#1a3a6a"/>
      <path d="M10 30V10L20 24L30 10V30" stroke="#d4a843" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="20" cy="20" r="3" fill="#d4a843"/>
    </svg>
  );
}
