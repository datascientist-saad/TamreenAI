-- WHOOP OAuth tokens stay encrypted. Metric rows are copied from WHOOP responses.
-- A connected wearable still requires external_athlete_id via block_unverified_wearable.

create table public.whoop_credentials (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  token_expires_at timestamptz not null,
  scopes text not null default '',
  updated_at timestamptz not null default now()
);

create table public.whoop_metrics (
  user_id uuid not null references public.profiles (id) on delete cascade,
  cycle_id bigint not null,
  day date not null,
  cycle_start timestamptz not null,
  cycle_end timestamptz,
  timezone_offset text not null default '',
  recovery_score numeric check (recovery_score is null or recovery_score between 0 and 100),
  resting_heart_rate numeric check (resting_heart_rate is null or resting_heart_rate between 20 and 250),
  hrv_rmssd_milli numeric check (hrv_rmssd_milli is null or hrv_rmssd_milli between 0 and 1000),
  spo2_percentage numeric check (spo2_percentage is null or spo2_percentage between 0 and 100),
  skin_temp_celsius numeric check (skin_temp_celsius is null or skin_temp_celsius between 10 and 50),
  user_calibrating boolean not null default false,
  recovery_state text,
  strain numeric check (strain is null or strain between 0 and 21),
  kilojoule numeric check (kilojoule is null or kilojoule >= 0),
  average_heart_rate integer check (average_heart_rate is null or average_heart_rate between 20 and 250),
  max_heart_rate integer check (max_heart_rate is null or max_heart_rate between 20 and 250),
  strain_state text,
  sleep_performance_percentage numeric check (sleep_performance_percentage is null or sleep_performance_percentage between 0 and 100),
  sleep_efficiency_percentage numeric check (sleep_efficiency_percentage is null or sleep_efficiency_percentage between 0 and 100),
  sleep_consistency_percentage numeric check (sleep_consistency_percentage is null or sleep_consistency_percentage between 0 and 100),
  respiratory_rate numeric check (respiratory_rate is null or respiratory_rate between 0 and 60),
  asleep_milli bigint check (asleep_milli is null or asleep_milli >= 0),
  in_bed_milli bigint check (in_bed_milli is null or in_bed_milli >= 0),
  sleep_start timestamptz,
  sleep_end timestamptz,
  sleep_state text,
  sleep_is_nap boolean not null default false,
  synced_at timestamptz not null default now(),
  primary key (user_id, cycle_id)
);

create index whoop_metrics_user_day_idx on public.whoop_metrics (user_id, day desc);

comment on table public.whoop_credentials is 'Encrypted WHOOP OAuth tokens for the owning athlete. Ciphertext is not a usable token without the server secret.';
comment on table public.whoop_metrics is 'Recovery, strain, and sleep copied from WHOOP. Unscored values stay null.';

create trigger whoop_credentials_updated
  before update on public.whoop_credentials
  for each row execute function private.set_updated_at();

create trigger whoop_metrics_lock_user
  before update on public.whoop_metrics
  for each row execute function private.lock_user_id();

alter table public.whoop_credentials enable row level security;
alter table public.whoop_credentials force row level security;
alter table public.whoop_metrics enable row level security;
alter table public.whoop_metrics force row level security;

revoke all on table public.whoop_credentials from anon, public;
revoke all on table public.whoop_metrics from anon, public;
grant select, insert, update, delete on table public.whoop_credentials to authenticated, service_role;
grant select, insert, update, delete on table public.whoop_metrics to authenticated, service_role;

create policy whoop_credentials_select on public.whoop_credentials
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy whoop_credentials_insert on public.whoop_credentials
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy whoop_credentials_update on public.whoop_credentials
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy whoop_credentials_delete on public.whoop_credentials
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy whoop_metrics_select on public.whoop_metrics
  for select to authenticated
  using ((select private.can_read_athlete(user_id)));

create policy whoop_metrics_insert on public.whoop_metrics
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy whoop_metrics_update on public.whoop_metrics
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy whoop_metrics_delete on public.whoop_metrics
  for delete to authenticated
  using (user_id = (select auth.uid()));
