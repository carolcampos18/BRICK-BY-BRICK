-- DUELO ENTRE AMIGOS
-- Cole no Supabase: SQL Editor > New query > Run.
-- Rode DEPOIS do supabase.sql (o do perfil). Pode rodar de novo sem problema.

-- 1) Lista de jogadores (nome e foto). Todo cadastrado aparece como "amigo".
--    Moedas, itens e e-mail NÃO ficam aqui, continuam privados no perfil.
create table if not exists public.players (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Jogador',
  avatar text,
  updated_at timestamptz not null default now()
);
alter table public.players enable row level security;

drop policy if exists "ver jogadores" on public.players;
create policy "ver jogadores" on public.players
  for select to authenticated using (true);
drop policy if exists "criar o proprio jogador" on public.players;
create policy "criar o proprio jogador" on public.players
  for insert to authenticated with check (auth.uid() = id);
drop policy if exists "atualizar o proprio jogador" on public.players;
create policy "atualizar o proprio jogador" on public.players
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- 2) Duelos
create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  challenger uuid not null references public.players(id) on delete cascade,
  opponent   uuid not null references public.players(id) on delete cascade,
  seed bigint not null,                      -- mesma sequência de peças, vento e feitiços para os dois
  pieces int not null default 25,
  ch_h int not null, ch_l int not null,      -- altura e vidas de quem desafiou
  op_h int, op_l int,                        -- altura e vidas de quem respondeu
  status text not null default 'pending' check (status in ('pending','done')),
  winner uuid,                               -- vazio = empate (quando status = done)
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 day',
  ch_claimed boolean not null default false, -- prêmio já recebido por quem desafiou
  op_claimed boolean not null default false, -- prêmio já recebido por quem respondeu
  op_started boolean not null default false, -- o desafiado já abriu o duelo (não dá para repetir até ganhar)
  check (challenger <> opponent)
);
alter table public.duels add column if not exists op_started boolean not null default false;
create index if not exists duels_challenger_idx on public.duels (challenger, created_at desc);
create index if not exists duels_opponent_idx   on public.duels (opponent, created_at desc);
alter table public.duels enable row level security;

-- cada um vê só os duelos de que participa
drop policy if exists "ver meus duelos" on public.duels;
create policy "ver meus duelos" on public.duels
  for select to authenticated using (auth.uid() in (challenger, opponent));

-- só dá para criar um duelo como desafiante e ainda sem resposta
drop policy if exists "criar desafio" on public.duels;
create policy "criar desafio" on public.duels
  for insert to authenticated with check (
    challenger = auth.uid() and status = 'pending' and winner is null
    and op_h is null and op_l is null and ch_claimed = false and op_claimed = false and op_started = false
    and ch_h between 0 and 6000 and ch_l between 0 and 3 and pieces = 25
    and expires_at <= now() + interval '1 day 1 minute'
  );
-- (sem política de update/delete: respostas e prêmios só passam pelas funções abaixo)

-- 3a) Começar a jogar um duelo recebido. Só dá para começar UMA vez: se sair no meio e tentar de novo,
--     o duelo conta como derrota (assim ninguém repete a mesma sequência até ganhar).
create or replace function public.start_duel(p_id uuid)
returns public.duels
language plpgsql security definer set search_path = public as $$
declare d public.duels;
begin
  select * into d from public.duels where id = p_id for update;
  if not found or d.opponent <> auth.uid() then raise exception 'duelo invalido'; end if;
  if d.status <> 'pending' then raise exception 'duelo ja respondido'; end if;
  if d.expires_at < now() then raise exception 'duelo expirado'; end if;
  if d.op_started then
    update public.duels set op_h = 0, op_l = 0, status = 'done', winner = d.challenger
      where id = p_id returning * into d;
  else
    update public.duels set op_started = true where id = p_id returning * into d;
  end if;
  return d;
end $$;

-- 3b) Responder um duelo: só o desafiado, uma vez, antes de expirar. O servidor decide o vencedor.
create or replace function public.submit_duel(p_id uuid, p_h int, p_l int)
returns public.duels
language plpgsql security definer set search_path = public as $$
declare d public.duels; ch int; op int; w uuid;
begin
  select * into d from public.duels where id = p_id for update;
  if not found or d.opponent <> auth.uid() then raise exception 'duelo invalido'; end if;
  if d.status <> 'pending' then raise exception 'duelo ja respondido'; end if;
  if d.expires_at < now() then raise exception 'duelo expirado'; end if;
  p_h := greatest(0, least(p_h, 6000)); p_l := greatest(0, least(p_l, 3));
  ch := round(d.ch_h / 5.0); op := round(p_h / 5.0);
  if ch <> op then w := case when op > ch then d.opponent else d.challenger end;
  elsif d.ch_l <> p_l then w := case when p_l > d.ch_l then d.opponent else d.challenger end;
  else w := null; end if;
  update public.duels set op_h = p_h, op_l = p_l, status = 'done', winner = w
    where id = p_id returning * into d;
  return d;
end $$;

-- 4) Receber o prêmio (uma vez por jogador): vencedor 50, empate 30 para cada, perdedor 0.
create or replace function public.claim_duel(p_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare d public.duels; me uuid := auth.uid(); prize int;
begin
  select * into d from public.duels where id = p_id for update;
  if not found or me is null or me not in (d.challenger, d.opponent) then raise exception 'duelo invalido'; end if;
  if d.status <> 'done' then return 0; end if;
  if me = d.challenger then
    if d.ch_claimed then return 0; end if;
    update public.duels set ch_claimed = true where id = p_id;
  else
    if d.op_claimed then return 0; end if;
    update public.duels set op_claimed = true where id = p_id;
  end if;
  prize := case when d.winner is null then 30 when d.winner = me then 50 else 0 end;
  return prize;
end $$;

revoke all on function public.start_duel(uuid) from public, anon;
grant execute on function public.start_duel(uuid) to authenticated;
revoke all on function public.submit_duel(uuid, int, int) from public, anon;
revoke all on function public.claim_duel(uuid) from public, anon;
grant execute on function public.submit_duel(uuid, int, int) to authenticated;
grant execute on function public.claim_duel(uuid) to authenticated;
