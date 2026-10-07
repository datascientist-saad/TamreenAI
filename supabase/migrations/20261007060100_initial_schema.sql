-- Tamreen AI initial schema
-- Hybrid athlete platform: one performance model across strength, run, bike, and swim.
-- Authorization lives in user_roles and relationship tables, never in user-editable JWT metadata.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to postgres, service_role, authenticated;

create type public.app_role as enum (
  'athlete',
  'coach',
  'gym_admin',
  'event_admin',
  'super_admin'
);

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  avatar_path text,
  date_of_birth date,
  sex text check (sex in ('female', 'male', 'other', 'prefer_not_to_say')),
  onboarding_completed boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.athlete_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  height_cm numeric(5, 2) check (height_cm is null or height_cm between 50 and 260),
  weight_kg numeric(6, 2) check (weight_kg is null or weight_kg between 20 and 400),
  body_fat_pct numeric(4, 1) check (body_fat_pct is null or body_fat_pct between 2 and 70),
  experience_level text not null default 'intermediate'
    check (experience_level in ('beginner', 'intermediate', 'advanced', 'elite')),
  days_available smallint not null default 5 check (days_available between 1 and 7),
  minutes_per_day smallint not null default 60 check (minutes_per_day between 15 and 360),
  preferred_days smallint[] not null default '{1,2,3,4,5,6}',
  gym_access boolean not null default true,
  pool_access boolean not null default false,
  bike_access boolean not null default false,
  reported_5k_seconds integer,
  reported_10k_seconds integer,
  reported_half_seconds integer,
  reported_marathon_seconds integer,
  weekly_run_km numeric,
  ftp_watts integer,
  weekly_bike_km numeric,
  swim_100m_seconds integer,
  swim_400m_seconds integer,
  weekly_swim_m numeric,
  squat_kg numeric,
  bench_kg numeric,
  deadlift_kg numeric,
  timezone text not null default 'Asia/Qatar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preferred_days_valid check (preferred_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, role)
);

create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  unit_system text not null default 'metric' check (unit_system in ('metric', 'imperial')),
  distance_unit text not null default 'km' check (distance_unit in ('km', 'mi')),
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  notify_workout boolean not null default true,
  notify_recovery boolean not null default true,
  notify_conflicts boolean not null default true,
  notify_prs boolean not null default true,
  notify_events boolean not null default true,
  notify_coach boolean not null default true,
  notify_plan_changes boolean not null default true,
  share_with_coach boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  plan_code text not null default 'free',
  status text not null default 'active' check (status in ('trialing', 'active', 'past_due', 'canceled')),
  current_period_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Sports, goals, injuries
-- ---------------------------------------------------------------------------

create table public.sports (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default ''
);

create table public.athlete_sports (
  user_id uuid not null references public.profiles (id) on delete cascade,
  sport_id uuid not null references public.sports (id),
  is_primary boolean not null default false,
  experience_level text not null default 'intermediate'
    check (experience_level in ('beginner', 'intermediate', 'advanced', 'elite')),
  created_at timestamptz not null default now(),
  primary key (user_id, sport_id)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  description text not null default ''
);

create table public.athlete_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  goal_id uuid not null references public.goals (id),
  is_primary boolean not null default false,
  custom_label text,
  target_value numeric,
  target_unit text,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, goal_id)
);

create unique index athlete_goals_one_primary
  on public.athlete_goals (user_id)
  where is_primary;

create table public.injuries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('current', 'previous')),
  body_area text not null,
  description text not null default '',
  exercises_to_avoid text[] not null default '{}',
  mobility_limits text not null default '',
  severity text not null default 'mild' check (severity in ('mild', 'moderate', 'severe')),
  red_flag boolean not null default false,
  started_on date,
  resolved_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create table public.event_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.event_organizations (id),
  owner_user_id uuid references public.profiles (id),
  name text not null,
  event_type text not null,
  discipline text not null,
  starts_on date not null,
  location text,
  distance_m numeric,
  goal_time_seconds integer,
  course jsonb not null default '{}'::jsonb,
  description text not null default '',
  is_public boolean not null default false,
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint events_owner_present check (organization_id is not null or owner_user_id is not null)
);

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  goal_time_seconds integer,
  bib text,
  status text not null default 'registered'
    check (status in ('registered', 'started', 'finished', 'dns', 'dnf')),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table public.event_checkpoints (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  distance_m numeric,
  sort_order integer not null
);

