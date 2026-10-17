import Image from "next/image";
import { cn } from "@/lib/utils";

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

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold tracking-tight sm:gap-3", className)}>
      <Mark />
      <span>TAMREEN AI</span>
    </span>
  );
}
