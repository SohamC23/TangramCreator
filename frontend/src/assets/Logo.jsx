export function Logo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <polygon points="2,2 12,2 2,12" fill="#6C5CE7" />
      <polygon points="12,2 22,2 22,12" fill="#00B894" />
      <polygon points="2,12 2,22 12,22" fill="#E17055" />
      <polygon points="12,12 22,12 12,22" fill="#0984E3" />
    </svg>
  );
}
