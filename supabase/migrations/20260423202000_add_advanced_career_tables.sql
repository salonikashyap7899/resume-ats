create table public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  title text not null default 'ATS Resume',
  content text not null,
  created_at timestamptz not null default now()
);

create table public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  company text,
  role text,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.interview_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  question text not null,
  answer text not null,
  scores jsonb not null default '{}'::jsonb,
  feedback text not null,
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  resume_version_id uuid references public.resume_versions(id) on delete set null,
  company text not null,
  role text not null,
  status text not null default 'saved',
  outcome text,
  notes text,
  applied_at date,
  created_at timestamptz not null default now()
);

alter table public.resume_versions enable row level security;
alter table public.cover_letters enable row level security;
alter table public.interview_attempts enable row level security;
alter table public.applications enable row level security;

create policy "Users view own resume versions"
on public.resume_versions for select to authenticated
using (auth.uid() = user_id);
create policy "Users insert own resume versions"
on public.resume_versions for insert to authenticated
with check (auth.uid() = user_id);
create policy "Users delete own resume versions"
on public.resume_versions for delete to authenticated
using (auth.uid() = user_id);

create policy "Users view own cover letters"
on public.cover_letters for select to authenticated
using (auth.uid() = user_id);
create policy "Users insert own cover letters"
on public.cover_letters for insert to authenticated
with check (auth.uid() = user_id);
create policy "Users delete own cover letters"
on public.cover_letters for delete to authenticated
using (auth.uid() = user_id);

create policy "Users view own interview attempts"
on public.interview_attempts for select to authenticated
using (auth.uid() = user_id);
create policy "Users insert own interview attempts"
on public.interview_attempts for insert to authenticated
with check (auth.uid() = user_id);
create policy "Users delete own interview attempts"
on public.interview_attempts for delete to authenticated
using (auth.uid() = user_id);

create policy "Users view own applications"
on public.applications for select to authenticated
using (auth.uid() = user_id);
create policy "Users insert own applications"
on public.applications for insert to authenticated
with check (auth.uid() = user_id);
create policy "Users update own applications"
on public.applications for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
create policy "Users delete own applications"
on public.applications for delete to authenticated
using (auth.uid() = user_id);

create index resume_versions_user_created_idx on public.resume_versions(user_id, created_at desc);
create index cover_letters_user_created_idx on public.cover_letters(user_id, created_at desc);
create index interview_attempts_user_created_idx on public.interview_attempts(user_id, created_at desc);
create index applications_user_created_idx on public.applications(user_id, created_at desc);
