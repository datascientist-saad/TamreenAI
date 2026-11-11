# Tamreen AI — MVP Implementation Plan

## Principles

1. Extend the existing Next.js + Supabase app; do not rebuild.
2. Deterministic services own calories, load, scheduling constraints, validation.
3. AI proposes structured JSON; backend validates before persist; athletes confirm material changes.
4. No wearable expansion (Garmin/Apple Health). Preserve WHOOP/Strava.
5. No fabricated health/food/workout numbers.

## Phase map

| Phase | Deliverable | Status target |
| --- | --- | --- |
| 0 | Audit + this plan | Done in docs |
| 1 | Athlete prefs, sport priorities, onboarding preview/confirm | Implement |
| 2 | Hybrid AI boundary (calories + structured schemas) | Implement |
| 3 | Fitness assessment tables + Level 1/2 capture | Implement |
| 4–5 | Workout segments, brick parents, progression hooks | Implement / harden |
| 6 | Health dashboard + measurements + readiness bridge | Implement |
| 7 | Nutrition targets, logging methods, flexible/structured modes | Implement |
| 8 | Event prep + T100 templates | Implement |
| 9 | Preserve live training; link completion to history | Verify / light glue |
| 10 | AI coach context includes health/nutrition/events | Extend |
| 11 | Weekly review + approve next week | Implement |
| 12 | Nav + Lucide consistency | Implement |
| 13–14 | Migrations, RLS, storage, consent | Implement |
| 15–16 | Tests, env docs, final report | Implement |

## Data model (logical → physical)

Reuse existing names where present:

- Athlete: `profiles`, `athlete_profiles`, `athlete_sports`, `athlete_goals`, **new** `athlete_preferences`
- Fitness: **new** `fitness_assessments`, `benchmark_results`, `training_zones`
- Training: existing plans/blocks/workouts/exercises/sets/completed_*; **new** `workout_segments`, `plan_revisions`
- Feedback: `recovery_logs`, `readiness_scores`, `ai_recommendations`, `training_conflicts`
- Health: **new** `health_metric_definitions`, `health_measurements`
- Nutrition: **new** targets/catalog/entries/recipes/plans/hydration
- Events: existing + **new** `event_preparation`
- AI: existing recommendations + **new** `ai_generation_logs`, `decision_explanations`

## Example athlete (dev fixture)

- Age 25, 75 kg, 166 cm, primary goal endurance, sports strength/run/swim/bike/triathlon
- Diet: Halal; nutrition: flexible; scheduling: adaptive; assessment: hybrid
- Do not invent FTP/VO₂/availability without inputs

## Testing strategy

- Unit: BMR/TDEE/macros, sport priority balance, event distance templates, assessment confidence
- Existing engine/schedule/plan/live tests remain green
- Manual E2E path documented when credentials allow signup against remote project

## Environment

Document in `.env.example` and `docs/ENV.md`:

- Supabase public URL/anon
- `GROK_API` / `OPENAI_API_KEY` / `OPENAI_MODEL`
- WHOOP/Strava secrets (optional)
- No service role in client

## Rollback

- Migrations are additive (CREATE / ALTER ADD COLUMN)
- Feature flags via prefs defaults so old clients keep working
- Plan activation remains opt-in via draft → confirm
