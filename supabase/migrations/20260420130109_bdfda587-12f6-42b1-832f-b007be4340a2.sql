
-- Analyses table
create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_filename text not null,
  resume_text text not null,
  job_description text not null,
  match_score integer not null,
  skills_detected jsonb not null default '[]'::jsonb,
  missing_keywords jsonb not null default '[]'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  summary text,
  created_at timestamptz not null default now()
);

alter table public.analyses enable row level security;

create policy "Users view own analyses"
on public.analyses for select
to authenticated
using (auth.uid() = user_id);

create policy "Users insert own analyses"
on public.analyses for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users delete own analyses"
on public.analyses for delete
to authenticated
using (auth.uid() = user_id);

create index analyses_user_created_idx on public.analyses(user_id, created_at desc);
