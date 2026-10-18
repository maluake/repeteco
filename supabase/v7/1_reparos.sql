-- ============================================================
-- REPETECO — migration v7, parte 1 de 2: reparos de curtir/salvar e de funções
-- Rode DEPOIS da v6 completa. Cole ESTE ARQUIVO INTEIRO no SQL
-- Editor e clique em Run. Pode ser repetida sem problema.
--
-- O que muda (nenhuma linha de dados é apagada):
--   * profiles: cria o perfil que faltar para contas já existentes
--     (com função "usuario"); contas com brechó aprovado que ainda
--     estavam como "usuario" passam a "dono" (mesma regra da v5).
--   * profiles: restrições CHECK antigas sobre "role" que não
--     aceitem os valores usuario/dono/admin são removidas e
--     listadas nas mensagens (NOTICE). A regra oficial
--     profiles_role_check continua valendo.
--   * nova função admin_definir_funcao: a administração troca a
--     função de uma pessoa por ela (confere is_admin no banco).
--   * curtidas/salvos: colunas id/created_at sem valor padrão
--     ganham padrão; brecho_id e publicacao_id deixam de ser
--     obrigatórios. Outras colunas obrigatórias sem padrão são
--     apenas listadas (NOTICE), sem alteração.
--   * alternar_interacao passa a devolver o motivo real da falha.
--   * permissões (GRANT) explícitas para as tabelas do site. Antes
--     disso, o arquivo confere que todas têm RLS ligada — se alguma
--     não tiver, nada é alterado e o erro diz qual é.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Segurança primeiro: só concede permissões a tabelas com RLS.
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'brechos', 'publicacoes', 'curtidas', 'salvos', 'artigos',
                           'contatos', 'brecho_eventos', 'eventos', 'evento_parcerias'] loop
    if to_regclass('public.' || t) is null then
      raise exception 'Tabela public.% não existe. Rode as partes da v5 e da v6 antes da v7.', t;
    end if;
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'A tabela public.% está sem RLS. Nada foi alterado.', t;
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 1. PROFILES — perfis faltando, regras antigas de role, donos
-- ------------------------------------------------------------
insert into public.profiles (id, nome, role)
select u.id, coalesce(nullif(u.raw_user_meta_data->>'nome', ''), split_part(u.email, '@', 1), 'pessoa'), 'usuario'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

do $$
declare
  c record;
begin
  for c in
    select con.conname, pg_get_constraintdef(con.oid) as def
    from pg_constraint con
    where con.conrelid = 'public.profiles'::regclass
      and con.contype = 'c'
      and con.conname <> 'profiles_role_check'
      and pg_get_constraintdef(con.oid) ilike '%role%'
  loop
    raise notice 'Removendo restrição antiga de profiles: % (%)', c.conname, c.def;
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

update public.profiles p set role = 'dono'
where p.role = 'usuario'
  and exists (select 1 from public.brechos b where b.user_id = p.id and b.status = 'approved');

