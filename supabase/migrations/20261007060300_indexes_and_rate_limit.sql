-- Direct table access to rate-limit rows stays closed. consume_rate_limit is security definer.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rate_limit_events' and policyname = 'rate_limit_no_direct_access'
  ) then
    create policy rate_limit_no_direct_access on public.rate_limit_events
      for all to anon, authenticated
      using (false)
      with check (false);
  end if;
end $$;

create index if not exists ai_recommendations_user_idx on public.ai_recommendations (user_id, created_at desc);
create index if not exists athlete_goals_goal_idx on public.athlete_goals (goal_id);
create index if not exists athlete_sports_sport_idx on public.athlete_sports (sport_id);
create index if not exists coach_feedback_athlete_idx on public.coach_feedback (athlete_id, created_at desc);
create index if not exists coach_feedback_coach_idx on public.coach_feedback (coach_id);
create index if not exists coach_feedback_live_idx on public.coach_feedback (live_session_id);
create index if not exists coach_feedback_workout_idx on public.coach_feedback (workout_id);
create index if not exists completed_sets_exercise_idx on public.completed_sets (exercise_id);
create index if not exists completed_workouts_workout_idx on public.completed_workouts (workout_id);
create index if not exists event_checkpoints_event_idx on public.event_checkpoints (event_id, sort_order);
create index if not exists event_organizations_owner_idx on public.event_organizations (owner_id);
create index if not exists event_registrations_user_idx on public.event_registrations (user_id);
create index if not exists events_organization_idx on public.events (organization_id);
create index if not exists exercise_sets_parent_idx on public.exercise_sets (workout_exercise_id);
create index if not exists form_analysis_session_idx on public.form_analysis (session_id);
create index if not exists gym_cameras_gym_idx on public.gym_cameras (gym_id);
create index if not exists gym_equipment_gym_idx on public.gym_equipment (gym_id);
create index if not exists gym_members_user_idx on public.gym_members (user_id);
create index if not exists gym_sessions_camera_idx on public.gym_sessions (camera_id);
create index if not exists gym_sessions_gym_idx on public.gym_sessions (gym_id);
create index if not exists gym_sessions_user_idx on public.gym_sessions (user_id);
create index if not exists gyms_owner_idx on public.gyms (owner_id);
create index if not exists injuries_user_idx on public.injuries (user_id);
create index if not exists pose_analysis_session_idx on public.pose_analysis (session_id);
create index if not exists product_feedback_user_idx on public.product_feedback (user_id);
create index if not exists strength_sessions_user_idx on public.strength_sessions (user_id);
create index if not exists training_blocks_plan_idx on public.training_blocks (plan_id);
create index if not exists training_blocks_user_idx on public.training_blocks (user_id);
create index if not exists training_conflicts_user_idx on public.training_conflicts (user_id, status);
create index if not exists training_conflicts_a_idx on public.training_conflicts (workout_a_id);
create index if not exists training_conflicts_b_idx on public.training_conflicts (workout_b_id);
create index if not exists user_roles_granted_by_idx on public.user_roles (granted_by);
create index if not exists workout_exercises_exercise_idx on public.workout_exercises (exercise_id);
create index if not exists workouts_block_idx on public.workouts (block_id);
create index if not exists workouts_plan_idx on public.workouts (plan_id);
