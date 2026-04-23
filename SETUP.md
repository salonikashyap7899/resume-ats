# ResumeATS — Setup Guide

A resume ATS analyzer built with TanStack Start, Supabase (Lovable Cloud), and Lovable AI Gateway (Gemini).

## Prerequisites
- Node.js 20+ and Bun (`npm i -g bun`) or npm
- A Supabase project (or Lovable Cloud)
- Lovable AI Gateway API key (for the edge function)

## 1. Install
```bash
bun install
# or: npm install
```

## 2. Environment variables
Create `.env` in the project root:
```
VITE_SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="YOUR_ANON_KEY"
VITE_SUPABASE_PROJECT_ID="YOUR_PROJECT_REF"
SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
SUPABASE_PUBLISHABLE_KEY="YOUR_ANON_KEY"
```

## 3. Database
Run this SQL in the Supabase SQL editor:
```sql
create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_filename text not null,
  resume_text text not null,
  job_description text not null,
  match_score int not null,
  skills_detected jsonb not null default '[]',
  missing_keywords jsonb not null default '[]',
  suggestions jsonb not null default '[]',
  summary text,
  created_at timestamptz not null default now()
);

alter table public.analyses enable row level security;

create policy "users read own analyses" on public.analyses
  for select using (auth.uid() = user_id);
create policy "users insert own analyses" on public.analyses
  for insert with check (auth.uid() = user_id);
create policy "users delete own analyses" on public.analyses
  for delete using (auth.uid() = user_id);
```

## 4. Edge function
Deploy `supabase/functions/analyze-resume`:
```bash
supabase functions deploy analyze-resume --no-verify-jwt
supabase secrets set LOVABLE_API_KEY=your_lovable_ai_key
```

## 5. Auth settings
In Supabase Dashboard → Authentication:
- Enable Email provider
- (Optional) Disable "Confirm email" for instant signup during development

## 6. Run
```bash
bun run dev
# open http://localhost:8080
```

## 7. Build
```bash
bun run build
bun run start
```

## Routes
- `/` — landing
- `/auth` — sign in / sign up
- `/forgot-password` — request reset link
- `/reset-password` — set new password
- `/analyze` — upload PDF + JD, get ATS score
- `/dashboard` — past analyses

## Tech stack
- TanStack Start v1 + React 19 + Vite 7
- Tailwind v4 + shadcn/ui
- Supabase (Auth, Postgres, Edge Functions)
- Lovable AI Gateway (google/gemini-3-flash-preview)
- unpdf for PDF text extraction
