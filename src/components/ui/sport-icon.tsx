import {
  Bike,
  Dumbbell,
  Footprints,
  HeartPulse,
  Layers,
  PersonStanding,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const sportIcons: Record<string, LucideIcon> = {
  strength: Dumbbell,
  bodybuilding: Dumbbell,
  running: Footprints,
  cycling: Bike,
  swimming: Waves,
  triathlon: Layers,
  brick: Layers,
  mobility: PersonStanding,
  recovery: HeartPulse,
  football: PersonStanding,
  padel: PersonStanding,
  basketball: PersonStanding,
  tennis: PersonStanding,
  volleyball: PersonStanding,
  pickleball: PersonStanding,
  badminton: PersonStanding,
  cricket: PersonStanding,
};

export function SportIcon({
  sport,
  size = 16,
  className,
}: {
  sport: string;
  size?: number;
  className?: string;
}) {
  const Icon = sportIcons[sport] ?? Dumbbell;
  return <Icon size={size} strokeWidth={1.75} className={cn("shrink-0", className)} aria-hidden />;
}
