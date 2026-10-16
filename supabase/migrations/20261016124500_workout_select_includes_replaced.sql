-- A select policy that hides deleted_at rows also rejects the update that
-- sets deleted_at. Athletes still only read live rows through the app filters.
drop policy if exists workouts_select on public.workouts;

create policy workouts_select on public.workouts
  for select to authenticated
  using (private.can_read_athlete(user_id));
