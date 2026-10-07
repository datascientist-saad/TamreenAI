-- Platform tables, authorization helpers, RLS, storage, and reference data.

create table public.gym_members (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'coach', 'admin')),
  consent_session_analysis boolean not null default false,
  qr_token text unique,
  created_at timestamptz not null default now(),
  unique (gym_id, user_id)
);

create table public.gym_cameras (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  name text not null,
  location text,
  status text not null default 'offline' check (status in ('offline', 'online', 'maintenance')),
  identification_mode text not null default 'qr_checkin'
    check (identification_mode in ('qr_checkin', 'session_assignment', 'authenticated_device', 'manual')),
  facial_recognition_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  constraint gym_cameras_no_facial_recognition check (facial_recognition_enabled = false)
);

comment on table public.gym_cameras is
  'Gym cameras never use facial recognition. Athletes are linked by QR, assignment, device, or manual selection.';

create table public.gym_equipment (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  name text not null,
  quantity integer not null default 1 check (quantity >= 0),
  status text not null default 'available'
);

create table public.gym_sessions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  user_id uuid references public.profiles (id),
  camera_id uuid references public.gym_cameras (id),
  checkin_method text not null
    check (checkin_method in ('qr', 'session_assignment', 'authenticated_device', 'manual')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text not null default ''
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.wearable_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in (
    'garmin', 'apple_health', 'health_connect', 'whoop', 'strava', 'oura'
  )),
  status text not null default 'disconnected'
    check (status in ('disconnected', 'pending', 'connected', 'error')),
  external_athlete_id text,
  connected_at timestamptz,
  last_sync_at timestamptz,
  unique (user_id, provider)
);

create table public.product_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);

create index workouts_user_date_idx on public.workouts (user_id, scheduled_date) where deleted_at is null;
create index completed_workouts_user_started_idx on public.completed_workouts (user_id, started_at desc);
create index recovery_logs_user_date_idx on public.recovery_logs (user_id, logged_on desc);
create index readiness_user_date_idx on public.readiness_scores (user_id, scored_on desc);
create index performance_scores_user_dim_idx on public.performance_scores (user_id, dimension, scored_on desc);
create index personal_records_user_idx on public.personal_records (user_id, sport, record_type);
create index events_owner_idx on public.events (owner_user_id, starts_on) where deleted_at is null;
create index training_plans_user_idx on public.training_plans (user_id, status) where deleted_at is null;
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index coach_athletes_athlete_idx on public.coach_athletes (athlete_id, status);
create index coach_athletes_coach_idx on public.coach_athletes (coach_id, status);
create index workout_exercises_workout_idx on public.workout_exercises (workout_id);
create index completed_sets_workout_idx on public.completed_sets (completed_workout_id);
create index running_sessions_user_idx on public.running_sessions (user_id);
create index cycling_sessions_user_idx on public.cycling_sessions (user_id);
create index swimming_sessions_user_idx on public.swimming_sessions (user_id);
create index live_sessions_user_idx on public.live_training_sessions (user_id, started_at desc);
create index rate_limit_lookup_idx on public.rate_limit_events (user_id, action, created_at desc);
create index user_roles_user_idx on public.user_roles (user_id) where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Private helpers. security definer so policies can read relationship rows
-- without recursive RLS. search_path is empty to prevent hijacking.
-- ---------------------------------------------------------------------------

create or replace function private.has_role(target public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = target
      and revoked_at is null
  );
$$;

create or replace function private.is_coach_of(athlete uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.coach_athletes
    where coach_id = (select auth.uid())
      and athlete_id = athlete
      and status = 'active'
  );
$$;

