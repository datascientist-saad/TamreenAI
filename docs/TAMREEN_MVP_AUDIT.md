# Tamreen AI — MVP Implementation Audit

**Date:** 2026-11-11  
**Repository:** TamreenAI (Next.js 16 / React 19 / Supabase)  
**Live app:** https://tamreenai-hybrid.vercel.app/  
**Supabase project:** TamreenAI-Hybrid (`dvuigirnwrkpipqmmvke`, ap-southeast-2)

---

## 1. Stack and architecture

| Layer | Current state |
| --- | --- |
| Framework | Next.js 16 App Router, React 19, TypeScript, Tailwind 4 |
| Auth / DB | Supabase Auth + Postgres + Storage + Realtime via `@supabase/ssr` |
| AI | Groq (`GROK_API`) preferred, OpenAI fallback; deterministic engine fallback when unset |
| Charts | Recharts |
| Live camera | MediaPipe Tasks Vision (`@mediapipe/tasks-vision`) |
| Icons | Lucide React |
| Brand | Maroon `#8a1538`, paper/card/ink tokens in `globals.css`, Outfit + JetBrains fonts |
| Mobile | PWA (`manifest.ts`, `public/sw.js`), bottom tab shell |

**Client secrets:** only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Service role is not used by the app. AI and wearable secrets stay server-side.

---

## 2. Existing functionality (preserve)

### Identity and roles
- Email/Google auth, profiles, `user_roles` (athlete, coach, gym_admin, event_admin, super_admin)
- RLS helpers in `private` schema (`has_role`, `can_read_athlete`, `is_coach_of`) — **not** JWT user metadata
- Coach desk, gym desk, event admin, super-admin overview

### Onboarding and athlete profile
- Multi-step wizard: name/DOB/sex/height/weight, sports, goals, injuries, availability/equipment, optional benchmarks, optional event
- Persists to `profiles`, `athlete_profiles`, `athlete_sports`, `athlete_goals`, `injuries`, `events`
- Completing onboarding generates a training plan via AI or deterministic rules

### Training engine (strong foundation)
- Hybrid multi-sport plan generation (`services/training/engine.ts`)
- Phases: base / build / peak / taper / recovery
- Importance: key / supporting / optional
- Conflict detection, missed-session adaptation, weekly optimize proposals with accept/reject
- Strength, run, bike, swim, brick, court/field sports
- Plan rebuild with selection snapshot on `training_plans.inputs`
- Workout execution logging (strength sets, run/ride/swim sessions)
- Calendar, plan editor, status choices

### Recovery
- Manual readiness check-in → `recovery_logs` + `readiness_scores`
- Severe-symptom safety stop
- WHOOP optional sync (preserve; do **not** expand wearable scope for this MVP)

### Live training
- Camera session UI, pose estimation pipeline, catalog of supported exercises
- Manual reps; form scores only when model/placeholder rules allow
- Saves to `live_training_sessions` / `pose_analysis` / `form_analysis`

### Events and triathlon
- Personal events + org-managed events, registrations, results
- Triathlon dashboard aggregating swim/bike/run/strength volume and scored dimensions
- Goals include sprint / Olympic / 70.3 / Ironman

### AI coach
- `askCoach` stores Q&A in `ai_recommendations`
- Plan changes proposed as pending recommendations requiring athlete accept/reject
- Rules-based answers when AI key missing

### Other
- Analytics, records, notifications, data export API, rate limiting, audit log table
- Strava OAuth code in repo (migration **not** applied on remote yet)
- Seed demo accounts documented in README

---

## 3. Missing functionality (MVP gaps)

| Area | Gap |
| --- | --- |
| Nutrition | No tables, pages, calorie/macro engine, food logging, meal plans, or fueling workflows |
| Health metrics | No dedicated Health section; only recovery check-in + WHOOP. Missing VO₂ max, BP, body measurements history, hydration, steps, metric definitions with method/source |
| Onboarding depth | No dietary prefs/allergies, nutrition mode, adaptive scheduling preference, per-sport experience, sport priority primary/secondary/maintenance, plan **preview + confirm** before activation, skippable advanced measurements labeled as optional |
| Goal catalog | No explicit `endurance` or `t100` goals |
| Fitness assessment levels | Benchmarks exist on profile columns; no leveled assessment records, confidence/source, continuous calibration store, or training zones table |
| Workout structure | No `workout_segments` for brick parents; limited alternative options / revision history tables |
| Plan revisions | Soft archive of plans exists; no explicit `plan_revisions` rollback ledger |
| Event preparation | Events exist; no structured phase timeline, readiness evidence checklist, T100 template (2/80/18), fueling practice tracking |
| Weekly review | No dedicated weekly athlete review + next-week approval flow |
| Food image storage | No storage bucket/policies for meal photos |
| AI decision audit | `ai_recommendations` exists; no versioned generation logs / decision_explanations dedicated tables |

---

