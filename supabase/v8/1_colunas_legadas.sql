-- ============================================================
-- REPETECO — migration v8, parte 1 de 1: colunas antigas em curtidas/salvos
-- Rode DEPOIS da v7. Cole ESTE ARQUIVO INTEIRO no SQL Editor e
-- clique em Run. Pode ser repetida sem problema.
--
-- Problema corrigido: no banco real, salvos (e talvez curtidas) têm
-- uma coluna antiga "usuario_id" obrigatória, além de "user_id",
-- que é a que o site usa. Todo insert falhava com
--   null value in column "usuario_id" ... violates not-null constraint
--
-- O que muda (nenhuma linha é apagada):
--   * para cada coluna antiga de pessoa (usuario_id, id_usuario,
--     usuario, perfil_id, profile_id) que exista em curtidas/salvos:
--       - linhas existentes: o valor que faltar é copiado da outra
--         coluna (user_id ↔ coluna antiga);
--       - um trigger mantém as duas iguais em todo insert/update.
--   * qualquer outra coluna obrigatória sem valor padrão nessas duas
--     tabelas (que o site não conhece) deixa de ser obrigatória. Cada
--     uma é listada nas mensagens (NOTICE).
-- ============================================================

-- Trigger genérico: TG_ARGV[0] = nome da coluna antiga.
create or replace function public.sincronizar_coluna_pessoa()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  antiga text := tg_argv[0];
  v_antiga text := to_jsonb(new) ->> antiga;
begin
  if new.user_id is null and v_antiga is not null then
    new.user_id := v_antiga::uuid;
  end if;
  if v_antiga is null and new.user_id is not null then
    new := jsonb_populate_record(new, jsonb_build_object(antiga, new.user_id));
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
  col record;
  apelidos text[] := array['usuario_id', 'id_usuario', 'usuario', 'perfil_id', 'profile_id'];
begin
  foreach t in array array['curtidas', 'salvos'] loop
    -- 1. colunas antigas de pessoa
    for col in
      select a.attname, format_type(a.atttypid, a.atttypmod) as tipo
      from pg_attribute a
      where a.attrelid = ('public.' || t)::regclass and a.attnum > 0 and not a.attisdropped
        and a.attname = any (apelidos)
    loop
      if col.tipo not in ('uuid', 'text', 'character varying') then
        raise notice 'ATENÇÃO: %.% é do tipo % — não foi sincronizada. Envie esta mensagem para revisão.', t, col.attname, col.tipo;
        continue;
      end if;
      execute format('update public.%I set user_id = %I::uuid where user_id is null and %I is not null', t, col.attname, col.attname);
      execute format('update public.%I set %I = user_id%s where %I is null and user_id is not null',
                     t, col.attname, case when col.tipo = 'uuid' then '' else '::text' end, col.attname);
      execute format('drop trigger if exists %I on public.%I', 'sincroniza_' || col.attname, t);
      execute format('create trigger %I before insert or update on public.%I for each row execute function public.sincronizar_coluna_pessoa(%L)',
                     'sincroniza_' || col.attname, t, col.attname);
      raise notice '%.% agora acompanha user_id automaticamente', t, col.attname;
    end loop;

    -- 2. outras colunas obrigatórias sem padrão que o site não preenche
    for col in
      select a.attname
      from pg_attribute a
      left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where a.attrelid = ('public.' || t)::regclass and a.attnum > 0 and not a.attisdropped
        and a.attnotnull and d.adbin is null and a.attidentity = ''
        and a.attname not in ('id', 'user_id')
        and not (a.attname = any (apelidos))
        and not exists (select 1 from pg_index i where i.indrelid = a.attrelid and i.indisprimary and a.attnum = any (i.indkey))
    loop
      execute format('alter table public.%I alter column %I drop not null', t, col.attname);
      raise notice '%.% deixou de ser obrigatória (o site não usa esta coluna)', t, col.attname;
    end loop;
  end loop;
end $$;
