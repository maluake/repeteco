-- Gerado por scripts/gerar-migracoes.js a partir de supabase/v11/1_antispam.sql.
-- Não edite aqui: edite o arquivo de origem e rode `npm run migracoes`.

-- =====================================================================
-- REPETECO v11 — parte 1: limite de envios (anti-spam)
--
-- O que muda:
--   * contatos e evento_parcerias aceitam no máximo 3 envios do mesmo
--     e-mail a cada 10 minutos e 30 envios no total por minuto (todos
--     os e-mails somados). Acima disso o envio é recusado com uma
--     mensagem em português, que o site já mostra no formulário.
--   * Administradores não têm limite.
-- Só acrescenta uma função, dois índices e dois triggers. Nenhuma tabela,
-- coluna ou linha é apagada. Pode ser executado mais de uma vez.
-- =====================================================================

create index if not exists idx_contatos_email_criado on public.contatos (lower(email), created_at desc);
create index if not exists idx_evento_parcerias_email_criado on public.evento_parcerias (lower(email), created_at desc);

create or replace function public.limitar_envios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  por_email int;
  no_minuto int;
begin
  if public.is_admin() then
    return new;
  end if;

  execute format(
    'select count(*) filter (where lower(email) = lower($1) and created_at > now() - interval ''10 minutes''),
            count(*) filter (where created_at > now() - interval ''1 minute'')
       from public.%I
      where created_at > now() - interval ''10 minutes''',
    tg_table_name)
  into por_email, no_minuto
  using new.email;

  if por_email >= 3 then
    raise exception 'Você já enviou várias mensagens agora há pouco. Aguarde alguns minutos e tente de novo.'
      using errcode = 'P0001';
  end if;
  if no_minuto >= 30 then
    raise exception 'Recebemos muitas mensagens neste minuto. Tente de novo em instantes.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.limitar_envios() from public, anon, authenticated;

drop trigger if exists contatos_limitar_envios on public.contatos;
create trigger contatos_limitar_envios
before insert on public.contatos
for each row execute function public.limitar_envios();

drop trigger if exists evento_parcerias_limitar_envios on public.evento_parcerias;
create trigger evento_parcerias_limitar_envios
before insert on public.evento_parcerias
for each row execute function public.limitar_envios();
