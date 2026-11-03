import { initials } from "@/lib/portrait";

export function AvatarMark({
  name,
  src,
  size = 40,
}: {
  name: string;
  src: string | null;
  size?: number;
}) {
  const style = { width: size, height: size };
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt="" src={src} referrerPolicy="no-referrer" className="rounded-full object-cover" style={style} />
    );
  }
  return (
    <span className="grid place-items-center rounded-full bg-maroon text-xs font-extrabold text-white" style={style}>
      {initials(name)}
    </span>
  );
}
