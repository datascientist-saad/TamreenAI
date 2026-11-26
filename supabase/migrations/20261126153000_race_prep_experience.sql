-- Race Prep experience: start-time, logistics, and per-event prep persistence.
-- Additive and reversible. Existing events remain valid with null/default fields.

alter table public.events
  add column if not exists starts_at timestamptz,
  add column if not exists wave_label text,
  add column if not exists check_in_closes_at timestamptz,
  add column if not exists bib_pickup text not null default '',
  add column if not exists travel_minutes integer
    check (travel_minutes is null or (travel_minutes >= 0 and travel_minutes <= 24 * 60)),
  add column if not exists arrival_buffer_min integer
    check (arrival_buffer_min is null or (arrival_buffer_min >= 0 and arrival_buffer_min <= 24 * 60));

comment on column public.events.starts_at is 'Published or wave start instant (timestamptz). Prefer over starts_on for timelines.';
comment on column public.events.wave_label is 'Wave / corral label when the athlete has a staggered start.';
comment on column public.events.check_in_closes_at is 'Latest check-in / bag drop deadline when known.';
comment on column public.events.bib_pickup is 'Bib pickup location or window notes.';
comment on column public.events.travel_minutes is 'Estimated one-way travel time to the venue in minutes.';
comment on column public.events.arrival_buffer_min is 'Buffer minutes before start or check-in for arrival.';

-- Keep starts_on aligned when starts_at is present (local date may be adjusted in app using events.timezone).
create index if not exists events_owner_starts_at_idx
  on public.events (owner_user_id, starts_at)
  where deleted_at is null and status = 'active';

alter table public.event_preparation
  add column if not exists checklist jsonb not null default '[]'::jsonb,
  add column if not exists race_day_plan jsonb not null default '{}'::jsonb,
  add column if not exists fueling_plan jsonb not null default '{}'::jsonb,
  add column if not exists schedule_notes jsonb not null default '[]'::jsonb,
  add column if not exists offline_revision integer not null default 0,
  add column if not exists offline_pending boolean not null default false;

comment on column public.event_preparation.checklist is 'Race Prep checklist items with done state per event.';
comment on column public.event_preparation.race_day_plan is 'Timeline items, manual times, and race-day logistics.';
comment on column public.event_preparation.fueling_plan is 'Editable fuel slots: preferred breakfast, tried foods, carry list, aid stations.';
comment on column public.event_preparation.schedule_notes is 'Explanations of sessions moved, paused, or skipped for this event.';
comment on column public.event_preparation.offline_revision is 'Monotonic revision for offline sync conflict detection.';
comment on column public.event_preparation.offline_pending is 'True when a client has a pending offline write awaiting sync.';