create or replace function private.can_read_athlete(athlete uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select athlete is not null
    and (athlete = (select auth.uid()) or private.is_coach_of(athlete));
$$;

create or replace function private.is_gym_owner(gym uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gyms g
    where g.id = gym and g.owner_id = (select auth.uid()) and g.deleted_at is null
  );
$$;

create or replace function private.is_org_owner(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_organizations o
    where o.id = org and o.owner_id = (select auth.uid()) and o.deleted_at is null
  );
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.stamp_origin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  demo boolean := false;
begin
  if (select auth.uid()) is not null then
    select p.is_demo into demo from public.profiles p where p.id = (select auth.uid());
    if demo then
      new.data_origin := 'demo';
    elsif tg_op = 'INSERT' then
      new.data_origin := 'user';
    else
      new.data_origin := old.data_origin;
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.lock_user_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'owner cannot be reassigned';
  end if;
  return new;
end;
$$;

create or replace function private.protect_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated' and not private.has_role('super_admin') then
    new.is_demo := old.is_demo;
    new.id := old.id;
  end if;
  return new;
end;
$$;

create or replace function private.block_unverified_wearable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'connected' and coalesce(new.external_athlete_id, '') = '' then
    raise exception 'This provider is not connected. Tamreen will not mark a wearable as linked without a real authorization.';
  end if;
  return new;
end;
$$;

create or replace function private.guard_coach_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.coach_id <> (select auth.uid()) or new.status <> 'pending' or not private.has_role('coach') then
      raise exception 'Only a coach can create a pending athlete link';
    end if;
  else
    if new.coach_id is distinct from old.coach_id or new.athlete_id is distinct from old.athlete_id then
      raise exception 'link identity is fixed';
    end if;
    if (select auth.uid()) = old.athlete_id and new.status in ('active', 'revoked') then
      if new.status = 'active' and old.status = 'pending' then
        new.authorized_at := now();
      end if;
    elsif (select auth.uid()) = old.coach_id and new.status = 'revoked' then
      null;
    elsif private.has_role('super_admin') then
      null;
    else
      raise exception 'not authorized to change this coaching link';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.athlete_measurement_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  if (select auth.uid()) is null then
    return old;
  end if;
  if tg_table_name = 'completed_sets' then
    select cw.user_id into owner
    from public.completed_workouts cw
    where cw.id = old.completed_workout_id;
  elsif tg_table_name in ('pose_analysis', 'form_analysis') then
    select s.user_id into owner
    from public.live_training_sessions s
    where s.id = old.session_id;
  else
    owner := old.user_id;
  end if;
  if owner is distinct from (select auth.uid()) then
    raise exception 'only the athlete can delete measured training data';
  end if;
  return old;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, 'athlete'), '@', 1)
    )
  );
  insert into public.user_roles (user_id, role) values (new.id, 'athlete');
  insert into public.user_settings (user_id) values (new.id);
  insert into public.athlete_profiles (user_id) values (new.id);
  insert into public.subscriptions (user_id, plan_code, status) values (new.id, 'free', 'active');
  return new;
end;
$$;

create or replace function private.notify_coach_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, title, body, href)
  values (new.athlete_id, 'coach_feedback', 'Coach feedback', left(new.body, 180), '/notifications');
  return new;
end;
$$;

create or replace function private.notify_personal_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, title, body, href)
  values (
    new.user_id,
    'new_pr',
    'New personal record',
    new.record_type || ' · ' || new.value::text || ' ' || new.unit,
    '/records'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create trigger coach_athletes_guard
  before insert or update on public.coach_athletes
  for each row execute function private.guard_coach_link();

create trigger coach_feedback_notify
  after insert on public.coach_feedback
  for each row execute function private.notify_coach_feedback();

create trigger personal_records_notify
  after insert on public.personal_records
  for each row execute function private.notify_personal_record();

create trigger profiles_protect before update on public.profiles
  for each row execute function private.protect_profile();

create trigger wearable_guard before insert or update on public.wearable_connections
  for each row execute function private.block_unverified_wearable();

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'profiles', 'athlete_profiles', 'user_settings', 'subscriptions',
    'athlete_goals', 'injuries', 'event_organizations', 'events',
    'training_plans', 'workouts', 'ai_recommendations', 'gyms'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
      tbl || '_touch', tbl
    );
  end loop;
end $$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'events', 'event_results', 'training_plans', 'workouts', 'completed_workouts',
    'strength_sessions', 'running_sessions', 'cycling_sessions', 'swimming_sessions',
    'live_training_sessions', 'performance_scores', 'personal_records', 'recovery_logs',
    'readiness_scores', 'training_conflicts', 'ai_recommendations'
  ]
  loop
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function private.stamp_origin()',
      tbl || '_origin', tbl
    );
  end loop;
end $$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'athlete_profiles', 'athlete_sports', 'athlete_goals', 'injuries', 'training_plans',
    'training_blocks', 'workouts', 'completed_workouts', 'strength_sessions',
    'running_sessions', 'cycling_sessions', 'swimming_sessions', 'live_training_sessions',
    'performance_scores', 'personal_records', 'recovery_logs', 'readiness_scores',
    'training_conflicts', 'ai_recommendations', 'notifications', 'wearable_connections',
    'event_registrations', 'gym_members', 'subscriptions'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.lock_user_id()',
      tbl || '_lock_owner', tbl
    );
  end loop;