create or replace function public.admin_definir_funcao(p_user_id uuid, p_role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Somente administradores podem alterar a função de uma pessoa.' using errcode = '42501';
  end if;
  if p_role not in ('usuario', 'dono', 'admin') then
    raise exception 'Função inválida: %.', p_role using errcode = '22023';
  end if;
  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception 'Você não pode remover o seu próprio acesso de administração.' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Conta não encontrada.' using errcode = 'P0002';
  end if;
  insert into public.profiles (id, nome, role)
  select u.id, coalesce(nullif(u.raw_user_meta_data->>'nome', ''), split_part(u.email, '@', 1), 'pessoa'), p_role
  from auth.users u where u.id = p_user_id
  on conflict (id) do update set role = excluded.role;
  return p_role;
end;
$$;

revoke execute on function public.admin_definir_funcao(uuid, text) from public, anon;
grant execute on function public.admin_definir_funcao(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 2. CURTIDAS / SALVOS — colunas que impediam o insert
-- ------------------------------------------------------------
do $$
declare
  t text;
  col record;
  seq text;
begin
  foreach t in array array['curtidas', 'salvos'] loop
    for col in
      select a.attname, format_type(a.atttypid, a.atttypmod) as tipo, a.attnotnull,
             a.attidentity, pg_get_expr(d.adbin, d.adrelid) as padrao
      from pg_attribute a
      left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where a.attrelid = ('public.' || t)::regclass and a.attnum > 0 and not a.attisdropped
    loop
      if col.attname = 'id' and col.padrao is null and col.attidentity = '' then
        if col.tipo = 'uuid' then
          execute format('alter table public.%I alter column id set default gen_random_uuid()', t);
          raise notice '%.id ganhou padrão gen_random_uuid()', t;
        elsif col.tipo in ('bigint', 'integer', 'smallint') then
          seq := t || '_id_seq_v7';
          execute format('create sequence if not exists public.%I owned by public.%I.id', seq, t);
          execute format('select setval(%L, coalesce((select max(id) from public.%I), 0) + 1, false)', 'public.' || seq, t);
          execute format('alter table public.%I alter column id set default nextval(%L)', t, 'public.' || seq);
          raise notice '%.id ganhou padrão de sequência', t;
        end if;
      elsif col.attname = 'created_at' and col.padrao is null then
        execute format('alter table public.%I alter column created_at set default now()', t);
        raise notice '%.created_at ganhou padrão now()', t;
      elsif col.attname in ('brecho_id', 'publicacao_id') and col.attnotnull then
        execute format('alter table public.%I alter column %I drop not null', t, col.attname);
        raise notice '%.% deixou de ser obrigatório', t, col.attname;
      elsif col.attnotnull and col.padrao is null and col.attidentity = ''
            and col.attname not in ('id', 'user_id', 'created_at', 'brecho_id', 'publicacao_id') then
        raise notice 'ATENÇÃO: %.% (%) é obrigatória e não tem valor padrão — envie esta mensagem para revisão.', t, col.attname, col.tipo;
      end if;
    end loop;
  end loop;
end $$;

-- Mesma função da v6, agora devolvendo o motivo real quando o banco recusa.
create or replace function public.alternar_interacao(
  p_tipo text,
  p_publicacao_id uuid default null,
  p_brecho_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_tabela text;
  v_existe boolean;
begin
  if v_user is null then
    raise exception 'Entre na sua conta para curtir ou salvar.' using errcode = '42501';
  end if;
  if p_tipo = 'curtida' then v_tabela := 'curtidas';
  elsif p_tipo = 'salvo' then v_tabela := 'salvos';
  else raise exception 'Tipo de interação inválido.' using errcode = '22023';
  end if;
  if num_nonnulls(p_publicacao_id, p_brecho_id) <> 1 then
    raise exception 'Informe uma peça ou um brechó.' using errcode = '22023';
  end if;

  if p_publicacao_id is not null then
    execute format('select exists (select 1 from public.%I where user_id = $1 and publicacao_id = $2)', v_tabela)
      into v_existe using v_user, p_publicacao_id;
    if v_existe then
      execute format('delete from public.%I where user_id = $1 and publicacao_id = $2', v_tabela)
        using v_user, p_publicacao_id;
      return false;
    end if;
    if not public.publicacao_visivel(p_publicacao_id) then
      raise exception 'Esta peça não está disponível.' using errcode = '42501';
    end if;
    begin
      execute format('insert into public.%I (user_id, publicacao_id) values ($1, $2)', v_tabela)
        using v_user, p_publicacao_id;
    exception
      when unique_violation then return true;  -- clique duplo: já estava gravado
      when others then
        raise exception 'O banco recusou a gravação em %: % (%)', v_tabela, sqlerrm, sqlstate using errcode = 'P0001';
    end;
    return true;
  end if;

  execute format('select exists (select 1 from public.%I where user_id = $1 and brecho_id::text = $2)', v_tabela)
    into v_existe using v_user, p_brecho_id::text;
  if v_existe then
    execute format('delete from public.%I where user_id = $1 and brecho_id::text = $2', v_tabela)
      using v_user, p_brecho_id::text;
    return false;
  end if;
  if not public.brecho_aprovado(p_brecho_id) then
    raise exception 'Este brechó não está disponível.' using errcode = '42501';
  end if;
  begin
    execute format('insert into public.%I (user_id, brecho_id) values ($1, %L)', v_tabela, p_brecho_id::text)
      using v_user;
  exception
    when unique_violation then return true;
    when others then
      raise exception 'O banco recusou a gravação em %: % (%)', v_tabela, sqlerrm, sqlstate using errcode = 'P0001';
  end;
  return true;
end;
$$;

revoke execute on function public.alternar_interacao(text, uuid, uuid) from public, anon;
revoke execute on function public.minhas_interacoes() from public, anon;
grant execute on function public.alternar_interacao(text, uuid, uuid) to authenticated;
grant execute on function public.minhas_interacoes() to authenticated;

-- ------------------------------------------------------------
-- 3. PERMISSÕES explícitas (as regras de RLS continuam decidindo
--    quais linhas cada pessoa vê ou altera).
-- ------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.profiles, public.brechos, public.publicacoes, public.curtidas, public.salvos,
  public.artigos, public.contatos, public.brecho_eventos, public.eventos, public.evento_parcerias
  to authenticated;
grant select on public.publicacoes, public.artigos, public.eventos to anon;
grant insert on public.contatos, public.brecho_eventos, public.evento_parcerias to anon;
grant select on public.brechos_publicos, public.feed_publicacoes to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