create table public.event_results (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.event_registrations (id) on delete cascade,
  finish_time_seconds integer,
  pace_sec_per_km numeric,
  splits jsonb not null default '[]'::jsonb,
  ranking integer,
  field_size integer,
  consistency_score numeric,
  technique_note text,
  ai_insight text,
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Training plan
-- ---------------------------------------------------------------------------

create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  start_date date not null,
  end_date date not null,
  primary_goal_slug text,
  inputs jsonb not null default '{}'::jsonb,
  explanation text not null default '',
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.training_blocks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  phase text not null check (phase in ('base', 'build', 'peak', 'taper', 'recovery')),
  name text not null,
  start_date date not null,
  end_date date not null,
  focus text not null default '',
  sort_order integer not null default 0
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.training_plans (id) on delete set null,
  block_id uuid references public.training_blocks (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  scheduled_date date not null,
  sport text not null check (sport in (
    'strength', 'bodybuilding', 'running', 'cycling', 'swimming', 'brick', 'mobility', 'recovery'
  )),
  title text not null,
  objective text not null default '',
  duration_min integer not null check (duration_min > 0 and duration_min <= 600),
  intensity text not null check (intensity in (
    'recovery', 'easy', 'moderate', 'tempo', 'threshold', 'vo2', 'race', 'max'
  )),
  expected_load numeric not null default 0,
  importance text not null default 'supporting' check (importance in ('key', 'supporting', 'optional')),
  recovery_hours smallint not null default 24,
  status text not null default 'planned'
    check (status in ('planned', 'completed', 'skipped', 'missed', 'moved')),
  structure jsonb not null default '{}'::jsonb,
  zones jsonb not null default '{}'::jsonb,
  why_text text not null default '',
  moved_from date,
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  muscle_group text not null,
  equipment text not null,
  movement_pattern text not null,
  sport_relevance text[] not null default '{}',
  instructions text not null,
  media_path text,
  alternative_slugs text[] not null default '{}',
  why_template text not null default '',
  live_supported boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id uuid references public.exercise_library (id),
  sort_order integer not null,
  set_count integer not null default 3 check (set_count > 0 and set_count <= 20),
  reps text not null default '5',
  prescribed_load text,
  target_rpe numeric,
  target_rir numeric,
  rest_seconds integer,
  tempo text,
  technique text not null default 'straight'
    check (technique in ('straight', 'superset', 'circuit', 'dropset', 'warmup')),
  group_label text,
  notes text not null default '',
  why_text text not null default ''
);

create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  set_number integer not null,
  reps text,
  weight_kg numeric,
  rpe numeric,
  rir numeric,
  rest_seconds integer,
  tempo text,
  is_warmup boolean not null default false,
  notes text not null default ''
);

create table public.completed_workouts (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid references public.workouts (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  sport text not null,
  title text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_min integer,
  rpe numeric check (rpe is null or rpe between 1 and 10),
  fatigue numeric check (fatigue is null or fatigue between 1 and 10),
  load numeric not null default 0,
  notes text not null default '',
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system')),
  created_at timestamptz not null default now()
);

create table public.completed_sets (
  id uuid primary key default gen_random_uuid(),
  completed_workout_id uuid not null references public.completed_workouts (id) on delete cascade,
  exercise_id uuid references public.exercise_library (id),
  exercise_name text not null,
  set_number integer not null,
  reps integer,
  weight_kg numeric,
  rpe numeric,
  rir numeric,
  rest_seconds integer,
  tempo text,
  is_warmup boolean not null default false,
  notes text not null default ''
);

create table public.strength_sessions (
  id uuid primary key default gen_random_uuid(),
  completed_workout_id uuid not null unique references public.completed_workouts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  total_sets integer not null default 0,
  total_reps integer not null default 0,
  total_volume_kg numeric not null default 0,
  focus text,
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system'))
);

create table public.running_sessions (
  id uuid primary key default gen_random_uuid(),
  completed_workout_id uuid not null unique references public.completed_workouts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_type text not null,
  distance_m numeric not null,
  duration_seconds integer not null,
  avg_pace_sec_per_km numeric,
  avg_hr integer,
  cadence integer,
  elevation_m numeric,
  splits jsonb not null default '[]'::jsonb,
  zones jsonb not null default '{}'::jsonb,
  consistency numeric,
  aerobic_efficiency numeric,
  performance_score numeric,
  insight text,
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system'))
);

create table public.cycling_sessions (
  id uuid primary key default gen_random_uuid(),
  completed_workout_id uuid not null unique references public.completed_workouts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_type text not null,
  distance_m numeric not null,
  duration_seconds integer not null,
  avg_speed_kph numeric,
  avg_power integer,
  normalized_power integer,
  ftp integer,
  cadence integer,
  avg_hr integer,
  elevation_m numeric,
  zones jsonb not null default '{}'::jsonb,
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system'))
);

create table public.swimming_sessions (
  id uuid primary key default gen_random_uuid(),
  completed_workout_id uuid not null unique references public.completed_workouts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_type text not null,
  distance_m numeric not null,
  duration_seconds integer not null,
  pace_sec_per_100m numeric,
  laps integer,
  stroke_rate integer,
  stroke_count integer,
  swolf numeric,
  intervals jsonb not null default '[]'::jsonb,
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system'))
);

-- ---------------------------------------------------------------------------
-- Live training. Pose payloads are stored only when a real model produced them.
-- ---------------------------------------------------------------------------

create table public.live_training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  exercise_slug text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer,
  camera_used boolean not null default false,
  manual_reps integer,
  manual_sets integer,
  analysis_source text not null default 'unavailable'
    check (analysis_source in ('unavailable', 'manual', 'placeholder_demo', 'model')),
  notes text not null default '',
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system')),
  created_at timestamptz not null default now()
);

