create table public.rewrite_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  original_resume_text text not null,
  rewritten_summary text not null,
  rewritten_experience_bullets jsonb not null default '[]'::jsonb,
  rewritten_project_bullets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.rewrite_revisions enable row level security;

create policy "Users view own rewrite revisions"
on public.rewrite_revisions for select
to authenticated
using (auth.uid() = user_id);

create policy "Users insert own rewrite revisions"
on public.rewrite_revisions for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users delete own rewrite revisions"
on public.rewrite_revisions for delete
to authenticated
using (auth.uid() = user_id);

create index rewrite_revisions_user_created_idx
on public.rewrite_revisions(user_id, created_at desc);
