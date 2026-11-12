# Environment variables

Copy `.env.example` to `.env.local` for local development.

## Required for app boot

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server | Publishable / anon key only |

Never put the Supabase **service role** key in this app or in `NEXT_PUBLIC_*` variables.

## AI (optional)

| Variable | Where | Purpose |
| --- | --- | --- |
| `GROK_API` | Server | Groq API key (preferred). Alias also accepts `GROQ_API_KEY`. |
| `OPENAI_API_KEY` | Server | OpenAI fallback when Groq is unset |
| `OPENAI_MODEL` | Server | Optional model override |

If no AI key is set, plan generation and coaching use Tamreen’s deterministic rules and clearly labeled fallbacks. The app does not fabricate AI replies.

## Wearables (optional — preserve existing; not required for MVP health)

| Variable | Purpose |
| --- | --- |
| `WHOOP_CLIENT_ID` / `WHOOP_CLIENT_SECRET` / `WHOOP_TOKEN_SECRET` | WHOOP OAuth + token encryption |
| `WHOOP_REDIRECT_URI` | Optional redirect override |
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` / `STRAVA_TOKEN_SECRET` | Strava OAuth + token encryption |
| `STRAVA_REDIRECT_URI` | Optional redirect override |

Garmin, Apple Health, and other automatic wearable sync are **out of scope** for this MVP. Manual health entry covers those metrics.

## Migrations

Apply SQL in `supabase/migrations` in filename order (or use linked Supabase CLI / MCP `apply_migration`). This MVP adds `20261111120000_mvp_health_nutrition_prefs.sql` after the Strava credentials migration.