create table public.pose_analysis (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_training_sessions (id) on delete cascade,
  source text not null check (source = 'model'),
  model_name text not null,
  frame_count integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.form_analysis (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_training_sessions (id) on delete cascade,
  exercise_slug text not null,
  source text not null check (source in ('placeholder_demo', 'model', 'manual')),
  is_placeholder boolean not null default false,
  overall_score numeric,
  metrics jsonb not null default '{}'::jsonb,
  best_note text,
  improve_note text,
  created_at timestamptz not null default now(),
  constraint form_placeholder_flag check (
    (source = 'placeholder_demo' and is_placeholder)
    or (source <> 'placeholder_demo' and not is_placeholder)
  )
);

-- ---------------------------------------------------------------------------
-- Performance, recovery, adaptation
-- ---------------------------------------------------------------------------

create table public.performance_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  scored_on date not null,
  dimension text not null,
  score numeric check (score is null or (score >= 0 and score <= 100)),
  explanation text not null,
  factors jsonb not null default '[]'::jsonb,
  sample_size integer not null default 0,
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system')),
  created_at timestamptz not null default now(),
  unique (user_id, scored_on, dimension)
);

create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  sport text not null,
  record_type text not null,
  value numeric not null,
  unit text not null,
  achieved_on date not null,
  source_id uuid,
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system')),
  created_at timestamptz not null default now()
);

create table public.recovery_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  logged_on date not null,
  sleep_hours numeric,
  sleep_quality smallint check (sleep_quality between 1 and 5),
  soreness smallint check (soreness between 1 and 5),
  fatigue smallint check (fatigue between 1 and 5),
  motivation smallint check (motivation between 1 and 5),
  resting_hr integer,
  hrv numeric,
  stress smallint check (stress between 1 and 5),
  notes text not null default '',
  severe_symptoms text[] not null default '{}',
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system')),
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create table public.readiness_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  scored_on date not null,
  overall numeric,
  sleep numeric,
  recovery numeric,
  recent_load numeric,
  muscle_fatigue numeric,
  cardio_fatigue numeric,
  train_recommendation text not null,
  explanation text not null,
  factors jsonb not null default '[]'::jsonb,
  blocked_for_safety boolean not null default false,
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system')),
  created_at timestamptz not null default now(),
  unique (user_id, scored_on)
);

create table public.training_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workout_a_id uuid references public.workouts (id) on delete cascade,
  workout_b_id uuid references public.workouts (id) on delete cascade,
  severity text not null check (severity in ('info', 'warning', 'high')),
  title text not null,
  explanation text not null,
  recommendation jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'optimized', 'dismissed')),
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system')),
  created_at timestamptz not null default now()
);

create table public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  factors jsonb not null default '[]'::jsonb,
  proposed_changes jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'applied')),
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Coach, gym, devices, notifications, audit
-- ---------------------------------------------------------------------------

create table public.coach_athletes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  authorized_at timestamptz,
  created_at timestamptz not null default now(),
  unique (coach_id, athlete_id)
);

create table public.coach_feedback (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id),
  athlete_id uuid not null references public.profiles (id),
  workout_id uuid references public.workouts (id) on delete set null,
  live_session_id uuid references public.live_training_sessions (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles (id),
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
