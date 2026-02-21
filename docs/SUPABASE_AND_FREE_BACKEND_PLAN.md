# Supabase & Free Backend Plan

A clean plan for using **Supabase (free tier)** across the portfolio tracker, plus other free backend options.

---

## 1. Current Backend Landscape

| Area | Today | Notes |
|------|--------|------|
| **App data** | `localStorage` | Journal (trades, annotations), playbooks, sessions, alerts, settings, Indian markets, terminal/screener presets, connections (also Tauri AppData). |
| **API server** | Express (`api-server/`) | CEX (Binance/Bybit keys, orders, balance, listen-key), wallet portfolio/history, **journal sync** (CCXT/HL fetch), screener markets, alerts send/test, Indian MF/stocks, CAS import, calendar, transcribe. |
| **Database** | Prisma + SQLite | Used only by `api-server` journal GET/POST (`Trade`, `PortfolioSnapshot`). Main app reads/writes journal via **JournalContext → localStorage**; sync uses `/api/journal/sync`. |

So: **primary store = localStorage**; api-server = proxy + sync + optional Prisma journal.

---

## 2. Where to Use Supabase (Free Tier)

Supabase free tier: 500MB DB, 1GB file storage, 50K MAU auth, 2GB bandwidth, Realtime.

### 2.1 Database (Postgres) – High value

**Use for:** Cloud persistence and optional cross-device sync.

| Data (from `STORAGE_KEYS` / app) | Supabase table / usage |
|----------------------------------|-------------------------|
| Journal trades | `journal_trades` – sync from localStorage or replace it for “signed-in” users. |
| Journal annotations / preferences / filters | `journal_annotations`, `journal_preferences`, `journal_permanent_filters` |
| Playbooks & plans | `trading_playbooks`, `spot_plans`, `perp_plans`, `trading_sessions`, `playbook_*` |
| Alerts (portfolio, feed, movement) | `portfolio_alerts`, `alerts_feed_settings`, `movement_alerts_settings` (metadata only; execution can stay in api-server). |
| Screener/Terminal presets | `watchlist_filters`, `watchlist_columns`, `terminal_widgets`, `global_tv_settings` (optional). |
| Indian markets transactions | `indian_mf_transactions`, `indian_stock_transactions` (optional). |

**Implementation idea:**

- Add a **“Sync to cloud”** mode: when enabled, app writes to Supabase (and optionally reads from Supabase) for the above keys. Keep localStorage as cache or primary when offline / not signed in.
- Optional: migrate api-server journal GET/POST from Prisma/SQLite to Supabase (single Postgres in the cloud).

### 2.2 Auth – Medium value (if you want “account”)

**Use for:** One account per user, so cloud data is scoped and synced across devices.

- **Supabase Auth**: Email/password, or OAuth (Google, Apple). Free tier is enough for personal/small use.
- **Purpose of sign-in:** Required to use the app. When signed in, presets, settings, and alerts can sync to the cloud. Sign-in is **not** for journal or playbook data backup — journal and playbook data stay local.
- Flow: Sign in → `user.id` → Supabase tables use `user_id` for synced data (presets, settings, alerts). App shows “Sync to cloud” when signed in.
- **OAuth callback URL** (register this in each provider’s console):
  - **`https://aulntsfgpecyekjyzwmi.supabase.co/auth/v1/callback`**
  - **Google:** In Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client → add the above as an **Authorized redirect URI**.
  - **Apple:** In Apple Developer Center, add the above as the **Return URL** for your Sign in with Apple (web) Service ID.

**Step-by-step Supabase setup:** See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for enabling Email/Google/Apple auth, creating the `user_data` table with RLS, and enabling Realtime.

### 2.3 Realtime – Nice to have

**Use for:** Live updates without polling.

- Alerts / signals: e.g. “alert triggered” pushed to client via Supabase Realtime (subscribe to `portfolio_alerts` or a dedicated `alert_events` table).
- Optional: live portfolio or screener state (if you start storing that in Supabase).

**Current alerts/sync implementation:** Alerts and signals use the `user_data` table and Realtime. The app guards against overwriting local state with an empty or stale cloud payload, uses a per-alert cooldown so the same alert does not re-fire on navigation, and keeps notification settings and AI feed state stable across routes. When sync is on, cloud is the source of truth for synced keys. Full behavior is documented in [Alerts and notifications](ALERTS_AND_NOTIFICATIONS.md).

### 2.4 Storage – Split with Firebase (free tier)

**Use for:** Files instead of base64 in DB or local only.

