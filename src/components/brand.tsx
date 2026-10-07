export function Mark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#8A1538" />
      <path d="M16 18h32M32 18v28" stroke="#F7F4F2" strokeWidth="6" strokeLinecap="round" />
      <path d="M18 46h28" stroke="#C9A876" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-3 font-bold tracking-tight">
      <Mark />
      <span>TAMREEN AI</span>
    </span>
  );
}
