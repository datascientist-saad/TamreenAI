# Tamreen AI

Tamreen is an adaptive training system for hybrid athletes. Strength, running, cycling, and swimming share one plan, one fatigue model, and one performance score.

## Stack

- Next.js 16, React 19, TypeScript, Tailwind CSS
- Supabase Auth, Postgres, Storage, and Realtime
- Recharts

The browser only receives the public Supabase URL and anon key. The service role is not used by this app.

## Setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

`OPENAI_API_KEY` stays on the server. Leave it blank to keep generating plans with Tamreen's training rules. `OPENAI_MODEL` is optional.

3. Apply the SQL in `supabase/migrations` in filename order. In the Supabase SQL editor, run `20261007060100_initial_schema.sql`, then `20261007060200_platform_rls.sql`, then `20261007060300_indexes_and_rate_limit.sql`, then the later migrations, including `20261017183000_whoop_metrics.sql`.
4. Optional investor data: run `supabase/seed.sql` in the SQL editor. It creates labeled demo accounts. The password for every demo account is `TamreenDemo!2026`.

| Email | Role |
| --- | --- |
| saad@tamreen.ai | Athlete, Ironman 70.3 plus strength |
| coach@tamreen.ai | Coach linked to Saad |
| gym@tamreen.ai | Gym admin |
| events@tamreen.ai | Event admin |
| admin@tamreen.ai | Super admin |

5. In Supabase Auth, enable Email and Google. Add `http://localhost:3000/auth/callback` to the redirect allow list so Google sign-in can complete.
6. Install and run:

```
npm install
npm test
npm run dev
```

Open `http://localhost:3000`.

## What is real

- Accounts, onboarding, plans, logs, recovery, conflicts, and scores are stored in Postgres.
- Row Level Security uses `user_roles` and relationship tables. JWT user metadata is not an authorization source.
- Onboarding stores sports, goals, days, equipment, benchmarks, injuries, and the event on the athlete profile. Rebuilding a plan stores that same selection snapshot on the training plan.
- When `OPENAI_API_KEY` is set, the server asks the configured model for a weekly pattern that uses every saved day and sport. That pattern is what the plan page shows. Tamreen still places sessions only on the selected days, drops sports the athlete cannot do, and removes avoided exercises. A reply that is only a single tempo run, or that misses a saved day or sport, is asked for once more. A red-flag injury stays on the recovery rules and is not sent to the model. If the key is missing or the reply still cannot be used, the deterministic training rules write the plan instead.
- Other training decisions stay deterministic and store the factors that produced them. A major change waits for Accept or Keep original.
- The live camera uses the device camera. Reps are manual. Form scores are not invented. A squat screen can save a clearly labeled placeholder example.
- WHOOP recovery, strain, and sleep are copied after the athlete authorizes the app. Other wearable providers are disconnected adapters. They do not fabricate a sync.
- Gym cameras cannot enable facial recognition. Identification is QR, session assignment, an authenticated device, or a manual pick.

## WHOOP

Create an app in the [WHOOP developer dashboard](https://developer.whoop.com/) and set:

```
WHOOP_CLIENT_ID=
WHOOP_CLIENT_SECRET=
WHOOP_TOKEN_SECRET=
```

`WHOOP_TOKEN_SECRET` is at least 16 characters and stays on the server. Tamreen encrypts the access and refresh tokens with it. Register the redirect URL `{origin}/api/whoop/callback`, or set `WHOOP_REDIRECT_URI` to the exact URL you registered. The connect button on More sends the athlete to WHOOP. After authorization, Tamreen stores recovery, strain, and sleep for the last 30 days and shows them on Home, Recovery, and Analytics.

## Scripts

- `npm run dev` starts the app
- `npm test` runs the training-engine tests
- `npm run lint` runs ESLint
- `npm run build` creates a production build

## Mobile

The app is a PWA: `src/app/manifest.ts` and `public/sw.js`. Safe areas and a bottom tab bar are in the shell. A later Capacitor wrapper can load the same web build. `isNativeShell()` in `src/lib/platform.ts` detects that wrapper when it exists.

## Safety

Chest pain, fainting, severe pain, or breathlessness at rest stops training guidance and points to professional care. Computer vision does not diagnose injuries.