## 4. Features requiring improvement (extend, do not replace)

1. **Onboarding** — add prefs + preview confirmation; keep existing wizard structure and save path.
2. **Sport prioritization** — extend `athlete_sports` / goals rather than parallel profile stores.
3. **Recovery → Health** — keep recovery check-in; add Health dashboard that can also write structured `health_measurements`.
4. **AI hybrid boundary** — strengthen schema validation + deterministic calorie/load math outside the model.
5. **Triathlon counting** — engine already treats triathlon as swim+bike+run; document and harden so triathlon is never a fourth endurance load.
6. **Events form** — structured distance templates (including T100) instead of free-text-only type.
7. **Navigation** — add Health, Nutrition, Weekly to shell/More without cluttering the five mobile tabs.
8. **Remote schema drift** — local migrations `stretch_exercises` and `strava_credentials` not applied on remote.

---

## 5. Database changes required

Extend existing schema; avoid duplicate athlete profile tables.

**Alter / extend**
- `athlete_sports`: `priority_class` (`primary` | `secondary` | `maintenance`)
- `athlete_goals`: optional `priority_class`
- `workouts`: optional `parent_workout_id` for brick segments; ensure sport check includes court sports already added
- Goals catalog: `endurance`, `t100`

**New tables**
- `athlete_preferences` — diet, allergies, nutrition_mode, scheduling_mode, cuisine, meal frequency, consent flags
- `fitness_assessments`, `benchmark_results`, `training_zones`
- `health_metric_definitions`, `health_measurements`
- `nutrition_targets`, `food_catalog`, `food_entries`, `meal_recipes`, `meal_plans`, `meal_plan_items`, `hydration_entries`
- `event_preparation`
- `workout_segments`
- `plan_revisions`
- `adaptation_proposals` (optional thin wrapper if not reusing `ai_recommendations` / conflicts)
- `ai_generation_logs`, `decision_explanations`
- Storage bucket `food-images` with owner RLS

**Apply pending local migrations on remote**
- `20261101120000_stretch_exercises`
- `20261108080000_strava_credentials`

---

## 6. Security and compatibility risks

| Risk | Mitigation |
| --- | --- |
| Health/nutrition data sensitivity | Owner + authorized coach RLS via `private.can_read_athlete`; no service role in client |
| AI mutating plans | Keep accept/reject; never write from NL without backend action |
| Inadequate energy availability | Deterministic calorie floors; flag extreme deficits |
| Fabricated food macros from LLM | Structured food catalog / validated estimates; athlete confirmation on photo/NL parse |
| Wearable scope creep | Preserve WHOOP/Strava; do not add Garmin/Apple Health in this MVP |
| Schema drift (Strava) | Apply missing migrations before relying on Strava UI |
| Views / security definer | Follow existing `private.*` pattern; no new exposed security-definer RPCs without need |
| Storage upsert | Food image policies need INSERT+SELECT+UPDATE |

**Environment blocker:** Cloud Agent secret store has no Tamreen app secrets bound yet. Local `.env.local` was absent at audit time. Supabase MCP is authenticated and usable for schema work. AI keys optional (rules fallback).

---

## 7. Design system notes

- Preserve maroon/black/white/gray identity; Lucide thin icons.
- Compact metric cards already used on dashboards — extend pattern for Health/Nutrition.
- Mobile-first: food logging, readiness, calendar adjustments stay phone-friendly.
- Do not restyle brand or introduce purple/cream AI-default themes.

---

## 8. Recommended implementation sequence

1. Audit docs (this file + plan)  
2. Shared schema migration + RLS + apply pending remote migrations  
3. Unified onboarding extensions + plan preview confirmation  
4. Manual Health module  
5. Fitness assessment records + zones  
6. Workout segments / brick parent links + generation hardening  
7. Adaptive scheduling hooks (missed/fatigue) already present — extend with athlete-facing weekly review  
8. Workout execution polish (preserve live camera)  
9. Nutrition calculations + six logging methods (start with manual/search/saved; photo/barcode with graceful fallback)  
10. Flexible + structured meal planning  
11. Event preparation + T100  
12. AI coach context expansion (read health/nutrition)  
13. Weekly athlete review  
14. Live training integration verification  
15. Design consistency + tests + production report  

---

## 9. Dead code / duplication notes

- Wearable provider adapters beyond WHOOP/Strava are stubs — keep, do not fabricate sync.
- Court/field sports are in engine and catalog; MVP sports focus remains strength/run/bike/swim/triathlon but do not delete court sports.
- Recovery page and WHOOP metrics overlap intentionally; Health becomes the broader manual store.

---

## 10. Verdict

Tamreen already has a **production-shaped hybrid training core** (auth, RLS, plan engine, logging, live camera, events, coach). The MVP upgrade is primarily **filling Nutrition + Health + assessment persistence + onboarding confirmation + weekly review + event prep**, while extending—not rewriting—the training/AI stack.
