-- Multi-event training: event distances, priority, status, and session–event links.
-- Additive and reversible. Existing events remain valid.

alter table public.events
  add column if not exists swim_m numeric,
  add column if not exists bike_m numeric,
  add column if not exists run_m numeric,
  add column if not exists template_slug text,
  add column if not exists priority text not null default 'primary'
    check (priority in ('primary', 'secondary', 'practice')),
  add column if not exists status text not null default 'active'
    check (status in ('active', 'completed', 'cancelled')),
  add column if not exists experience_level text
    check (experience_level is null or experience_level in ('beginner', 'intermediate', 'advanced')),
  add column if not exists athlete_notes text not null default '',
  add column if not exists target_finish_label text;

comment on column public.events.swim_m is 'Triathlon or open-water swim distance in metres.';
comment on column public.events.bike_m is 'Cycling leg distance in metres.';
comment on column public.events.run_m is 'Running leg or race distance in metres when distinct from distance_m.';
comment on column public.events.priority is 'primary = A-race, secondary = B-race, practice = tune-up.';

create index if not exists events_owner_active_starts_idx
  on public.events (owner_user_id, starts_on)
  where deleted_at is null and status = 'active';

-- Many-to-many: a workout can support multiple event goals.
create table if not exists public.session_event_links (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  contribution text not null default 'supporting'
    check (contribution in ('primary', 'supporting', 'shared')),
  rationale text not null default '',
  created_at timestamptz not null default now(),
  unique (workout_id, event_id)
);

create index if not exists session_event_links_user_idx on public.session_event_links (user_id);
create index if not exists session_event_links_event_idx on public.session_event_links (event_id);

alter table public.session_event_links enable row level security;
alter table public.session_event_links force row level security;

create policy session_event_links_select on public.session_event_links
  for select to authenticated
  using (user_id = auth.uid() or private.can_read_athlete(user_id));

create policy session_event_links_insert on public.session_event_links
  for insert to authenticated
  with check (user_id = auth.uid());

create policy session_event_links_update on public.session_event_links
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy session_event_links_delete on public.session_event_links
  for delete to authenticated
  using (user_id = auth.uid());

-- Optional post-workout feedback used by adaptive scheduling.
alter table public.completed_workouts
  add column if not exists completed_as_planned boolean,
  add column if not exists fatigue_after smallint check (fatigue_after is null or fatigue_after between 1 and 5),
  add column if not exists pain_reported boolean not null default false,
  add column if not exists athlete_feedback text not null default '';

-- Plan revision source tagging for multi-event edits.
alter table public.plan_revisions
  add column if not exists source text not null default 'system'
    check (source in ('system', 'athlete', 'coach', 'ai', 'event_edit', 'optimize', 'weekly_review')),
  add column if not exists approval_status text not null default 'applied'
    check (approval_status in ('pending', 'approved', 'rejected', 'applied', 'rolled_back'));
