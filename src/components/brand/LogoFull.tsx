export function LogoFull({ height = 36, className = '' }: { height?: number; className?: string }) {
  return (
    <svg height={height} viewBox="0 0 180 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="40" height="40" rx="10" fill="#7c3aed"/>
      <text x="20" y="28" textAnchor="middle" fontFamily="Helvetica, Arial, system-ui, sans-serif" fontSize="24" fontWeight="700" fill="#ffffff">N</text>
      <text x="52" y="20" fontFamily="Helvetica, Arial, system-ui, sans-serif" fontSize="15" fontWeight="700" fill="currentColor">NIVRA</text>
      <text x="52" y="33" fontFamily="Helvetica, Arial, system-ui, sans-serif" fontSize="10" fontWeight="500" fill="#7c3aed" letterSpacing="2">TELECOM</text>
    </svg>
  );
}
