import Image from "next/image";

export function Mark({ size = 36 }: { size?: number }) {
  return (
    <Image
      src="/images/tamreen-logo.png"
      alt=""
      width={size}
      height={size}
      className="rounded-xl"
      priority
    />
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
