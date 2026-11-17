-- Event-Aware Adaptive Training Engine
-- Extends multi-event training with recovery, adaptations, multi-day events,
-- and richer result capture. Additive and reversible.

-- Multi-day competitions (triathlon weekends, stage races).
alter table public.events
  add column if not exists ends_on date,
  add column if not exists estimated_duration_min integer
    check (estimated_duration_min is null or (estimated_duration_min > 0 and estimated_duration_min <= 10080)),
  add column if not exists timezone text;

update public.events
set ends_on = starts_on
where ends_on is null;

comment on column public.events.ends_on is 'Last competition day inclusive. Equals starts_on for single-day events.';
comment on column public.events.estimated_duration_min is 'Anticipated event duration in minutes (effort window, not calendar span).';

-- Richer post-event results (optional fields; registration still required).
alter table public.event_results
  add column if not exists actual_distance_m numeric,
  add column if not exists avg_heart_rate integer
    check (avg_heart_rate is null or (avg_heart_rate >= 30 and avg_heart_rate <= 250)),
  add column if not exists perceived_exertion smallint
    check (perceived_exertion is null or perceived_exertion between 1 and 10),
  add column if not exists fatigue_level smallint
    check (fatigue_level is null or fatigue_level between 1 and 5),
  add column if not exists muscle_soreness smallint
    check (muscle_soreness is null or muscle_soreness between 1 and 5),
  add column if not exists pain_or_injury boolean not null default false,
  add column if not exists sleep_quality smallint
    check (sleep_quality is null or sleep_quality between 1 and 5),
  add column if not exists ready_to_resume boolean,
  add column if not exists conditions text not null default '',
  add column if not exists athlete_comments text not null default '',
  add column if not exists completion_status text not null default 'finished'
    check (completion_status in ('finished', 'dnf', 'dns', 'partial')),
  add column if not exists analysis jsonb not null default '{}'::jsonb;

-- Structured post-event recovery recommendations and restrictions.
create table if not exists public.event_recovery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  result_id uuid references public.event_results (id) on delete set null,
  status text not null default 'pending_checkin'
    check (status in ('pending_checkin', 'active', 'completed', 'skipped')),
  recovery_days integer not null default 3
    check (recovery_days >= 0 and recovery_days <= 28),
  start_date date not null,
  end_date date not null,
  restrictions jsonb not null default '{}'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  athlete_feedback jsonb not null default '{}'::jsonb,
  medical_guidance text not null default '',
  data_origin text not null default 'system'
    check (data_origin in ('user', 'demo', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create trigger event_recovery_updated
  before update on public.event_recovery
  for each row execute function private.set_updated_at();

create index if not exists event_recovery_user_status_idx
  on public.event_recovery (user_id, status);

-- Dated training phases per event (adaptive periodization).
create table if not exists public.event_training_phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  phase text not null
    check (phase in ('base', 'build', 'peak', 'taper', 'event', 'recovery', 'return')),
  start_date date not null,
  end_date date not null,
  objectives text not null default '',
  adjustments jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists event_training_phases_event_idx
  on public.event_training_phases (event_id, sort_order);

create index if not exists event_training_phases_user_dates_idx
  on public.event_training_phases (user_id, start_date, end_date);

-- Proposed workout adaptations tied to events (approval workflow).
create table if not exists public.training_adaptations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  recommendation_id uuid references public.ai_recommendations (id) on delete set null,
  original_workout_id uuid references public.workouts (id) on delete set null,
  original_snapshot jsonb not null default '{}'::jsonb,
  proposed_workout jsonb not null default '{}'::jsonb,
  adaptation_type text not null
    check (adaptation_type in (
      'event_day_replace', 'move', 'reduce_volume', 'reduce_intensity',
      'replace', 'remove', 'add_recovery', 'combine', 'restore'
    )),
  explanation text not null default '',
  expected_impact text not null default '',
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected', 'applied', 'rolled_back', 'superseded')),
  applied_at timestamptz,
  idempotency_key text,
  data_origin text not null default 'system'
    check (data_origin in ('user', 'demo', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger training_adaptations_updated
  before update on public.training_adaptations
  for each row execute function private.set_updated_at();

create unique index if not exists training_adaptations_idempotency_idx
  on public.training_adaptations (user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists training_adaptations_user_status_idx
  on public.training_adaptations (user_id, approval_status);

create index if not exists training_adaptations_event_idx
  on public.training_adaptations (event_id);

-- Mark workouts that represent competitions so they are not treated as missed training.
alter table public.workouts
  add column if not exists is_event_session boolean not null default false,
  add column if not exists event_id uuid references public.events (id) on delete set null;

create index if not exists workouts_event_session_idx
  on public.workouts (user_id, scheduled_date)
  where is_event_session = true and deleted_at is null;

-- Plan revision sources for event lifecycle.
alter table public.plan_revisions drop constraint if exists plan_revisions_source_check;
alter table public.plan_revisions
  add constraint plan_revisions_source_check
  check (source in (
    'system', 'athlete', 'coach', 'ai', 'event_edit', 'optimize', 'weekly_review',
    'event_create', 'event_cancel', 'event_complete', 'event_recovery', 'taper'
  ));

-- RLS
alter table public.event_recovery enable row level security;
alter table public.event_recovery force row level security;
alter table public.event_training_phases enable row level security;
alter table public.event_training_phases force row level security;
alter table public.training_adaptations enable row level security;
alter table public.training_adaptations force row level security;

drop policy if exists event_recovery_select on public.event_recovery;
create policy event_recovery_select on public.event_recovery
  for select to authenticated
  using (user_id = auth.uid() or private.can_read_athlete(user_id));

drop policy if exists event_recovery_insert on public.event_recovery;
create policy event_recovery_insert on public.event_recovery
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists event_recovery_update on public.event_recovery;
create policy event_recovery_update on public.event_recovery
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists event_recovery_delete on public.event_recovery;
create policy event_recovery_delete on public.event_recovery
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists event_training_phases_select on public.event_training_phases;
create policy event_training_phases_select on public.event_training_phases
  for select to authenticated
  using (user_id = auth.uid() or private.can_read_athlete(user_id));

drop policy if exists event_training_phases_write on public.event_training_phases;
create policy event_training_phases_write on public.event_training_phases
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists training_adaptations_select on public.training_adaptations;
create policy training_adaptations_select on public.training_adaptations
  for select to authenticated
  using (user_id = auth.uid() or private.can_read_athlete(user_id));

drop policy if exists training_adaptations_insert on public.training_adaptations;
create policy training_adaptations_insert on public.training_adaptations
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists training_adaptations_update on public.training_adaptations;
create policy training_adaptations_update on public.training_adaptations
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists training_adaptations_delete on public.training_adaptations;
create policy training_adaptations_delete on public.training_adaptations
  for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.event_recovery to authenticated;
grant select, insert, update, delete on public.event_training_phases to authenticated;
grant select, insert, update, delete on public.training_adaptations to authenticated;
