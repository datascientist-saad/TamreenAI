-- Labeled investor demo. Every generated row uses data_origin = 'demo'.
-- Password for each account: TamreenDemo!2026
-- Safe to re-run. History for the demo athlete is replaced.

create extension if not exists pgcrypto;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change, phone
)
select
  '00000000-0000-0000-0000-000000000000',
  account.id,
  'authenticated',
  'authenticated',
  account.email,
  extensions.crypt('TamreenDemo!2026', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', account.full_name),
  now(),
  now(),
  '',
  '',
  '',
  '',
  null
from (
  values
    ('11111111-1111-4111-8111-111111111111'::uuid, 'saad@tamreen.ai', 'Saad Al-Tamreen'),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'coach@tamreen.ai', 'Layla Coach'),
    ('33333333-3333-4333-8333-333333333333'::uuid, 'gym@tamreen.ai', 'Doha Gym'),
    ('44444444-4444-4444-8444-444444444444'::uuid, 'events@tamreen.ai', 'Events Desk'),
    ('55555555-5555-4555-8555-555555555555'::uuid, 'admin@tamreen.ai', 'Tamreen Admin')
) as account(id, email, full_name)
where not exists (select 1 from auth.users u where u.id = account.id);

insert into auth.identities (user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
select
  u.id,
  'email',
  u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  now(),
  now(),
  now()
from auth.users u
where u.email in ('saad@tamreen.ai', 'coach@tamreen.ai', 'gym@tamreen.ai', 'events@tamreen.ai', 'admin@tamreen.ai')
  and not exists (
    select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'
  );

update public.profiles
set full_name = case id
    when '11111111-1111-4111-8111-111111111111' then 'Saad Al-Tamreen'
    when '22222222-2222-4222-8222-222222222222' then 'Layla Coach'
    when '33333333-3333-4333-8333-333333333333' then 'Doha Gym'
    when '44444444-4444-4444-8444-444444444444' then 'Events Desk'
    else 'Tamreen Admin'
  end,
  is_demo = true
where id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555'
);

insert into public.user_roles (user_id, role)
values
  ('22222222-2222-4222-8222-222222222222', 'coach'),
  ('33333333-3333-4333-8333-333333333333', 'gym_admin'),
  ('44444444-4444-4444-8444-444444444444', 'event_admin'),
  ('55555555-5555-4555-8555-555555555555', 'super_admin')
on conflict (user_id, role) do nothing;

do $$
declare
  athlete uuid := '11111111-1111-4111-8111-111111111111';
  coach uuid := '22222222-2222-4222-8222-222222222222';
  gym_user uuid := '33333333-3333-4333-8333-333333333333';
  events_user uuid := '44444444-4444-4444-8444-444444444444';
  plan_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  event_id uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  org_id uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  demo_gym uuid := 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
  day date;
  offset_days integer;
  dow integer;
  sport text;
  title text;
  minutes integer;
  intensity text;
  distance_m numeric;
  duration_s integer;
  completed_id uuid;
  lower_id uuid;
  vo2_id uuid;
