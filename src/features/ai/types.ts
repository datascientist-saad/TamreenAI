export type CoachContextKind = "week" | "workout" | "event" | "change";

export type CoachContextItem = {
  kind: CoachContextKind;
  id?: string;
  label: string;
  detail?: string;
};

export type CoachStarter = {
  id: string;
  label: string;
};

export type CoachReplyAction = {
  label: string;
  href: string;
};

export type CoachProposedChange = {
  date: string;
  title: string;
  sport: string;
  durationMin: number;
  intensity: string;
  why: string;
};