- **Backup files (export/import):** Stored in **Firebase Storage** (5 GiB free) via api-server. Client sends Supabase JWT; api-server verifies and uploads/list/downloads from Firebase. Keeps Supabase Storage (1 GB) for other use. See [Supabase + Firebase free tier split](#8-supabase--firebase-free-tier-split) below.
- CAS PDF uploads → optional: upload to Storage and pass URL to api-server for parsing (or keep current flow).

### 2.5 Edge Functions – Optional

**Use for:** Serverless endpoints that don’t need CEX keys.

- E.g. webhook for “alert fired” → call Supabase Edge Function to log or forward; or lightweight proxy for public APIs (screener, calendar).  
- **Keep in api-server:** anything that touches CEX API keys (Binance, Bybit), wallet fetches, or journal-sync (CCXT). Keys stay on your server, not in Supabase secrets.

---

## 3. What to Keep vs Move

| Keep in api-server (or current place) | Good candidate for Supabase |
|---------------------------------------|------------------------------|
| CEX routes (balance, orders, trades, listen-key) – they need API keys. | All app “database” data: journal, playbooks, alerts metadata, presets. |
| Journal-sync (CCXT / Hyperliquid fetch). | Optional: journal GET/POST (replace Prisma for cloud journal). |
| Wallet portfolio/history (sensitive). | Auth, Realtime, backup Storage. |
| Indian markets proxy (API keys). | |
| Alerts *sending* (e.g. Telegram) – can stay server-side. | Alert *storage* and *realtime* delivery. |
| CAS parse (PDF/JSON) – can stay server-side. | |
| Transcribe, calendar (keys or heavy work). | |

---

## 4. Suggested Rollout (Clean Order)

1. **Setup**  
   - Create Supabase project (free tier).  
   - Add tables that mirror your main localStorage “namespaces” (e.g. `journal_trades`, `journal_annotations`, `trading_playbooks`, `portfolio_alerts`, etc.) with `user_id` if you use Auth.

2. **Auth (optional but recommended for sync)**  
   - Integrate Supabase Auth (e.g. magic link).  
   - Add a small “Account” or “Cloud sync” section in settings: Sign in / Sign out; “Sync data to cloud” toggle.

3. **Database layer**  
   - Add a thin client layer (e.g. `src/lib/supabase.ts` + `src/lib/supabase-journal.ts`, `supabase-alerts.ts`, etc.) that:  
     - Reads/writes to Supabase when user is signed in and “Sync to cloud” is on.  
     - Falls back to localStorage when offline or not using cloud.  
   - Optionally: sync on load (Supabase → localStorage) and on change (localStorage → Supabase) with simple conflict rule (e.g. “last write wins” or “server wins”).

4. **Journal first**  
   - Make JournalContext use this layer: when cloud sync is on, persist to Supabase (and load from Supabase on init).  
   - Then playbooks, then alerts metadata, then presets/Indian markets if needed.

5. **Realtime**  
   - Subscribe to alert-related (or signal) tables in Supabase for live notifications.

6. **Storage**  
   - Use for export/import backups and optionally CAS uploads.

7. **Prisma**  
   - Once Supabase is the source of truth for journal in the cloud, you can deprecate api-server journal GET/POST that use Prisma, or point them to Supabase (e.g. via Supabase client in api-server) and keep one DB.

---

## 5. Other Free Backend Options

| Service | Best for | Free tier (typical) |
|---------|----------|----------------------|
| **Supabase** | Postgres + Auth + Realtime + Storage + Edge Functions | 500MB DB, 1GB storage, 50K MAU, 2GB egress |
| **Neon** | Serverless Postgres only | 0.5GB storage, branchable DBs |
| **PlanetScale** | MySQL (serverless) | 5GB storage, 1B row reads/mo |
| **Turso** | SQLite at the edge | 9GB storage, 500 DBs |
| **Vercel Postgres** (Neon/Vercel) | Postgres for Vercel apps | Similar to Neon |
| **Firebase** | Auth, Firestore, Realtime DB, Storage, Functions | See [Firebase free tier](#51-firebase-free-tier-spark-plan) below |
| **Railway** | Run your api-server + DB (Postgres/MySQL/Redis) | $5 free credit/mo |
| **Render** | Run api-server + Postgres | Free tier for web + DB (with limits) |
| **Aiven** | Managed Postgres/Redis etc. | Free trial / small free tier |

**Recommendation:** Use **Supabase** as the single free backend for DB + Auth + Realtime + Storage so you have one dashboard and one set of env vars. Use **Firebase** if you prefer NoSQL (Firestore) and Google’s ecosystem. Use **Neon** or **Turso** only if you want “DB only” and will build Auth/Realtime yourself or with another service.

### 5.1 Firebase free tier (Spark plan)

Firebase’s free **Spark** plan includes:

| Product | Free tier (Spark) |
|--------|--------------------|
| **Authentication** | Unlimited (email/password, Google, etc.); no charge for MAU on Spark |
| **Firestore** | 1 GiB storage, 50K reads / 20K writes / 20K deletes per day |
| **Realtime Database** | 1 GiB storage, 10 GB/month download |
| **Cloud Storage** | 5 GiB total, 1 GB/day download |
| **Cloud Functions** | 2M invocations/month (Blaze pay-as-you-go required for outbound networking; Spark has no Functions) |

**Mapping to this project:** Use **Firebase Auth** for sign-in (email or Google). Use **Firestore** (or Realtime Database) to store journal, alerts, playbooks, and presets as documents keyed by `userId` (e.g. `users/{uid}/journal_trades`). Use **Storage** for export/import backups. Use **Cloud Functions** (requires Blaze) only if you need server-side logic; otherwise keep CEX/sync in your existing api-server.

**When to choose Firebase over Supabase:** If you want NoSQL (document model), tight integration with Google sign-in or other Firebase Auth providers, or you’re already in the Google ecosystem. This app’s current sync is built for Supabase (Postgres + RLS); switching to Firebase would mean a separate sync layer writing to Firestore/Realtime DB instead of `user_data`.

---

## 8. Supabase + Firebase free tier split

To avoid filling a single free tier, backup files use **Firebase Storage** (5 GiB) instead of Supabase Storage (1 GB).

| What | Service | Why |
|------|---------|-----|
| Auth | Supabase | Already implemented; 50K MAU. |
| App data (sync) | Supabase | Postgres `user_data`, 500MB, no per-day write cap. |
| Realtime | Supabase | One channel per user. |
| Backup files | **Firebase Storage** (via api-server) | 5 GiB free; client sends Supabase JWT, api-server bridges to Firebase. |
| CEX / journal sync / alerts send | api-server | Unchanged. |

**Implementation:** api-server has routes `GET /api/backup/list`, `POST /api/backup/upload`, `GET /api/backup/download`. Client (Export & Import settings) calls these with `Authorization: Bearer <supabase_access_token>`. Api-server verifies JWT with Supabase, then uses Firebase Admin SDK to read/write Storage at `{user_id}/backups/{filename}`.

**Env (api-server):** In addition to `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (for JWT verification), set Firebase service account credentials: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. Optional: `FIREBASE_STORAGE_BUCKET` for a custom bucket. No Firebase client keys needed; backup is server-side only.

---

## 6. Env / Config

**Supabase (app + api-server):**

```bash
# .env.local (Next.js) or app env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>

# api-server: JWT verification + alert checker
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

**Firebase (api-server only, for cloud backup):**

```bash
FIREBASE_PROJECT_ID=<project_id>
FIREBASE_CLIENT_EMAIL=<client_email from service account JSON>
FIREBASE_PRIVATE_KEY=<private_key from service account JSON>
# Optional: FIREBASE_STORAGE_BUCKET=<bucket> (default: project-id.appspot.com)
```

Use **Row Level Security (RLS)** on all Supabase tables with `auth.uid() = user_id` so clients only see their own rows. Keep **service_role** only in api-server or Edge Functions if you need admin-style access.

---

## 7. One-Page Summary

| Goal | Use |
|------|-----|
| Cloud DB for journal, playbooks, alerts, presets | **Supabase Database** |
| “My account” and cross-device sync | **Supabase Auth** |
| Live alert/signal updates | **Supabase Realtime** |
| Backup files (export/import) | **Firebase Storage** (via api-server; 5 GiB free) |
| CAS uploads (optional) | Supabase Storage or Firebase |
| Keep CEX keys and sync logic server-side | **Current api-server** (Express) |
| Optional serverless without secrets | **Supabase Edge Functions** |
| Alternative “DB only” | Neon / Turso / PlanetScale |
| Alternative “Auth + NoSQL + Realtime” | **Firebase** (Spark free tier: Firestore, Auth, Storage, Realtime DB) |

No changes to the plan file you asked not to edit; this lives in `docs/SUPABASE_AND_FREE_BACKEND_PLAN.md` and can be updated as you implement.
