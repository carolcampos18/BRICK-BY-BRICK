-- Cole isto no Supabase: SQL Editor > New query > Run
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "ler o proprio perfil" on public.profiles
  for select using (auth.uid() = id);
create policy "criar o proprio perfil" on public.profiles
  for insert with check (auth.uid() = id);
create policy "atualizar o proprio perfil" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