end $$;

-- Privileged RPCs live in public so the Data API can call them, but they
-- delegate checks to private helpers, pin search_path, and write an audit row.
create or replace function public.consume_rate_limit(action text, max_calls integer, window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  calls integer;
begin
  if (select auth.uid()) is null then
    return false;
  end if;
  if max_calls < 1 or window_seconds < 1 or window_seconds > 86400 then
    raise exception 'invalid rate limit';
  end if;
  insert into public.rate_limit_events (user_id, action)
  values ((select auth.uid()), action);
  select count(*) into calls
  from public.rate_limit_events
  where user_id = (select auth.uid())
    and rate_limit_events.action = consume_rate_limit.action
    and created_at > now() - make_interval(secs => window_seconds);
  return calls <= max_calls;
end;
$$;

create or replace function public.admin_grant_role(target uuid, new_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role('super_admin') then
    raise exception 'not authorized';
  end if;
  insert into public.user_roles (user_id, role, granted_by)
  values (target, new_role, (select auth.uid()))
  on conflict (user_id, role) do update
    set revoked_at = null, granted_by = excluded.granted_by;
  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values ((select auth.uid()), 'grant_role', 'user_roles', target, jsonb_build_object('role', new_role));
end;
$$;

create or replace function public.admin_revoke_role(target uuid, old_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role('super_admin') then
    raise exception 'not authorized';
  end if;
  if target = (select auth.uid()) and old_role = 'super_admin' then
    raise exception 'cannot remove your own super admin role';
  end if;
  update public.user_roles
    set revoked_at = now()
    where user_id = target and role = old_role and revoked_at is null;
  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values ((select auth.uid()), 'revoke_role', 'user_roles', target, jsonb_build_object('role', old_role));
end;
$$;

create or replace function public.admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not private.has_role('super_admin') then
    raise exception 'not authorized';
  end if;
  insert into public.audit_logs (actor_id, action, entity, metadata)
  values ((select auth.uid()), 'view_overview', 'system', '{}'::jsonb);
  select jsonb_build_object(
    'users', (select count(*) from public.profiles where deleted_at is null),
    'athletes', (select count(*) from public.user_roles where role = 'athlete' and revoked_at is null),
    'coaches', (select count(*) from public.user_roles where role = 'coach' and revoked_at is null),
    'gyms', (select count(*) from public.gyms where deleted_at is null),
    'events', (select count(*) from public.events where deleted_at is null),
    'training_sessions', (select count(*) from public.completed_workouts),
    'live_sessions', (select count(*) from public.live_training_sessions),
    'ai_analyses', (select count(*) from public.form_analysis),
    'subscriptions', (select count(*) from public.subscriptions where status = 'active'),
    'feedback', (select count(*) from public.product_feedback)
  ) into result;
  return result;
end;
$$;

create or replace function public.admin_list_users()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not private.has_role('super_admin') then
    raise exception 'not authorized';
  end if;
  insert into public.audit_logs (actor_id, action, entity, metadata)
  values ((select auth.uid()), 'list_users', 'profiles', '{}'::jsonb);
  select coalesce(jsonb_agg(row_data), '[]'::jsonb) into result
  from (
    select jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'onboarding_completed', p.onboarding_completed,
      'is_demo', p.is_demo,
      'created_at', p.created_at,
      'roles', (
        select coalesce(jsonb_agg(r.role), '[]'::jsonb)
        from public.user_roles r
        where r.user_id = p.id and r.revoked_at is null
      )
    ) as row_data
    from public.profiles p
    where p.deleted_at is null
    order by p.created_at desc
    limit 200
  ) listed;
  return result;
end;
$$;

create or replace function public.admin_athlete_bundle(target uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not private.has_role('super_admin') then
    raise exception 'not authorized';
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values ((select auth.uid()), 'view_athlete', 'profiles', target, '{}'::jsonb);
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = target),
    'athlete', (select to_jsonb(a) from public.athlete_profiles a where a.user_id = target),
    'roles', (
      select coalesce(jsonb_agg(r.role), '[]'::jsonb)
      from public.user_roles r where r.user_id = target and r.revoked_at is null
    ),
    'recent_workouts', (
      select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb)
      from (
        select id, scheduled_date, sport, title, status, duration_min
        from public.workouts
        where user_id = target and deleted_at is null
        order by scheduled_date desc
        limit 20
      ) w
    ),
    'recovery', (
      select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb)
      from (
        select logged_on, sleep_hours, sleep_quality, soreness, fatigue, motivation, severe_symptoms
        from public.recovery_logs
        where user_id = target
        order by logged_on desc
        limit 14
      ) l
    ),
    'subscription', (select to_jsonb(s) from public.subscriptions s where s.user_id = target)
  ) into result;
  return result;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.set_updated_at() to authenticated, service_role;
