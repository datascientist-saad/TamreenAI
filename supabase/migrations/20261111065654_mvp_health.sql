-- Health metric catalog and athlete measurements (mirrors remote mvp_health).
-- Safe to re-run: objects are created only when missing.

create table if not exists public.health_metric_definitions (
  slug text primary key,
  category text not null,
  display_name text not null,
  default_unit text not null,
  value_type text not null check (value_type in ('number', 'integer', 'score', 'text')),
  min_value numeric,
  max_value numeric,
  frequency_hint text not null default 'occasional',
  description text not null default ''
);

create table if not exists public.health_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  metric_slug text not null references public.health_metric_definitions (slug),
  value numeric,
  value_text text,
  unit text not null,
  measured_at timestamptz not null default now(),
  method text,
  source text not null default 'manual'
    check (source in ('manual', 'whoop', 'lab', 'estimate', 'device', 'other')),
  notes text not null default '',
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists health_measurements_user_metric_idx
  on public.health_measurements (user_id, metric_slug, measured_at desc)
  where deleted_at is null;

alter table public.health_metric_definitions enable row level security;
alter table public.health_measurements enable row level security;

drop policy if exists health_metric_definitions_read on public.health_metric_definitions;
create policy health_metric_definitions_read on public.health_metric_definitions
  for select to authenticated using (true);

drop policy if exists health_measurements_rw on public.health_measurements;
create policy health_measurements_rw on public.health_measurements
  for all to authenticated
  using (deleted_at is null and private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

insert into public.health_metric_definitions
  (slug, category, display_name, default_unit, value_type, min_value, max_value, frequency_hint, description)
values
  ('vo2_max', 'aerobic', 'VO₂ max', 'ml/kg/min', 'number', 10, 90, 'occasional', 'Laboratory or estimated VO₂ max.'),
  ('cycling_ftp', 'aerobic', 'Cycling FTP', 'W', 'integer', 50, 600, 'occasional', 'Functional threshold power.'),
  ('run_threshold_pace', 'aerobic', 'Running threshold pace', 'sec/km', 'number', 150, 900, 'occasional', 'Estimated or tested threshold pace.'),
  ('swim_threshold_pace', 'aerobic', 'Swimming threshold pace', 'sec/100m', 'number', 50, 300, 'occasional', 'Threshold swim pace.'),
  ('body_weight', 'body', 'Body weight', 'kg', 'number', 20, 400, 'weekly', 'Body mass.'),
  ('body_fat_pct', 'body', 'Body-fat percentage', '%', 'number', 2, 70, 'occasional', 'Body-fat percentage.'),
  ('body_height', 'body', 'Height', 'cm', 'number', 50, 260, 'rare', 'Standing height.'),
  ('waist_cm', 'body', 'Waist circumference', 'cm', 'number', 40, 200, 'occasional', 'Waist circumference.'),
  ('resting_hr', 'cardiovascular', 'Resting heart rate', 'bpm', 'integer', 30, 220, 'daily', 'Heart rate at rest.'),
  ('max_hr', 'cardiovascular', 'Maximum heart rate', 'bpm', 'integer', 100, 230, 'occasional', 'Highest observed or estimated heart rate.'),
  ('hrv', 'cardiovascular', 'Heart-rate variability', 'ms', 'number', 1, 300, 'daily', 'HRV; record method such as RMSSD or SDNN in method.'),
  ('blood_pressure_systolic', 'cardiovascular', 'Blood pressure (systolic)', 'mmHg', 'integer', 70, 250, 'as_needed', 'Systolic blood pressure.'),
  ('blood_pressure_diastolic', 'cardiovascular', 'Blood pressure (diastolic)', 'mmHg', 'integer', 40, 150, 'as_needed', 'Diastolic blood pressure.'),
  ('daily_steps', 'lifestyle', 'Daily steps', 'steps', 'integer', 0, 100000, 'daily', 'Step count.'),
  ('activity_level', 'lifestyle', 'General activity level', '1-5', 'integer', 1, 5, 'daily', 'Non-training activity.'),
  ('hydration_ml', 'lifestyle', 'Hydration', 'ml', 'integer', 0, 15000, 'daily', 'Fluid intake.'),
  ('energy', 'recovery', 'Energy', '1-5', 'integer', 1, 5, 'daily', 'Subjective energy.'),
  ('fatigue', 'recovery', 'Fatigue', '1-5', 'integer', 1, 5, 'daily', 'Subjective fatigue.'),
  ('muscle_soreness', 'recovery', 'Muscle soreness', '1-5', 'integer', 1, 5, 'daily', 'Subjective soreness.'),
  ('readiness', 'recovery', 'Perceived readiness', '1-5', 'integer', 1, 5, 'daily', 'How ready the athlete feels to train.'),
  ('stress', 'recovery', 'Stress', '1-5', 'integer', 1, 5, 'daily', 'Subjective stress.'),
  ('sleep_duration', 'sleep', 'Sleep duration', 'hours', 'number', 0, 24, 'daily', 'Total sleep duration.'),
  ('sleep_quality', 'sleep', 'Sleep quality', '1-5', 'integer', 1, 5, 'daily', 'Subjective sleep quality.'),
  ('sleep_score', 'sleep', 'Sleep score', 'score', 'score', 0, 100, 'daily', 'Sleep score; record scoring method in method.')
on conflict (slug) do nothing;
