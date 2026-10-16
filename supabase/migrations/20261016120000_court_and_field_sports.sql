-- Popular court and field sports, plus one planned session per day/sport/title.

alter table public.workouts drop constraint if exists workouts_sport_check;

alter table public.workouts
  add constraint workouts_sport_check
  check (sport in (
    'strength', 'bodybuilding', 'running', 'cycling', 'swimming', 'brick', 'mobility', 'recovery',
    'football', 'padel', 'basketball', 'tennis', 'volleyball', 'pickleball', 'badminton', 'cricket'
  ));

insert into public.sports (slug, name, description) values
  ('football', 'Football', 'Match fitness, repeated sprints, and change of direction.'),
  ('padel', 'Padel', 'Short points, lateral movement, and wall play.'),
  ('basketball', 'Basketball', 'Court sprints, jumps, and live play.'),
  ('tennis', 'Tennis', 'Rallies, serves, and recovery steps.'),
  ('volleyball', 'Volleyball', 'Jumping, landing, and court movement.'),
  ('pickleball', 'Pickleball', 'Quick hands and short-court coverage.'),
  ('badminton', 'Badminton', 'Lunges, overhead work, and match play.'),
  ('cricket', 'Cricket', 'Nets, fielding sprints, and match fitness.')
on conflict (slug) do nothing;

insert into public.goals (slug, name, category, description) values
  ('improve_football', 'Play better football', 'football', 'Stay sharp for matches without burying the legs the next day.'),
  ('improve_padel', 'Play better padel', 'padel', 'Build the repeat efforts and footwork padel points ask for.'),
  ('improve_basketball', 'Play better basketball', 'basketball', 'Support jumping, slides, and live play.'),
  ('improve_tennis', 'Play better tennis', 'tennis', 'Support long rallies and serve patterns.'),
  ('improve_volleyball', 'Play better volleyball', 'volleyball', 'Support jumping and landing through the week.'),
  ('improve_pickleball', 'Play better pickleball', 'pickleball', 'Stay quick on a short court without extra junk volume.'),
  ('improve_badminton', 'Play better badminton', 'badminton', 'Support lunges and repeated overhead work.'),
  ('improve_cricket', 'Play better cricket', 'cricket', 'Support nets and the repeated sprints of fielding.')
on conflict (slug) do nothing;

update public.workouts as duplicate
set deleted_at = now()
where duplicate.id in (
  select id from (
    select id,
      row_number() over (
        partition by user_id, scheduled_date, sport, title
        order by created_at, id
      ) as rn
    from public.workouts
    where deleted_at is null
      and status = 'planned'
  ) ranked
  where rn > 1
);

create unique index if not exists workouts_one_planned_title
  on public.workouts (user_id, scheduled_date, sport, title)
  where deleted_at is null and status = 'planned';