grant execute on function private.stamp_origin() to authenticated, service_role;
grant execute on function private.lock_user_id() to authenticated, service_role;
grant execute on function private.protect_profile() to authenticated, service_role;
grant execute on function private.block_unverified_wearable() to authenticated, service_role;
grant execute on function private.guard_coach_link() to authenticated, service_role;
grant execute on function private.notify_coach_feedback() to authenticated, service_role;
grant execute on function private.notify_personal_record() to authenticated, service_role;
grant execute on function private.handle_new_user() to supabase_auth_admin, service_role;
grant execute on function private.athlete_measurement_delete() to authenticated, service_role;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'completed_workouts', 'completed_sets', 'strength_sessions', 'running_sessions',
    'cycling_sessions', 'swimming_sessions', 'live_training_sessions', 'pose_analysis',
    'form_analysis', 'performance_scores', 'personal_records', 'recovery_logs', 'readiness_scores'
  ]
  loop
    execute format(
      'create trigger %I before delete on public.%I for each row execute function private.athlete_measurement_delete()',
      tbl || '_athlete_delete', tbl
    );
  end loop;
end $$;
grant execute on function private.has_role(public.app_role) to authenticated;
grant execute on function private.is_coach_of(uuid) to authenticated;
grant execute on function private.can_read_athlete(uuid) to authenticated;
grant execute on function private.is_gym_owner(uuid) to authenticated;
grant execute on function private.is_org_owner(uuid) to authenticated;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon;
revoke all on function public.admin_grant_role(uuid, public.app_role) from public, anon;
revoke all on function public.admin_revoke_role(uuid, public.app_role) from public, anon;
revoke all on function public.admin_overview() from public, anon;
revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_athlete_bundle(uuid) from public, anon;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;
grant execute on function public.admin_grant_role(uuid, public.app_role) to authenticated;
grant execute on function public.admin_revoke_role(uuid, public.app_role) to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_athlete_bundle(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
    execute format('alter table public.%I force row level security', r.tablename);
  end loop;
end $$;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.sports, public.goals, public.exercise_library to anon;
grant select on public.events to anon;
revoke all on public.rate_limit_events from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (deleted_at is null and (id = (select auth.uid()) or private.has_role('super_admin')));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or private.has_role('super_admin'))
  with check (id = (select auth.uid()) or private.has_role('super_admin'));

create policy athlete_profiles_rw on public.athlete_profiles for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()) or private.is_coach_of(user_id));

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role('super_admin'));

create policy user_settings_rw on public.user_settings for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy subscriptions_select on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role('super_admin'));

create policy sports_read on public.sports for select to anon, authenticated using (true);
create policy goals_read on public.goals for select to anon, authenticated using (true);
create policy exercise_library_read on public.exercise_library for select to anon, authenticated using (true);

create policy athlete_sports_rw on public.athlete_sports for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

create policy athlete_goals_rw on public.athlete_goals for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

create policy injuries_rw on public.injuries for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

create policy event_orgs_rw on public.event_organizations for all to authenticated
  using (owner_id = (select auth.uid()) or private.has_role('super_admin'))
  with check (owner_id = (select auth.uid()) and private.has_role('event_admin'));

create policy events_public_read on public.events for select to anon, authenticated
  using (is_public and deleted_at is null);
create policy events_owner_rw on public.events for all to authenticated
  using (
    deleted_at is null and (
      owner_user_id = (select auth.uid())
      or (organization_id is not null and private.is_org_owner(organization_id))
      or private.is_coach_of(owner_user_id)
    )
  )
  with check (
    owner_user_id = (select auth.uid())
    or (organization_id is not null and private.is_org_owner(organization_id))
  );

create policy registrations_rw on public.event_registrations for all to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_coach_of(user_id)
    or exists (
      select 1 from public.events e
      where e.id = event_id and e.organization_id is not null and private.is_org_owner(e.organization_id)
    )
  )
  with check (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.events e
      where e.id = event_id and e.organization_id is not null and private.is_org_owner(e.organization_id)
    )
  );

