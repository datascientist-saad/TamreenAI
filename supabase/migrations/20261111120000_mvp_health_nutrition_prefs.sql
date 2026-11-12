-- Tamreen MVP: athlete preferences, health, nutrition, fitness assessments,
-- event preparation, workout segments, plan revisions, AI audit tables.
-- Additive only. Preserves existing training, recovery, live, and wearable data.

-- ---------------------------------------------------------------------------
-- Catalog extensions
-- ---------------------------------------------------------------------------

insert into public.goals (slug, name, category, description) values
  ('endurance', 'Endurance', 'endurance', 'Build durable aerobic fitness across sports without collapsing strength.'),
  ('t100', 'T100', 'triathlon', 'Prepare for a T100: 2 km swim, 80 km bike, 18 km run.')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Athlete preferences and sport/goal priority
-- ---------------------------------------------------------------------------

alter table public.athlete_sports
  add column if not exists priority_class text not null default 'secondary'
    check (priority_class in ('primary', 'secondary', 'maintenance'));

alter table public.athlete_goals
  add column if not exists priority_class text not null default 'secondary'
    check (priority_class in ('primary', 'secondary', 'maintenance'));

update public.athlete_sports set priority_class = 'primary' where is_primary = true and priority_class = 'secondary';
update public.athlete_goals set priority_class = 'primary' where is_primary = true and priority_class = 'secondary';

create table if not exists public.athlete_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  dietary_pattern text not null default 'none'
    check (dietary_pattern in ('none', 'halal', 'vegetarian', 'vegan', 'pescatarian', 'kosher', 'custom')),
  allergies text[] not null default '{}',
  disliked_foods text[] not null default '{}',
  cuisine_preferences text[] not null default '{}',
  nutrition_mode text not null default 'flexible'
    check (nutrition_mode in ('flexible', 'structured')),
  scheduling_mode text not null default 'adaptive'
    check (scheduling_mode in ('adaptive', 'fixed')),
  sport_priority_mode text not null default 'ai_recommended'
    check (sport_priority_mode in ('ai_recommended', 'athlete_controlled')),
  meal_frequency smallint not null default 3 check (meal_frequency between 1 and 8),
  budget_level text not null default 'moderate'
    check (budget_level in ('low', 'moderate', 'high')),
  assessment_path text not null default 'hybrid'
    check (assessment_path in ('self_report', 'benchmark', 'hybrid')),
  health_data_consent boolean not null default false,
  health_data_consent_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger athlete_preferences_updated
  before update on public.athlete_preferences
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Fitness assessment
-- ---------------------------------------------------------------------------

create table if not exists public.fitness_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  level smallint not null check (level in (1, 2, 3)),
  assessed_on date not null default (timezone('utc', now()))::date,
  assessment_path text not null default 'hybrid'
    check (assessment_path in ('self_report', 'benchmark', 'hybrid', 'continuous')),
  summary text not null default '',
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source text not null default 'athlete'
    check (source in ('athlete', 'benchmark', 'derived', 'coach', 'system')),
  payload jsonb not null default '{}'::jsonb,
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system')),
  created_at timestamptz not null default now()
);

create table if not exists public.benchmark_results (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references public.fitness_assessments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  sport text not null,
  test_slug text not null,
  value numeric,
  unit text,
  notes text not null default '',
  is_maximal boolean not null default false,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source text not null default 'athlete',
  measured_at timestamptz not null default now(),
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system')),
  created_at timestamptz not null default now()
);

create table if not exists public.training_zones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  sport text not null,
  metric text not null check (metric in ('hr', 'pace', 'power', 'rpe', 'swim_pace')),
  zone_index smallint not null check (zone_index between 1 and 7),
  label text not null,
  low_value numeric,
  high_value numeric,
  unit text,
  source text not null default 'estimated'
    check (source in ('estimated', 'measured', 'athlete', 'derived')),
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  valid_from date not null default (timezone('utc', now()))::date,
  valid_to date,
  created_at timestamptz not null default now(),
  unique (user_id, sport, metric, zone_index, valid_from)
);

-- ---------------------------------------------------------------------------
-- Health
-- ---------------------------------------------------------------------------

