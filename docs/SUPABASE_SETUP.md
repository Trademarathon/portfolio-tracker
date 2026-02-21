# Supabase setup for Trade Marathon

Step-by-step setup so sign-in (Email, Google, Apple) and cloud sync for presets, settings, and alerts work.

---

## 1. Project and URL / keys

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) and create or open your project.
2. **Settings → API**: copy **Project URL** and **anon public** key.
3. In the app: **Settings → General → Cloud sync** → choose **Supabase**, paste URL and anon key, click **Save backend**. (Or leave default if the app builder’s project is set.)

---

## 2. Auth providers

**Authentication → Providers** in the Supabase dashboard.

### 2.1 Email (Password)

- **Email** provider: turn **Enable Email provider** ON.
- Optional: under **Email**, turn **Confirm email** OFF if you don’t want verification emails for sign-up.

### 2.2 Google

1. In Supabase: **Authentication → Providers → Google** → turn **Enable Sign in with Google** ON.
2. **Google Cloud Console** ([console.cloud.google.com](https://console.cloud.google.com)):
   - **APIs & Services → Credentials** → **Create credentials → OAuth 2.0 Client ID**.
   - Application type: **Web application**.
   - **Authorized redirect URIs** → add exactly:
     - `https://aulntsfgpecyekjyzwmi.supabase.co/auth/v1/callback`
     - (Replace with your project URL if different: `https://<project-ref>.supabase.co/auth/v1/callback`.)
   - Create and copy **Client ID** and **Client secret**.
3. Back in Supabase → **Google** provider: paste **Client ID** and **Client secret**, Save.

### 2.3 Apple

1. In Supabase: **Authentication → Providers → Apple** → turn **Enable Sign in with Apple** ON.
2. **Apple Developer Center** ([developer.apple.com](https://developer.apple.com)):
   - Create a **Sign in with Apple** **Services ID** (for web).
   - Under that Services ID, set **Return URL** to:
     - `https://aulntsfgpecyekjyzwmi.supabase.co/auth/v1/callback`
   - Create a **Key** with “Sign in with Apple” enabled; note **Key ID**, **Team ID**, **Client ID** (Services ID), and the **.p8** private key file.
   - Generate a **client secret** (JWT) using that key (Supabase “Learn more” links describe the format, or use a generator).
3. In Supabase → **Apple** provider: paste **Client IDs** (your Services ID), **Secret Key (for OAuth)** (the JWT client secret). Save.
4. **Note:** Apple OAuth secret keys expire every 6 months; regenerate and update in Supabase before expiry.

**Single callback URL for both Google and Apple:**

- `https://aulntsfgpecyekjyzwmi.supabase.co/auth/v1/callback`
- Use your actual project reference if different (`<project-ref>` from your Project URL).

---

## 3. Database: `user_data` table and RLS

Cloud sync stores presets, settings, and alerts in a single table `user_data` (key-value per user). Row Level Security (RLS) ensures users only access their own rows.

1. In Supabase: **SQL Editor** → New query.
2. Paste and run the contents of [docs/supabase-schema.sql](supabase-schema.sql) in this repo (or the SQL below).

```sql
-- user_data table and RLS
create table if not exists public.user_data (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  payload jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique(user_id, key)
);

create index if not exists user_data_user_id_key on public.user_data(user_id, key);

alter table public.user_data enable row level security;

drop policy if exists "Users can read own data" on public.user_data;
drop policy if exists "Users can insert own data" on public.user_data;
drop policy if exists "Users can update own data" on public.user_data;
drop policy if exists "Users can delete own data" on public.user_data;

create policy "Users can read own data"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "Users can insert own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update own data"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own data"
  on public.user_data for delete
  using (auth.uid() = user_id);
```

3. **Database → Tables** → confirm `public.user_data` exists and RLS is enabled.

---

## 4. Realtime (optional but recommended)

So that presets, settings, and alerts sync in real time across tabs/devices:

1. **Database → Replication** in Supabase.
2. Ensure **public.user_data** is in the list and **Realtime** is enabled for it (or enable it).

The app subscribes to `user_data` changes when the user is signed in and “Sync data to cloud” is on.

---

## 5. Checklist

| Step | Where | What |
|------|--------|------|
| URL + anon key | App Settings → General → Cloud sync | Supabase URL and anon key (or default). |
| Email auth | Supabase → Authentication → Providers → Email | Enable; confirm email optional. |
| Google | Supabase → Google + Google Cloud Console | Enable; redirect URI = `.../auth/v1/callback`; Client ID + Secret in Supabase. |
| Apple | Supabase → Apple + Apple Developer | Enable; Return URL = `.../auth/v1/callback`; Service ID + client secret in Supabase. |
| `user_data` + RLS | Supabase → SQL Editor | Run [supabase-schema.sql](supabase-schema.sql). |
| Realtime | Supabase → Database → Replication | Enable for `public.user_data`. |

After this, sign-in (email/password, Google, Apple) and cloud sync for presets, settings, and alerts work. Journal and playbook data are not synced to the cloud; they stay local.