create policy checkpoints_read on public.event_checkpoints for select to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and (
        e.is_public
        or e.owner_user_id = (select auth.uid())
        or (e.organization_id is not null and private.is_org_owner(e.organization_id))
        or exists (
          select 1 from public.event_registrations r
          where r.event_id = e.id and r.user_id = (select auth.uid())
        )
      )
    )
  );
create policy checkpoints_write on public.event_checkpoints for all to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.organization_id is not null and private.is_org_owner(e.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.organization_id is not null and private.is_org_owner(e.organization_id)
    )
  );

create policy results_rw on public.event_results for all to authenticated
  using (
    exists (
      select 1
      from public.event_registrations r
      join public.events e on e.id = r.event_id
      where r.id = registration_id
        and (
          r.user_id = (select auth.uid())
          or private.is_coach_of(r.user_id)
          or (e.organization_id is not null and private.is_org_owner(e.organization_id))
        )
    )
  )
  with check (
    exists (
      select 1
      from public.event_registrations r
      join public.events e on e.id = r.event_id
      where r.id = registration_id
        and (
          r.user_id = (select auth.uid())
          or (e.organization_id is not null and private.is_org_owner(e.organization_id))
        )
    )
  );

create policy plans_rw on public.training_plans for all to authenticated
  using (deleted_at is null and private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()) or private.is_coach_of(user_id));

create policy blocks_rw on public.training_blocks for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()) or private.is_coach_of(user_id));

create policy workouts_rw on public.workouts for all to authenticated
  using (deleted_at is null and private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()) or private.is_coach_of(user_id));

create policy workout_exercises_rw on public.workout_exercises for all to authenticated
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.deleted_at is null and private.can_read_athlete(w.user_id)
    )
  )
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and (w.user_id = (select auth.uid()) or private.is_coach_of(w.user_id))
    )
  );

create policy exercise_sets_rw on public.exercise_sets for all to authenticated
  using (
    exists (
      select 1
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id and private.can_read_athlete(w.user_id)
    )
  )
  with check (
    exists (
      select 1
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id
        and (w.user_id = (select auth.uid()) or private.is_coach_of(w.user_id))
    )
  );

create policy completed_rw on public.completed_workouts for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

create policy completed_sets_rw on public.completed_sets for all to authenticated
  using (
    exists (
      select 1 from public.completed_workouts cw
      where cw.id = completed_workout_id and private.can_read_athlete(cw.user_id)
    )
  )
  with check (
    exists (
      select 1 from public.completed_workouts cw
      where cw.id = completed_workout_id and cw.user_id = (select auth.uid())
    )
  );

create policy strength_sessions_rw on public.strength_sessions for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));
create policy running_sessions_rw on public.running_sessions for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));
create policy cycling_sessions_rw on public.cycling_sessions for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));
create policy swimming_sessions_rw on public.swimming_sessions for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

create policy live_rw on public.live_training_sessions for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));

create policy pose_rw on public.pose_analysis for all to authenticated
  using (
    exists (
      select 1 from public.live_training_sessions s
      where s.id = session_id and private.can_read_athlete(s.user_id)
    )
  )
  with check (
    exists (
      select 1 from public.live_training_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );

create policy form_rw on public.form_analysis for all to authenticated
  using (
    exists (
      select 1 from public.live_training_sessions s
      where s.id = session_id and private.can_read_athlete(s.user_id)
    )
  )
  with check (
    exists (
      select 1 from public.live_training_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );

create policy scores_rw on public.performance_scores for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));
create policy records_rw on public.personal_records for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));
create policy recovery_rw on public.recovery_logs for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));
create policy readiness_rw on public.readiness_scores for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()));
create policy conflicts_rw on public.training_conflicts for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()) or private.is_coach_of(user_id));
create policy recommendations_rw on public.ai_recommendations for all to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()) or private.is_coach_of(user_id));

create policy coach_links_select on public.coach_athletes for select to authenticated
  using (
    coach_id = (select auth.uid())
    or athlete_id = (select auth.uid())
    or private.has_role('super_admin')
  );
create policy coach_links_write on public.coach_athletes for insert to authenticated
  with check (coach_id = (select auth.uid()));
create policy coach_links_update on public.coach_athletes for update to authenticated
  using (coach_id = (select auth.uid()) or athlete_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()) or athlete_id = (select auth.uid()));

create policy coach_feedback_select on public.coach_feedback for select to authenticated
  using (coach_id = (select auth.uid()) or athlete_id = (select auth.uid()));
create policy coach_feedback_insert on public.coach_feedback for insert to authenticated
  with check (coach_id = (select auth.uid()) and private.is_coach_of(athlete_id));