begin
  update public.profiles
  set date_of_birth = date '1994-04-12',
      sex = 'male',
      onboarding_completed = true,
      is_demo = true
  where id = athlete;

  update public.athlete_profiles
  set height_cm = 178,
      weight_kg = 76,
      body_fat_pct = 14.5,
      experience_level = 'advanced',
      days_available = 6,
      minutes_per_day = 75,
      preferred_days = '{1,2,3,4,5,6}',
      gym_access = true,
      pool_access = true,
      bike_access = true,
      reported_5k_seconds = 1320,
      reported_10k_seconds = 2880,
      reported_half_seconds = 6300,
      weekly_run_km = 35,
      ftp_watts = 240,
      weekly_bike_km = 140,
      swim_100m_seconds = 105,
      swim_400m_seconds = 450,
      weekly_swim_m = 8000,
      squat_kg = 140,
      bench_kg = 100,
      deadlift_kg = 180,
      timezone = 'Asia/Qatar'
  where user_id = athlete;

  delete from public.athlete_sports where user_id = athlete;
  insert into public.athlete_sports (user_id, sport_id, is_primary, experience_level)
  select athlete, id, slug = 'triathlon', 'advanced' from public.sports
  where slug in ('strength', 'running', 'cycling', 'swimming', 'triathlon');

  delete from public.athlete_goals where user_id = athlete;
  insert into public.athlete_goals (user_id, goal_id, is_primary)
  select athlete, id, slug = 'ironman_70_3' from public.goals
  where slug in ('ironman_70_3', 'increase_strength');

  delete from public.injuries where user_id = athlete;
  insert into public.injuries (user_id, status, body_area, description, exercises_to_avoid, severity, red_flag)
  values (athlete, 'previous', 'left knee', 'Old irritation that is settled. Avoid grinding high-volume squats when the knee is sore.', array['pistol squat'], 'mild', false);

  delete from public.notifications where user_id = athlete;
  delete from public.ai_recommendations where user_id = athlete;
  delete from public.training_conflicts where user_id = athlete;
  delete from public.personal_records where user_id = athlete;
  delete from public.performance_scores where user_id = athlete;
  delete from public.readiness_scores where user_id = athlete;
  delete from public.recovery_logs where user_id = athlete;
  delete from public.live_training_sessions where user_id = athlete;
  delete from public.completed_workouts where user_id = athlete and data_origin = 'demo';
  delete from public.workouts where user_id = athlete and data_origin = 'demo';
  delete from public.training_plans where user_id = athlete and data_origin = 'demo';
  delete from public.events where owner_user_id = athlete and data_origin = 'demo';

  insert into public.events (id, owner_user_id, name, event_type, discipline, starts_on, location, distance_m, goal_time_seconds, description, data_origin)
  values (
    event_id, athlete, 'Ironman 70.3 Doha', 'Ironman 70.3', 'triathlon',
    current_date + 146, 'Doha', 113000, 19800,
    '1.9 km swim, 90 km bike, 21.1 km run. The plan tapers into this date.',
    'demo'
  );

  insert into public.training_plans (id, user_id, name, status, start_date, end_date, primary_goal_slug, explanation, data_origin)
  values (
    plan_id, athlete, '70.3 build with strength support', 'active', current_date, current_date + 146, 'ironman_70_3',
    'One plan covers swim, bike, run, and strength. Heavy lower-body work stays away from the key run so both can be high quality.',
    'demo'
  );

  insert into public.training_blocks (plan_id, user_id, phase, name, start_date, end_date, focus, sort_order)
  values
    (plan_id, athlete, 'base', 'Aerobic base', current_date, current_date + 41, 'Easy volume across all three sports, strength twice a week.', 0),
    (plan_id, athlete, 'build', 'Specific build', current_date + 42, current_date + 111, 'Threshold and race-pace work, strength maintained.', 1),
    (plan_id, athlete, 'peak', 'Race specificity', current_date + 112, current_date + 132, 'Brick sessions and open-water rehearsal.', 2),
    (plan_id, athlete, 'taper', 'Taper', current_date + 133, current_date + 146, 'Volume down, a little sharpness kept.', 3);

  for offset_days in 1..96 loop
    day := current_date - offset_days;
    dow := extract(dow from day);
    if dow = 0 then
      sport := 'running'; title := 'Long run'; minutes := 80; intensity := 'easy'; distance_m := 14000; duration_s := 4800;
    elsif dow = 1 then
      sport := 'swimming'; title := 'Aerobic swim'; minutes := 45; intensity := 'easy'; distance_m := 2000; duration_s := 2700;
    elsif dow = 2 then
      sport := 'strength'; title := 'Lower-body strength'; minutes := 55; intensity := 'moderate'; distance_m := null; duration_s := 3300;
    elsif dow = 3 then
      sport := 'cycling'; title := 'Endurance ride'; minutes := 90; intensity := 'easy'; distance_m := 42000; duration_s := 5400;
    elsif dow = 4 then
      sport := 'running'; title := 'Easy run'; minutes := 40; intensity := 'easy'; distance_m := 7000; duration_s := 2400;
    elsif dow = 5 then
      sport := 'strength'; title := 'Upper-body strength'; minutes := 50; intensity := 'moderate'; distance_m := null; duration_s := 3000;
    else
      sport := 'cycling'; title := 'Sweet spot ride'; minutes := 70; intensity := 'threshold'; distance_m := 35000; duration_s := 4200;
    end if;

    insert into public.completed_workouts (
      user_id, sport, title, started_at, ended_at, duration_min, rpe, fatigue, load, notes, data_origin
    ) values (
      athlete, sport, title,
      day + time '06:30',
      day + time '06:30' + make_interval(mins => minutes),
      minutes,
      case when intensity = 'threshold' then 7 else 5 end,
      4,
      round(minutes * case intensity when 'threshold' then 1.3 when 'moderate' then 1.0 else 0.7 end),
      'Seeded demo session. Not a live measurement.',
      'demo'
    ) returning id into completed_id;

    if sport = 'running' then
      insert into public.running_sessions (
        completed_workout_id, user_id, session_type, distance_m, duration_seconds, avg_pace_sec_per_km, avg_hr, cadence, elevation_m, splits, consistency, insight, data_origin
      ) values (
        completed_id, athlete, case when title = 'Long run' then 'long' else 'easy' end,
        distance_m, duration_s, duration_s / (distance_m / 1000), 142, 172, 40,
        jsonb_build_array(duration_s / (distance_m / 1000)),
        null,
        'Demo history. Pace is the entered duration divided by distance. Consistency was not scored from a single split.',
        'demo'
      );
    elsif sport = 'cycling' then
      insert into public.cycling_sessions (
        completed_workout_id, user_id, session_type, distance_m, duration_seconds, avg_speed_kph, avg_power, normalized_power, ftp, cadence, avg_hr, elevation_m, data_origin
      ) values (
        completed_id, athlete, case when intensity = 'threshold' then 'sweet_spot' else 'endurance' end,
        distance_m, duration_s, (distance_m / 1000) / (duration_s / 3600.0),
        case when intensity = 'threshold' then 210 else 165 end,
        case when intensity = 'threshold' then 220 else 170 end,
        240, 88, 138, 180, 'demo'
      );
    elsif sport = 'swimming' then
      insert into public.swimming_sessions (
        completed_workout_id, user_id, session_type, distance_m, duration_seconds, pace_sec_per_100m, laps, stroke_rate, data_origin
      ) values (
        completed_id, athlete, 'endurance', distance_m, duration_s, duration_s / (distance_m / 100), 80, 32, 'demo'
      );
    else
      insert into public.strength_sessions (completed_workout_id, user_id, total_sets, total_reps, total_volume_kg, focus, data_origin)
      values (completed_id, athlete, 12, 48, case when title like 'Lower%' then 4200 else 2800 end, title, 'demo');
      insert into public.completed_sets (completed_workout_id, exercise_name, set_number, reps, weight_kg, rpe, is_warmup)
      values
        (completed_id, case when title like 'Lower%' then 'Back squat' else 'Bench press' end, 1, 5, case when title like 'Lower%' then 140 else 100 end, 8, false);
    end if;
  end loop;

  insert into public.workouts (
    plan_id, user_id, scheduled_date, sport, title, objective, duration_min, intensity, expected_load, importance, recovery_hours, status, why_text, data_origin
  ) values
    (plan_id, athlete, current_date, 'running', 'Zone 2 run', 'Aerobic support', 35, 'easy', 25, 'supporting', 18, 'planned',
      'Yesterday''s lower-body work is still in the legs, so the interval session is not today. Easy running keeps the aerobic week without asking for speed.', 'demo'),
    (plan_id, athlete, current_date, 'strength', 'Upper-body strength', 'Keep pressing strength while the legs recover', 50, 'moderate', 50, 'supporting', 24, 'planned',
      'Upper-body work does not add to the lower-body fatigue that tomorrow''s squat session and the later interval run both need.', 'demo');

  insert into public.workouts (
    id, plan_id, user_id, scheduled_date, sport, title, objective, duration_min, intensity, expected_load, importance, recovery_hours, status, why_text, data_origin
  ) values (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', plan_id, athlete, current_date + 1, 'strength', 'Heavy lower-body strength',
    'Maintain squat strength inside the triathlon week', 60, 'max', 78, 'key', 48, 'planned',
    'Squat strength supports the run, but it needs a day before the interval session.', 'demo'
  ) returning id into lower_id;

  insert into public.workouts (
    id, plan_id, user_id, scheduled_date, sport, title, objective, duration_min, intensity, expected_load, importance, recovery_hours, status, why_text, data_origin
  ) values (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', plan_id, athlete, current_date + 2, 'running', 'VO2 max intervals',
    'Running speed for the 70.3 run leg', 45, 'vo2', 70, 'key', 36, 'planned',
    'Short intervals raise the ceiling. They are placed after a recovery day from the heavy squat when the schedule is optimized.', 'demo'
  ) returning id into vo2_id;

  insert into public.workout_exercises (workout_id, exercise_id, sort_order, set_count, reps, why_text)
  select lower_id, id, 1, 4, '5', 'Why Tamreen chose this: heavy squats keep absolute strength while the week still has a hard run.'
  from public.exercise_library where slug = 'back_squat';
  insert into public.workout_exercises (workout_id, exercise_id, sort_order, set_count, reps, why_text)
  select lower_id, id, 2, 3, '8', 'Why Tamreen chose this: single-leg posterior-chain strength and hip stability for running mechanics.'
  from public.exercise_library where slug = 'single_leg_rdl';
  insert into public.workout_exercises (workout_id, exercise_id, sort_order, set_count, reps, why_text)
  select lower_id, id, 3, 3, '12', 'Why Tamreen chose this: calf and soleus strength for running economy.'
  from public.exercise_library where slug = 'calf_raise';

  insert into public.training_conflicts (user_id, workout_a_id, workout_b_id, severity, title, explanation, recommendation, status, data_origin)
  values (
    athlete, lower_id, vo2_id, 'high', 'Training conflict detected',
    'Heavy lower-body strength training may reduce the quality of the interval session two days later if recovery is short.',
    jsonb_build_object('factors', jsonb_build_array('Heavy squat session', 'VO2 run inside 48 hours', 'Shared lower-body fatigue')),
    'open', 'demo'
  );

  insert into public.ai_recommendations (user_id, kind, title, body, factors, proposed_changes, status, data_origin)
  values (
    athlete, 'schedule', 'Today''s intervals became Zone 2',
    'Your lower-body training load is elevated after the recent squat work. Today''s interval run is an easy Zone 2 session instead.',
    jsonb_build_array(
      jsonb_build_object('label', 'Lower-body load', 'detail', 'Recent squat sessions add local fatigue that intervals would ask to be fresh.'),
      jsonb_build_object('label', 'Recovery', 'detail', 'Readiness is usable for easy aerobic work, not for a quality run.'),
      jsonb_build_object('label', 'Key session ahead', 'detail', 'The VO2 session later this week is the one to protect.')
    ),
    '[]'::jsonb,
    'pending',
    'demo'
  );

  insert into public.recovery_logs (user_id, logged_on, sleep_hours, sleep_quality, soreness, fatigue, motivation, stress, resting_hr, hrv, notes, data_origin)
  select athlete, current_date - g, 7.4, 4, 2, 2, 4, 2, 52, 68, 'Seeded demo check-in.', 'demo'
  from generate_series(0, 20) as g;

  insert into public.readiness_scores (
    user_id, scored_on, overall, sleep, recovery, recent_load, muscle_fatigue, cardio_fatigue,
    train_recommendation, explanation, factors, blocked_for_safety, data_origin
  )
  select
    athlete,
    current_date - g,
    74 - (g % 5),
    78,
    72,
    70,
    64,
    76,
    'train_as_planned',
    'Readiness uses the seeded check-in. Sleep quality is 4/5 and soreness is 2/5. This is demo history, not a sensor reading.',
    jsonb_build_array(jsonb_build_object('label', 'Sleep', 'detail', '4/5 quality and about 7.4 hours.')),
    false,
    'demo'
  from generate_series(0, 20) as g;

  insert into public.performance_scores (user_id, scored_on, dimension, score, explanation, factors, sample_size, data_origin)
  select athlete, current_date - (g * 7), dimension, score, explanation, factors, sample_size, 'demo'
  from generate_series(0, 12) as g
  cross join (
    values
      ('strength', 77, 'Strength is 77, averaged from squat, bench, and deadlift using the men''s reference band. Each lift is scored from its multiple of body weight. A score of 70 matches the reference.', '[{"label":"Squat","detail":"140 kg at 76 kg body weight."}]'::jsonb, 3),
      ('running', 86, 'Running is 86. The reported 10K is 48:00, which is 288 sec/km against a 300 sec/km reference. Each second per kilometre off the target moves the score by 0.8 from 88.', '[{"label":"Pace gap","detail":"Reported 10K, not a lab test."}]'::jsonb, 1),
      ('cycling', 82, 'Cycling is 82 from 3.16 W/kg. The reference line is 2.5 W/kg = 65 and 3.5 W/kg = 90. FTP is the reported 240 W.', '[{"label":"FTP","detail":"240 W at 76 kg."}]'::jsonb, 1),
      ('swimming', 87, 'Swimming is 87 from a 105 sec/100m pace. 90 sec/100m scores 100 on this scale and each slower second costs 0.9 points.', '[{"label":"Pace","detail":"Reported 100 m pace."}]'::jsonb, 1),
      ('consistency', 84, 'Consistency is 84 because most of the seeded planned pattern was completed across the last months.', '[{"label":"Completion","detail":"Demo history, labeled as demo."}]'::jsonb, 80),
      ('recovery', 74, 'Recovery follows the latest check-in. It is not a medical score.', '[{"label":"Check-in","detail":"Sleep 4/5, soreness 2/5."}]'::jsonb, 1),
      ('overall', 82, 'The Tamreen performance score is a weighted average of strength, running, cycling, swimming, and consistency. Sports without data are left out. The Ironman 70.3 goal gives extra weight to the endurance dimensions.', '[{"label":"Primary goal","detail":"Ironman 70.3"}]'::jsonb, 5)
  ) as metric(dimension, score, explanation, factors, sample_size);

  insert into public.personal_records (user_id, sport, record_type, value, unit, achieved_on, data_origin)
  values
    (athlete, 'strength', 'Back squat', 163.3, 'kg e1rm', current_date - 12, 'demo'),
    (athlete, 'strength', 'Bench press', 116.7, 'kg e1rm', current_date - 20, 'demo'),
    (athlete, 'strength', 'Deadlift', 210.0, 'kg e1rm', current_date - 30, 'demo'),
    (athlete, 'running', '10k', 2880, 'seconds', current_date - 40, 'demo'),
    (athlete, 'running', '5k', 1320, 'seconds', current_date - 55, 'demo'),
    (athlete, 'cycling', 'ftp', 240, 'watts', current_date - 18, 'demo'),
    (athlete, 'swimming', '100m', 105, 'seconds', current_date - 25, 'demo');

  insert into public.notifications (user_id, kind, title, body, href)
  values (
    athlete, 'plan_adjustment', 'Your recovery is lower than a hard day',
    'Today stays aerobic. The explanation is on Home.', '/home'
  );

  insert into public.coach_athletes (coach_id, athlete_id, status, authorized_at)
  values (coach, athlete, 'active', now())
  on conflict (coach_id, athlete_id) do update set status = 'active', authorized_at = now();

  insert into public.gyms (id, name, owner_id, location)
  values (demo_gym, 'Tamreen Demo Gym', gym_user, 'Doha')
  on conflict (id) do nothing;

  if not exists (
    select 1 from public.gym_cameras cameras
    where cameras.gym_id = demo_gym and cameras.name = 'Floor camera 1'
  ) then
    insert into public.gym_cameras (gym_id, name, location, status, identification_mode, facial_recognition_enabled)
    values (demo_gym, 'Floor camera 1', 'Strength floor', 'offline', 'qr_checkin', false);
  end if;

  insert into public.gym_members (gym_id, user_id, role, consent_session_analysis)
  values (demo_gym, athlete, 'member', true)
  on conflict (gym_id, user_id) do nothing;

  insert into public.event_organizations (id, name, owner_id)
  values (org_id, 'Tamreen Demo Events', events_user)
  on conflict (id) do nothing;
end $$;