create table if not exists public.health_metric_definitions (
  slug text primary key,
  category text not null,
  display_name text not null,
  default_unit text not null,
  value_type text not null default 'number' check (value_type in ('number', 'integer', 'score', 'text')),
  min_value numeric,
  max_value numeric,
  frequency_hint text not null default 'as_needed',
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

create trigger health_measurements_updated
  before update on public.health_measurements
  for each row execute function private.set_updated_at();

create trigger health_measurements_origin
  before insert or update on public.health_measurements
  for each row execute function private.stamp_origin();

insert into public.health_metric_definitions (slug, category, display_name, default_unit, value_type, min_value, max_value, frequency_hint, description) values
  ('resting_hr', 'cardiovascular', 'Resting heart rate', 'bpm', 'integer', 30, 220, 'daily', 'Heart rate at rest.'),
  ('max_hr', 'cardiovascular', 'Maximum heart rate', 'bpm', 'integer', 100, 230, 'occasional', 'Highest observed or estimated heart rate.'),
  ('hrv', 'cardiovascular', 'Heart-rate variability', 'ms', 'number', 1, 300, 'daily', 'HRV; record method such as RMSSD or SDNN in method.'),
  ('blood_pressure_systolic', 'cardiovascular', 'Blood pressure (systolic)', 'mmHg', 'integer', 70, 250, 'as_needed', 'Systolic blood pressure.'),
  ('blood_pressure_diastolic', 'cardiovascular', 'Blood pressure (diastolic)', 'mmHg', 'integer', 40, 150, 'as_needed', 'Diastolic blood pressure.'),
  ('vo2_max', 'aerobic', 'VO₂ max', 'ml/kg/min', 'number', 10, 90, 'occasional', 'Laboratory or estimated VO₂ max.'),
  ('run_threshold_pace', 'aerobic', 'Running threshold pace', 'sec/km', 'number', 150, 900, 'occasional', 'Estimated or tested threshold pace.'),
  ('cycling_ftp', 'aerobic', 'Cycling FTP', 'W', 'integer', 50, 600, 'occasional', 'Functional threshold power.'),
  ('swim_threshold_pace', 'aerobic', 'Swimming threshold pace', 'sec/100m', 'number', 50, 300, 'occasional', 'Threshold swim pace.'),
  ('sleep_duration', 'sleep', 'Sleep duration', 'hours', 'number', 0, 24, 'daily', 'Total sleep duration.'),
  ('sleep_score', 'sleep', 'Sleep score', 'score', 'score', 0, 100, 'daily', 'Sleep score; record scoring method in method.'),
  ('sleep_quality', 'sleep', 'Sleep quality', '1-5', 'integer', 1, 5, 'daily', 'Subjective sleep quality.'),
  ('body_weight', 'body', 'Body weight', 'kg', 'number', 20, 400, 'weekly', 'Body mass.'),
  ('body_height', 'body', 'Height', 'cm', 'number', 50, 260, 'rare', 'Standing height.'),
  ('body_fat_pct', 'body', 'Body-fat percentage', '%', 'number', 2, 70, 'occasional', 'Body-fat percentage.'),
  ('waist_cm', 'body', 'Waist circumference', 'cm', 'number', 40, 200, 'occasional', 'Waist circumference.'),
  ('fatigue', 'recovery', 'Fatigue', '1-5', 'integer', 1, 5, 'daily', 'Subjective fatigue.'),
  ('energy', 'recovery', 'Energy', '1-5', 'integer', 1, 5, 'daily', 'Subjective energy.'),
  ('muscle_soreness', 'recovery', 'Muscle soreness', '1-5', 'integer', 1, 5, 'daily', 'Subjective soreness.'),
  ('stress', 'recovery', 'Stress', '1-5', 'integer', 1, 5, 'daily', 'Subjective stress.'),
  ('readiness', 'recovery', 'Perceived readiness', '1-5', 'integer', 1, 5, 'daily', 'How ready the athlete feels to train.'),
  ('daily_steps', 'lifestyle', 'Daily steps', 'steps', 'integer', 0, 100000, 'daily', 'Step count.'),
  ('hydration_ml', 'lifestyle', 'Hydration', 'ml', 'integer', 0, 15000, 'daily', 'Fluid intake.'),
  ('activity_level', 'lifestyle', 'General activity level', '1-5', 'integer', 1, 5, 'daily', 'Non-training activity.')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Nutrition
-- ---------------------------------------------------------------------------

create table if not exists public.nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_date date not null,
  calories_kcal integer not null check (calories_kcal between 800 and 10000),
  protein_g numeric not null check (protein_g >= 0),
  carbs_g numeric not null check (carbs_g >= 0),
  fat_g numeric not null check (fat_g >= 0),
  hydration_ml integer,
  bmr_kcal integer,
  tdee_kcal integer,
  exercise_kcal integer not null default 0,
  goal_adjustment_kcal integer not null default 0,
  day_type text not null default 'training'
    check (day_type in ('training', 'recovery', 'race', 'rest')),
  method text not null default 'mifflin_st_jeor',
  explanation text not null default '',
  factors jsonb not null default '[]'::jsonb,
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system')),
  created_at timestamptz not null default now(),
  unique (user_id, target_date)
);