create policy gyms_select on public.gyms for select to authenticated
  using (
    deleted_at is null and (
      owner_id = (select auth.uid())
      or private.has_role('super_admin')
      or exists (
        select 1 from public.gym_members m
        where m.gym_id = gyms.id and m.user_id = (select auth.uid())
      )
    )
  );
create policy gyms_write on public.gyms for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and private.has_role('gym_admin'));

create policy gym_members_rw on public.gym_members for all to authenticated
  using (user_id = (select auth.uid()) or private.is_gym_owner(gym_id))
  with check (private.is_gym_owner(gym_id));

create policy gym_cameras_rw on public.gym_cameras for all to authenticated
  using (private.is_gym_owner(gym_id))
  with check (private.is_gym_owner(gym_id) and facial_recognition_enabled = false);

create policy gym_equipment_select on public.gym_equipment for select to authenticated
  using (
    private.is_gym_owner(gym_id)
    or exists (
      select 1 from public.gym_members m
      where m.gym_id = gym_equipment.gym_id and m.user_id = (select auth.uid())
    )
  );
create policy gym_equipment_write on public.gym_equipment for all to authenticated
  using (private.is_gym_owner(gym_id))
  with check (private.is_gym_owner(gym_id));

create policy gym_sessions_rw on public.gym_sessions for all to authenticated
  using (user_id = (select auth.uid()) or private.is_gym_owner(gym_id))
  with check (
    exists (
      select 1 from public.gym_members m
      where m.gym_id = gym_sessions.gym_id and m.user_id = gym_sessions.user_id
    )
    and (user_id = (select auth.uid()) or private.is_gym_owner(gym_id))
  );

create policy notifications_rw on public.notifications for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy wearables_rw on public.wearable_connections for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy feedback_insert on public.product_feedback for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy feedback_select on public.product_feedback for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role('super_admin'));

create policy audit_select on public.audit_logs for select to authenticated
  using (private.has_role('super_admin'));

