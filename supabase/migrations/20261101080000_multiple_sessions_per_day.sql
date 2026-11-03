alter table public.athlete_profiles
  add column if not exists multiple_sessions_per_day boolean not null default false;

comment on column public.athlete_profiles.multiple_sessions_per_day is
  'True when the athlete is comfortable with two workouts on the same day.';
