export function AuraLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180">
      <circle cx="90" cy="90" r="48" fill="none" stroke="#0F6E56" strokeWidth="8" opacity="0.4" />
      <circle cx="90" cy="90" r="30" fill="none" stroke="#0F6E56" strokeWidth="10" opacity="0.6" />
      <circle cx="90" cy="90" r="12" fill="#0F6E56" />
    </svg>
  );
}