-- ---------------------------------------------------------------------------
-- Storage. Sensitive recordings stay private and are read with signed URLs.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('exercise-media', 'exercise-media', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  ('live-training-recordings', 'live-training-recordings', false, 209715200, array['video/webm', 'video/mp4']),
  ('event-media', 'event-media', false, 52428800, array['image/jpeg', 'image/png', 'image/webp']),
  ('coach-media', 'coach-media', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf'])
on conflict (id) do nothing;

create policy avatars_read on storage.objects for select to public
  using (bucket_id = 'avatars');
create policy exercise_media_read on storage.objects for select to public
  using (bucket_id = 'exercise-media');

create policy avatars_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy live_recordings_rw on storage.objects for all to authenticated
  using (bucket_id = 'live-training-recordings' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'live-training-recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy coach_media_rw on storage.objects for all to authenticated
  using (
    bucket_id = 'coach-media'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or private.is_coach_of(((storage.foldername(name))[1])::uuid)
    )
  )
  with check (
    bucket_id = 'coach-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy event_media_rw on storage.objects for all to authenticated
  using (
    bucket_id = 'event-media'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and private.is_org_owner(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'event-media'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and private.is_org_owner(((storage.foldername(name))[1])::uuid)
  );

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- Reference catalogs. These are system data, not athlete measurements.
insert into public.sports (slug, name, description) values
  ('strength', 'Strength training', 'Barbell and accessory work that supports the rest of the week.'),
  ('bodybuilding', 'Bodybuilding', 'Hypertrophy work organized around muscle groups and recovery.'),
  ('running', 'Running', 'Easy, tempo, interval, and long-run training.'),
  ('cycling', 'Cycling', 'Endurance, sweet spot, threshold, and brick riding.'),
  ('swimming', 'Swimming', 'Technique, endurance, and threshold swimming.'),
  ('triathlon', 'Triathlon', 'Swim, bike, and run combined into one plan.')
on conflict (slug) do nothing;

insert into public.goals (slug, name, category, description) values
  ('build_muscle', 'Build muscle', 'physique', 'Add muscle while keeping the rest of training compatible.'),
  ('lose_fat', 'Lose fat', 'physique', 'Reduce body fat without collapsing training quality.'),
  ('recomposition', 'Recomposition', 'physique', 'Build muscle and lose fat together.'),
  ('increase_strength', 'Increase strength', 'strength', 'Raise squat, bench, deadlift, and related lifts.'),
  ('improve_5k', 'Improve 5K', 'running', 'Get faster over 5 kilometres.'),
  ('improve_10k', 'Improve 10K', 'running', 'Get faster over 10 kilometres.'),
  ('half_marathon', 'Half marathon', 'running', 'Prepare for 21.1 kilometres.'),
  ('marathon', 'Marathon', 'running', 'Prepare for 42.2 kilometres.'),
  ('sprint_triathlon', 'Sprint triathlon', 'triathlon', 'Prepare for a sprint-distance triathlon.'),
  ('olympic_triathlon', 'Olympic triathlon', 'triathlon', 'Prepare for a 1.5 km / 40 km / 10 km triathlon.'),
  ('ironman_70_3', 'Ironman 70.3', 'triathlon', 'Prepare for a 1.9 km / 90 km / 21.1 km triathlon.'),
  ('ironman', 'Ironman', 'triathlon', 'Prepare for a full-distance triathlon.'),
  ('improve_cycling', 'Improve cycling', 'cycling', 'Raise endurance and sustainable power.'),
  ('improve_swimming', 'Improve swimming', 'swimming', 'Raise swim fitness and pace control.'),
  ('general_hybrid', 'General hybrid fitness', 'hybrid', 'Stay strong and aerobically fit across sports.'),
  ('custom', 'Custom', 'custom', 'A goal described in the athlete''s own words.')
on conflict (slug) do nothing;

insert into public.exercise_library (
  slug, name, muscle_group, equipment, movement_pattern, sport_relevance, instructions, alternative_slugs, why_template, live_supported
) values
  ('back_squat', 'Back squat', 'quads', 'barbell', 'squat', array['strength','running','cycling','triathlon'],
    'Brace, sit between the hips, and stand tall. Keep the knees tracking over the feet.',
    array['goblet_squat','leg_press'], 'Builds lower-body strength that supports running and cycling posture under fatigue.', true),
  ('bench_press', 'Bench press', 'chest', 'barbell', 'horizontal_push', array['strength','bodybuilding','swimming'],
    'Plant the feet, pull the shoulder blades together, and lower the bar to the chest with control.',
    array['push_up','dumbbell_press'], 'Builds horizontal pressing strength without dominating the aerobic week.', true),
  ('deadlift', 'Deadlift', 'posterior_chain', 'barbell', 'hinge', array['strength','running','cycling'],
    'Push the floor away, keep the bar close, and lock out without leaning back.',
    array['romanian_deadlift','trap_bar_deadlift'], 'Trains the posterior chain used to hold posture late in a long run or ride.', true),
  ('overhead_press', 'Overhead press', 'shoulders', 'barbell', 'vertical_push', array['strength','bodybuilding','swimming'],
    'Squeeze the glutes, keep the ribs down, and press the bar over the mid-foot.',
    array['dumbbell_shoulder_press'], 'Builds overhead strength and trunk stiffness that carries into the swim and daily posture.', true),
  ('walking_lunge', 'Walking lunge', 'quads', 'dumbbell', 'lunge', array['running','triathlon','strength'],
    'Take a controlled step, drop the back knee, and drive through the front foot.',
    array['split_squat'], 'Trains each leg on its own, which matches the single-leg demand of running.', true),
  ('romanian_deadlift', 'Romanian deadlift', 'hamstrings', 'barbell', 'hinge', array['running','cycling','strength'],
    'Soft knees, push the hips back, and stop when the hamstrings limit the range.',
    array['single_leg_rdl'], 'Loads the hamstrings through a long range, which supports hip extension for running and cycling.', true),
  ('single_leg_rdl', 'Single-leg Romanian deadlift', 'hamstrings', 'dumbbell', 'hinge', array['running','cycling','triathlon'],
    'Hinge on one leg with a quiet pelvis. Reach only as far as the hips stay level.',
    array['romanian_deadlift'], 'Improves unilateral posterior-chain strength and hip stability relevant to running mechanics.', true),
  ('split_squat', 'Bulgarian split squat', 'quads', 'dumbbell', 'lunge', array['cycling','running','triathlon'],
    'Keep the front heel down and the torso tall. Drive up without pushing off the back leg.',
    array['walking_lunge'], 'Builds single-leg strength and knee control for pedaling and running.', false),
  ('hip_thrust', 'Hip thrust', 'glutes', 'barbell', 'hinge', array['cycling','running','strength'],
    'Drive through the heels and finish with the ribs down and the glutes tight.',
    array['glute_bridge'], 'Trains hip extension, the position where cyclists and runners produce force.', false),
  ('calf_raise', 'Standing calf raise', 'calves', 'machine', 'ankle', array['running','triathlon'],
    'Pause at the top and lower slowly. Keep the knee soft but not collapsed.',
    array['soleus_raise'], 'Raises calf capacity so easy and long runs cost less at the ankle.', false),
  ('soleus_raise', 'Seated soleus raise', 'calves', 'machine', 'ankle', array['running','triathlon'],
    'With the knee bent, lift the heel and lower for three seconds.',
    array['calf_raise'], 'The soleus does a large share of the work in distance running. This trains it directly.', false),
  ('hamstring_curl', 'Hamstring curl', 'hamstrings', 'machine', 'knee_flexion', array['running','triathlon'],
    'Curl smoothly and control the return. Do not let the hips shoot up.',
    array['romanian_deadlift'], 'Adds knee-flexion strength that complements hinging for runners.', false),
  ('face_pull', 'Face pull', 'upper_back', 'cable', 'horizontal_pull', array['swimming','strength'],
    'Pull toward the face with the elbows high and finish with external rotation.',
    array['band_external_rotation'], 'Balances pressing and supports the shoulder position used in swimming.', false),
  ('band_external_rotation', 'Band external rotation', 'rotator_cuff', 'band', 'shoulder', array['swimming','strength'],
    'Keep the elbow on the side and rotate the forearm out without shrugging.',
    array['face_pull'], 'Trains the rotator cuff so swim volume does not outrun shoulder control.', false),
  ('lat_pulldown', 'Lat pulldown', 'lats', 'cable', 'vertical_pull', array['swimming','bodybuilding','strength'],
    'Pull the elbows toward the ribs and pause when the bar reaches the chest.',
    array['pull_up'], 'Builds the lat strength swimmers use in the catch and pull.', true),
  ('pull_up', 'Pull-up', 'lats', 'bar', 'vertical_pull', array['swimming','strength','bodybuilding'],
    'Start from a full hang and pull the chest toward the bar without swinging.',
    array['lat_pulldown'], 'A bodyweight vertical pull that transfers to the swim stroke and upper-body strength.', true),
  ('push_up', 'Push-up', 'chest', 'bodyweight', 'horizontal_push', array['strength','bodybuilding','swimming'],
    'Keep a straight line from head to heel and lower until the chest approaches the floor.',
    array['bench_press'], 'A scalable press for warm-ups and sessions away from the barbell.', true),
  ('plank', 'Plank', 'core', 'bodyweight', 'brace', array['running','cycling','swimming','triathlon'],
    'Squeeze the glutes, keep the ribs down, and breathe quietly.',
    array['dead_bug'], 'Trains the trunk stiffness every sport uses when the limbs are moving.', true),
  ('dead_bug', 'Dead bug', 'core', 'bodyweight', 'brace', array['running','swimming','cycling'],
    'Keep the lower back quiet while the opposite arm and leg reach away.',
    array['plank'], 'Teaches the trunk to stay steady while the arms and legs move, as they do in all four sports.', false),
  ('pallof_press', 'Pallof press', 'core', 'cable', 'anti_rotation', array['cycling','running','swimming'],
    'Press straight out and hold. Do not let the cable rotate the ribs.',
    array['dead_bug'], 'Builds anti-rotation strength for the bike position and the swim stroke.', false),
  ('bicep_curl', 'Biceps curl', 'biceps', 'dumbbell', 'elbow_flexion', array['bodybuilding','strength'],
    'Pin the elbows and curl without swinging the torso.',
    array['hammer_curl'], 'Adds arm work when hypertrophy is a goal, placed where it does not steal recovery from key sessions.', true),
  ('step_up', 'Step-up', 'quads', 'dumbbell', 'lunge', array['running','cycling','triathlon'],
    'Drive through the top foot. Do not push off the back leg.',
    array['walking_lunge'], 'Single-leg strength in a pattern close to the running stride and the pedal stroke.', false),
  ('thoracic_rotation', 'Open book rotation', 't_spine', 'bodyweight', 'mobility', array['swimming','strength'],
    'Rotate the top arm open and follow with the eyes. Keep the hips stacked.',
    array['face_pull'], 'Restores thoracic rotation so the swim catch is not limited by the upper back.', false),
  ('farmer_carry', 'Farmer carry', 'grip', 'dumbbell', 'carry', array['strength','hybrid'],
    'Walk tall with the ribs down and quiet steps.',
    array['plank'], 'Builds trunk and grip endurance that supports heavier lifting later in the week.', false)
on conflict (slug) do nothing;
