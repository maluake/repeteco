-- Simula tabelas criadas à mão no painel do Supabase antes da v4:
-- id uuid sem valor padrão, created_at obrigatório sem padrão e uma
-- regra antiga em profiles.role que não aceita "dono" e colunas antigas
-- obrigatórias de pessoa (usuario_id / id_usuario), como no banco real.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  role text not null default 'usuario' constraint profiles_role_antiga check (role in ('usuario', 'admin')),
  created_at timestamptz not null default now()
);
create table if not exists public.curtidas (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  id_usuario text not null,
  origem text not null,
  brecho_id uuid not null,
  created_at timestamptz not null
);
create table if not exists public.salvos (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  brecho_id uuid not null,
  created_at timestamptz not null
);