create table if not exists public.food_catalog (
  id uuid primary key default gen_random_uuid(),
  barcode text,
  name text not null,
  brand text,
  region text,
  is_halal boolean,
  serving_g numeric,
  serving_label text,
  calories_kcal numeric not null check (calories_kcal >= 0),
  protein_g numeric not null default 0 check (protein_g >= 0),
  carbs_g numeric not null default 0 check (carbs_g >= 0),
  fat_g numeric not null default 0 check (fat_g >= 0),
  fiber_g numeric,
  source text not null default 'tamreen'
    check (source in ('tamreen', 'open_food_facts', 'usda', 'manual', 'recipe')),
  external_id text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create unique index if not exists food_catalog_barcode_uidx
  on public.food_catalog (barcode)
  where barcode is not null;

create table if not exists public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  logged_on date not null,
  eaten_at timestamptz not null default now(),
  meal_slot text not null default 'other'
    check (meal_slot in ('breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'during_workout', 'post_workout', 'other')),
  entry_method text not null
    check (entry_method in ('photo', 'natural_language', 'barcode', 'search', 'manual', 'saved_meal')),
  food_id uuid references public.food_catalog (id),
  food_name text not null,
  quantity numeric not null default 1 check (quantity > 0),
  unit text not null default 'serving',
  grams numeric,
  calories_kcal numeric not null check (calories_kcal >= 0),
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  image_path text,
  raw_input text,
  candidates jsonb not null default '[]'::jsonb,
  confirmed boolean not null default true,
  notes text not null default '',
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger food_entries_updated
  before update on public.food_entries
  for each row execute function private.set_updated_at();

create trigger food_entries_origin
  before insert or update on public.food_entries
  for each row execute function private.stamp_origin();

create table if not exists public.meal_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  servings numeric not null default 1 check (servings > 0),
  ingredients jsonb not null default '[]'::jsonb,
  calories_kcal numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  is_halal boolean,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger meal_recipes_updated
  before update on public.meal_recipes
  for each row execute function private.set_updated_at();

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  start_date date not null,
  end_date date not null,
  mode text not null default 'structured' check (mode in ('structured')),
  explanation text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger meal_plans_updated
  before update on public.meal_plans
  for each row execute function private.set_updated_at();

create table if not exists public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_date date not null,
  meal_slot text not null,
  recipe_id uuid references public.meal_recipes (id) on delete set null,
  food_id uuid references public.food_catalog (id),
  title text not null,
  servings numeric not null default 1,
  calories_kcal numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  sort_order integer not null default 0
);

create table if not exists public.hydration_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  logged_on date not null,
  amount_ml integer not null check (amount_ml > 0 and amount_ml <= 5000),
  logged_at timestamptz not null default now(),
  notes text not null default '',
  data_origin text not null default 'user' check (data_origin in ('user', 'demo', 'system')),
  created_at timestamptz not null default now()
);

-- Seed a small regional / halal-friendly catalog (composition values are labeled Tamreen defaults).
insert into public.food_catalog (name, brand, region, is_halal, serving_g, serving_label, calories_kcal, protein_g, carbs_g, fat_g, source)
select * from (values
  ('Cooked white rice', null::text, 'global', true, 150::numeric, '1 cup cooked', 205::numeric, 4.3::numeric, 44.5::numeric, 0.4::numeric, 'tamreen'),
  ('Grilled chicken breast', null, 'global', true, 100, '100 g', 165, 31, 0, 3.6, 'tamreen'),
  ('Whole egg', null, 'global', true, 50, '1 large', 72, 6.3, 0.4, 4.8, 'tamreen'),
  ('Oats, dry', null, 'global', true, 40, '40 g', 150, 5, 27, 3, 'tamreen'),
  ('Banana', null, 'global', true, 118, '1 medium', 105, 1.3, 27, 0.4, 'tamreen'),
  ('Greek yogurt, plain', null, 'global', true, 170, '170 g', 100, 17, 6, 0.7, 'tamreen'),
  ('Salmon, cooked', null, 'global', true, 100, '100 g', 208, 22, 0, 13, 'tamreen'),
  ('Hummus', null, 'MENA', true, 30, '2 tbsp', 70, 2, 6, 5, 'tamreen'),
  ('Dates, Medjool', null, 'MENA', true, 24, '1 date', 66, 0.4, 18, 0, 'tamreen'),
  ('Labneh', null, 'MENA', true, 100, '100 g', 146, 10, 4, 10, 'tamreen'),
  ('Chicken shawarma plate (no fries)', null, 'MENA', true, 350, '1 plate', 520, 38, 40, 22, 'tamreen'),
  ('Mixed salad with olive oil', null, 'global', true, 200, 'bowl', 180, 3, 10, 14, 'tamreen'),
  ('Whey protein isolate', null, 'global', true, 30, '1 scoop', 110, 25, 1, 0.5, 'tamreen'),
  ('Almonds', null, 'global', true, 28, '1 oz', 160, 6, 6, 14, 'tamreen'),
  ('Olive oil', null, 'global', true, 14, '1 tbsp', 119, 0, 0, 13.5, 'tamreen')
) as seed(name, brand, region, is_halal, serving_g, serving_label, calories_kcal, protein_g, carbs_g, fat_g, source)
where not exists (select 1 from public.food_catalog limit 1);

-- ---------------------------------------------------------------------------
-- Training structure extensions
-- ---------------------------------------------------------------------------

alter table public.workouts
  add column if not exists parent_workout_id uuid references public.workouts (id) on delete cascade;

alter table public.workouts
  add column if not exists alternatives jsonb not null default '[]'::jsonb;

alter table public.workouts
  add column if not exists revision_note text not null default '';

create table if not exists public.workout_segments (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  sport text not null,
  segment_order integer not null,
  title text not null,
  duration_min integer not null check (duration_min > 0 and duration_min <= 600),
  intensity text,
  structure jsonb not null default '{}'::jsonb,
  notes text not null default '',
  unique (workout_id, segment_order)
);

create table if not exists public.plan_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid not null references public.training_plans (id) on delete cascade,
  previous_plan_id uuid references public.training_plans (id) on delete set null,
  reason text not null default '',
  change_summary text not null default '',
  snapshot jsonb not null default '{}'::jsonb,
  requires_approval boolean not null default false,
  approved_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.event_preparation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  template_slug text,
  objective text not null default '',
  current_capabilities jsonb not null default '{}'::jsonb,
  phase_plan jsonb not null default '[]'::jsonb,
  readiness_evidence jsonb not null default '[]'::jsonb,
  fueling_practice jsonb not null default '{}'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create trigger event_preparation_updated
  before update on public.event_preparation
  for each row execute function private.set_updated_at();

create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  week_end date not null,
  summary text not null default '',
  metrics jsonb not null default '{}'::jsonb,
  proposed_adjustments jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'applied')),
  athlete_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create trigger weekly_reviews_updated
  before update on public.weekly_reviews
  for each row execute function private.set_updated_at();

