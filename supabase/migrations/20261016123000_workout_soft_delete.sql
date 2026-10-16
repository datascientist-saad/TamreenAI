-- Replacing a plan sets deleted_at. The old policy required the updated
-- row to stay visible, so the soft delete was rejected and a second plan
-- inserted a duplicate session.

drop policy if exists workouts_rw on public.workouts;

create policy workouts_select on public.workouts
  for select to authenticated
  using (deleted_at is null and private.can_read_athlete(user_id));

create policy workouts_insert on public.workouts
  for insert to authenticated
  with check (user_id = (select auth.uid()) or private.is_coach_of(user_id));

create policy workouts_update on public.workouts
  for update to authenticated
  using (private.can_read_athlete(user_id))
  with check (user_id = (select auth.uid()) or private.is_coach_of(user_id));

create policy workouts_delete on public.workouts
  for delete to authenticated
  using (user_id = (select auth.uid()) or private.is_coach_of(user_id));
