-- ============================================================
-- REPETECO — migration v5, parte 5 de 6: funções de estatística (admin e dono)
-- Cole ESTE ARQUIVO INTEIRO no SQL Editor e clique em Run.
-- Rode as partes em ordem (1 → 6). Cada uma pode ser repetida
-- sem problema (idempotente).
-- ============================================================

-- ------------------------------------------------------------
-- 8. ESTATÍSTICAS (calculadas no banco, com checagem de permissão)
-- ------------------------------------------------------------
create or replace function public.estatisticas_brecho(p_brecho_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resultado json;
begin
  if not (public.is_owner_of_brecho(p_brecho_id) or public.is_admin()) then
    raise exception 'Sem permissão para ver as estatísticas deste brechó.' using errcode = '42501';
  end if;

  select json_build_object(
    'visitas_30d', (select count(*) from brecho_eventos where brecho_id = p_brecho_id and tipo = 'view' and created_at >= now() - interval '30 days'),
    'cliques_mapa_30d', (select count(*) from brecho_eventos where brecho_id = p_brecho_id and tipo = 'map_click' and created_at >= now() - interval '30 days'),
    'cliques_contato_30d', (select count(*) from brecho_eventos where brecho_id = p_brecho_id and tipo = 'contact_click' and created_at >= now() - interval '30 days'),
    'curtidas_brecho', (select count(*) from curtidas where brecho_id::text = p_brecho_id::text),
    'salvos_brecho', (select count(*) from salvos where brecho_id::text = p_brecho_id::text),
    'curtidas_publicacoes', (select count(*) from curtidas c join publicacoes p on p.id = c.publicacao_id where p.brecho_id = p_brecho_id),
    'salvos_publicacoes', (select count(*) from salvos s join publicacoes p on p.id = s.publicacao_id where p.brecho_id = p_brecho_id),
    'publicacoes', (select count(*) from publicacoes where brecho_id = p_brecho_id and status = 'publicado'),
    'rascunhos', (select count(*) from publicacoes where brecho_id = p_brecho_id and status = 'rascunho'),
    'visitas_por_dia', (
      select json_agg(json_build_object('dia', d::date, 'total', coalesce(e.total, 0)) order by d)
      from generate_series((now() - interval '13 days')::date, now()::date, interval '1 day') d
      left join (
        select created_at::date as dia, count(*) as total
        from brecho_eventos
        where brecho_id = p_brecho_id and tipo = 'view' and created_at >= now() - interval '14 days'
        group by 1
      ) e on e.dia = d::date
    ),
    'top_publicacoes', (
      select coalesce(json_agg(t), '[]'::json) from (
        select p.id, p.titulo, p.imagem_url,
          (select count(*) from curtidas c where c.publicacao_id = p.id) as curtidas,
          (select count(*) from salvos s where s.publicacao_id = p.id) as salvos
        from publicacoes p
        where p.brecho_id = p_brecho_id
        order by 4 desc, 5 desc, p.created_at desc
        limit 5
      ) t
    )
  ) into resultado;
  return resultado;
end;
$$;

create or replace function public.admin_resumo()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resultado json;
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores.' using errcode = '42501';
  end if;

  select json_build_object(
    'usuarios', (select count(*) from profiles),
    'donos', (select count(*) from profiles where role = 'dono'),
    'admins', (select count(*) from profiles where role = 'admin'),
    'brechos_aprovados', (select count(*) from brechos where status = 'approved'),
    'brechos_pendentes', (select count(*) from brechos where status = 'pending'),
    'brechos_recusados', (select count(*) from brechos where status = 'rejected'),
    'brechos_sem_localizacao', (select count(*) from brechos where status = 'approved' and (latitude is null or longitude is null)),
    'publicacoes', (select count(*) from publicacoes where status = 'publicado'),
    'artigos_publicados', (select count(*) from artigos where status = 'publicado'),
    'artigos_rascunho', (select count(*) from artigos where status = 'rascunho'),
    'curtidas', (select count(*) from curtidas),
    'salvos', (select count(*) from salvos),
    'visitas_30d', (select count(*) from brecho_eventos where tipo = 'view' and created_at >= now() - interval '30 days'),
    'mensagens_nao_lidas', (select count(*) from contatos where not lido),
    'semanas', (
      select json_agg(json_build_object(
        'semana', w::date,
        'usuarios', (select count(*) from profiles where created_at >= w and created_at < w + interval '7 days'),
        'brechos', (select count(*) from brechos where created_at >= w and created_at < w + interval '7 days'),
        'publicacoes', (select count(*) from publicacoes where created_at >= w and created_at < w + interval '7 days'),
        'interacoes', (select count(*) from curtidas where created_at >= w and created_at < w + interval '7 days')
                    + (select count(*) from salvos where created_at >= w and created_at < w + interval '7 days')
      ) order by w)
      from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') w
    )
  ) into resultado;
  return resultado;
end;
$$;

create or replace function public.admin_listar_usuarios()
returns table (
  id uuid, nome text, email text, role text, cidade text, avatar_url text,
  created_at timestamptz, last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores.' using errcode = '42501';
  end if;
  return query
    select p.id, p.nome, u.email::text, p.role, p.cidade, p.avatar_url, p.created_at, u.last_sign_in_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

revoke execute on function public.admin_resumo() from anon;
revoke execute on function public.admin_listar_usuarios() from anon;
revoke execute on function public.estatisticas_brecho(uuid) from anon;