create table if not exists public.ai_generation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null,
  schema_version text not null default '1',
  model text,
  prompt_hash text,
  request_meta jsonb not null default '{}'::jsonb,
  response_meta jsonb not null default '{}'::jsonb,
  validated boolean not null default false,
  fallback_used boolean not null default false,
  error_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.decision_explanations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  domain text not null,
  subject_id uuid,
  title text not null,
  body text not null,
  factors jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists fitness_assessments_user_idx on public.fitness_assessments (user_id, assessed_on desc);
create index if not exists benchmark_results_user_idx on public.benchmark_results (user_id, sport, measured_at desc);
create index if not exists training_zones_user_idx on public.training_zones (user_id, sport, metric);
create index if not exists health_measurements_user_metric_idx on public.health_measurements (user_id, metric_slug, measured_at desc) where deleted_at is null;
create index if not exists nutrition_targets_user_date_idx on public.nutrition_targets (user_id, target_date desc);
create index if not exists food_entries_user_date_idx on public.food_entries (user_id, logged_on desc) where deleted_at is null;
create index if not exists food_catalog_name_idx on public.food_catalog using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(brand, '')));
create index if not exists hydration_entries_user_date_idx on public.hydration_entries (user_id, logged_on desc);
create index if not exists workout_segments_workout_idx on public.workout_segments (workout_id, segment_order);
create index if not exists workouts_parent_idx on public.workouts (parent_workout_id) where parent_workout_id is not null;
create index if not exists plan_revisions_user_idx on public.plan_revisions (user_id, created_at desc);
create index if not exists event_preparation_user_idx on public.event_preparation (user_id, event_id);
create index if not exists weekly_reviews_user_idx on public.weekly_reviews (user_id, week_start desc);
create index if not exists ai_generation_logs_user_idx on public.ai_generation_logs (user_id, created_at desc);
create index if not exists decision_explanations_user_idx on public.decision_explanations (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.athlete_preferences enable row level security;
alter table public.athlete_preferences force row level security;
alter table public.fitness_assessments enable row level security;
alter table public.fitness_assessments force row level security;
alter table public.benchmark_results enable row level security;
alter table public.benchmark_results force row level security;
alter table public.training_zones enable row level security;
alter table public.training_zones force row level security;
alter table public.health_metric_definitions enable row level security;
alter table public.health_metric_definitions force row level security;
alter table public.health_measurements enable row level security;
alter table public.health_measurements force row level security;
alter table public.nutrition_targets enable row level security;
alter table public.nutrition_targets force row level security;
alter table public.food_catalog enable row level security;
alter table public.food_catalog force row level security;
alter table public.food_entries enable row level security;
alter table public.food_entries force row level security;
alter table public.meal_recipes enable row level security;
alter table public.meal_recipes force row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_plans force row level security;
alter table public.meal_plan_items enable row level security;
alter table public.meal_plan_items force row level security;
alter table public.hydration_entries enable row level security;
alter table public.hydration_entries force row level security;
alter table public.workout_segments enable row level security;
alter table public.workout_segments force row level security;
alter table public.plan_revisions enable row level security;
alter table public.plan_revisions force row level security;
alter table public.event_preparation enable row level security;
alter table public.event_preparation force row level security;
alter table public.weekly_reviews enable row level security;
alter table public.weekly_reviews force row level security;
alter table public.ai_generation_logs enable row level security;
alter table public.ai_generation_logs force row level security;
alter table public.decision_explanations enable row level security;
alter table public.decision_explanations force row level security;

grant select, insert, update, delete on public.athlete_preferences to authenticated;
grant select, insert, update, delete on public.fitness_assessments to authenticated;
grant select, insert, update, delete on public.benchmark_results to authenticated;
grant select, insert, update, delete on public.training_zones to authenticated;
grant select on public.health_metric_definitions to anon, authenticated;
grant select, insert, update, delete on public.health_measurements to authenticated;
grant select, insert, update, delete on public.nutrition_targets to authenticated;
grant select on public.food_catalog to anon, authenticated;
grant insert, update on public.food_catalog to authenticated;
grant select, insert, update, delete on public.food_entries to authenticated;
grant select, insert, update, delete on public.meal_recipes to authenticated;
grant select, insert, update, delete on public.meal_plans to authenticated;
grant select, insert, update, delete on public.meal_plan_items to authenticated;
grant select, insert, update, delete on public.hydration_entries to authenticated;
grant select, insert, update, delete on public.workout_segments to authenticated;
grant select, insert, update, delete on public.plan_revisions to authenticated;
grant select, insert, update, delete on public.event_preparation to authenticated;
grant select, insert, update, delete on public.weekly_reviews to authenticated;
grant select, insert on public.ai_generation_logs to authenticated;
grant select, insert on public.decision_explanations to authenticated;

drop policy if exists athlete_preferences_rw on public.athlete_preferences;
create policy athlete_preferences_rw on public.athlete_preferences for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

drop policy if exists fitness_assessments_rw on public.fitness_assessments;
create policy fitness_assessments_rw on public.fitness_assessments for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

drop policy if exists benchmark_results_rw on public.benchmark_results;
create policy benchmark_results_rw on public.benchmark_results for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

drop policy if exists training_zones_rw on public.training_zones;
create policy training_zones_rw on public.training_zones for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

drop policy if exists health_metric_definitions_read on public.health_metric_definitions;
create policy health_metric_definitions_read on public.health_metric_definitions
  for select to anon, authenticated using (true);

drop policy if exists health_measurements_rw on public.health_measurements;
create policy health_measurements_rw on public.health_measurements for all to authenticated
  using (deleted_at is null and private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

drop policy if exists nutrition_targets_rw on public.nutrition_targets;
create policy nutrition_targets_rw on public.nutrition_targets for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

drop policy if exists food_catalog_read on public.food_catalog;
create policy food_catalog_read on public.food_catalog
  for select to anon, authenticated using (true);

drop policy if exists food_catalog_insert on public.food_catalog;
create policy food_catalog_insert on public.food_catalog
  for insert to authenticated
  with check (created_by = (select auth.uid()) or created_by is null);

drop policy if exists food_catalog_update_own on public.food_catalog;
create policy food_catalog_update_own on public.food_catalog
  for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

drop policy if exists food_entries_rw on public.food_entries;
create policy food_entries_rw on public.food_entries for all to authenticated
  using (deleted_at is null and private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

drop policy if exists meal_recipes_rw on public.meal_recipes;
create policy meal_recipes_rw on public.meal_recipes for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

drop policy if exists meal_plans_rw on public.meal_plans;
create policy meal_plans_rw on public.meal_plans for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

drop policy if exists meal_plan_items_rw on public.meal_plan_items;
create policy meal_plan_items_rw on public.meal_plan_items for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

drop policy if exists hydration_entries_rw on public.hydration_entries;
create policy hydration_entries_rw on public.hydration_entries for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

drop policy if exists workout_segments_rw on public.workout_segments;
create policy workout_segments_rw on public.workout_segments for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

drop policy if exists plan_revisions_rw on public.plan_revisions;
create policy plan_revisions_rw on public.plan_revisions for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

drop policy if exists event_preparation_rw on public.event_preparation;
create policy event_preparation_rw on public.event_preparation for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

drop policy if exists weekly_reviews_rw on public.weekly_reviews;
create policy weekly_reviews_rw on public.weekly_reviews for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

drop policy if exists ai_generation_logs_rw on public.ai_generation_logs;
create policy ai_generation_logs_select on public.ai_generation_logs
  for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role('super_admin'));
create policy ai_generation_logs_insert on public.ai_generation_logs
  for insert to authenticated
  with check (user_id = (select auth.uid()) or user_id is null);

drop policy if exists decision_explanations_rw on public.decision_explanations;
create policy decision_explanations_rw on public.decision_explanations for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage: food images
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'food-images',
  'food-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists food_images_select on storage.objects;
create policy food_images_select on storage.objects
  for select to authenticated
  using (bucket_id = 'food-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists food_images_insert on storage.objects;
create policy food_images_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'food-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists food_images_update on storage.objects;
create policy food_images_update on storage.objects
  for update to authenticated
  using (bucket_id = 'food-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'food-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists food_images_delete on storage.objects;
create policy food_images_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'food-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
