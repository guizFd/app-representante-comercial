-- ============================================================
--  GiroFood — configuração do banco de dados (Supabase)
--  Cole TODO este conteúdo no SQL Editor do Supabase e clique em RUN.
--  Ele cria as duas tabelas e as regras de segurança (RLS).
-- ============================================================

-- 1) DADOS DE CADA REPRESENTANTE (isolados por usuário)
create table if not exists public.dados_usuario (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  dados         jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

alter table public.dados_usuario enable row level security;

drop policy if exists "usuario_le_seus_dados"      on public.dados_usuario;
drop policy if exists "usuario_insere_seus_dados"  on public.dados_usuario;
drop policy if exists "usuario_atualiza_seus_dados" on public.dados_usuario;

create policy "usuario_le_seus_dados"
  on public.dados_usuario for select
  using (auth.uid() = user_id);

create policy "usuario_insere_seus_dados"
  on public.dados_usuario for insert
  with check (auth.uid() = user_id);

create policy "usuario_atualiza_seus_dados"
  on public.dados_usuario for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2) CATÁLOGO COMPARTILHADO (produtos e empresas — iguais para todos)
create table if not exists public.catalogo (
  id    int primary key,
  dados jsonb not null default '{}'::jsonb
);

alter table public.catalogo enable row level security;

drop policy if exists "todos_leem_catalogo"     on public.catalogo;
drop policy if exists "todos_inserem_catalogo"  on public.catalogo;
drop policy if exists "todos_atualizam_catalogo" on public.catalogo;

-- Qualquer usuário logado pode ler e editar o catálogo compartilhado.
create policy "todos_leem_catalogo"
  on public.catalogo for select
  using (auth.uid() is not null);

create policy "todos_inserem_catalogo"
  on public.catalogo for insert
  with check (auth.uid() is not null);

create policy "todos_atualizam_catalogo"
  on public.catalogo for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Pronto! As tabelas começam vazias e o app preenche o catálogo
-- automaticamente no primeiro acesso.
