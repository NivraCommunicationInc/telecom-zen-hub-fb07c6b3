export function LogoFull({ height = 36, className = '' }: { height?: number; className?: string }) {
  return (
    <svg height={height} viewBox="0 0 180 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="40" height="40" rx="10" fill="#1a3a6a"/>
      <path d="M10 30V10L20 24L30 10V30" stroke="#d4a843" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="20" cy="20" r="3" fill="#d4a843"/>
      <text x="50" y="17" fontFamily="Inter, sans-serif" fontSize="15" fontWeight="700" fill="#ffffff">NIVRA</text>
      <text x="50" y="32" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="400" fill="#d4a843" letterSpacing="3">TELECOM</text>
    </svg>
  );
}
