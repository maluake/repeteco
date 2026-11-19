-- ============================================================
-- REPETECO — migration v10, parte 1 de 1: regra da função (role)
-- Rode DEPOIS da v9. Cole ESTE ARQUIVO INTEIRO no SQL Editor e
-- clique em Run. Pode ser repetida sem problema.
--
-- Problema corrigido: o banco já tinha, de antes da v5, uma regra
-- chamada "profiles_role_check" que não aceita a função "dono". Como a
-- v5 cria a regra certa com esse mesmo nome, ela foi pulada, e trocar
-- a função de alguém para "dono" dava:
--   new row for relation "profiles" violates check constraint "profiles_role_check"
--
-- O que muda (nenhuma linha é apagada nem alterada):
--   * a regra profiles_role_check é refeita para aceitar exatamente
--     usuario, dono e admin. A definição antiga aparece na mensagem
--     (NOTICE) antes de ser trocada.
--   * qualquer outra regra sobre "role" em profiles que recuse esses
--     três valores também é removida (e listada).
--   * a regra nova vale para gravações novas; linhas antigas com
--     outros valores (se houver) continuam como estão e aparecem no
--     diagnóstico (supabase/diagnostico.sql).
-- ============================================================

do $$
declare
  c record;
begin
  for c in
    select con.conname, pg_get_constraintdef(con.oid) as def
    from pg_constraint con
    where con.conrelid = 'public.profiles'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%role%'
  loop
    -- a regra oficial é exatamente: role in ('usuario','dono','admin')
    if c.conname = 'profiles_role_check'
       and c.def ilike '%''usuario''%' and c.def ilike '%''dono''%' and c.def ilike '%''admin''%'
       and (select count(*) from regexp_matches(c.def, '''[^'']+''', 'g')) = 3 then
      raise notice 'profiles_role_check já está correta: %', c.def;
      continue;
    end if;
    raise notice 'Removendo regra de role: % (%)', c.conname, c.def;
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;

  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_role_check') then
    alter table public.profiles add constraint profiles_role_check
      check (role in ('usuario', 'dono', 'admin')) not valid;
    raise notice 'profiles_role_check recriada: usuario, dono, admin';
  end if;
end $$;

-- Valores fora do padrão que ainda existam (só leitura, para conferência).
select role, count(*) as pessoas from public.profiles
where role not in ('usuario', 'dono', 'admin') or role is null
group by role;
