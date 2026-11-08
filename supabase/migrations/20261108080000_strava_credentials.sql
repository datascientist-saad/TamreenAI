-- Strava OAuth tokens and athlete info.
-- Tokens are encrypted before storage. Decryption requires the server secret.

create table public.strava_credentials (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  token_expires_at bigint not null,
  scopes text not null default '',
  athlete_id text,
  athlete_name text,
  updated_at timestamptz not null default now()
);

comment on table public.strava_credentials is 'Encrypted Strava OAuth tokens for the owning athlete.';

create trigger strava_credentials_updated
  before update on public.strava_credentials
  for each row execute function private.set_updated_at();

alter table public.strava_credentials enable row level security;
alter table public.strava_credentials force row level security;

revoke all on table public.strava_credentials from anon, public;
grant select, insert, update, delete on table public.strava_credentials to authenticated, service_role;

create policy strava_credentials_select on public.strava_credentials
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy strava_credentials_insert on public.strava_credentials
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy strava_credentials_update on public.strava_credentials
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy strava_credentials_delete on public.strava_credentials
  for delete to authenticated
  using (user_id = (select auth.uid()));
