-- Testes da migration v9 (origem do perfil e upload da administração).
\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
update public.brechos set origem = 'curadoria' where id = '10000000-0000-0000-0000-000000000001';
select t_expect_rows($q$select 1 from public.brechos where id = '10000000-0000-0000-0000-000000000001' and origem = 'cadastro'$q$, 1, 'dono não muda a origem do perfil');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t_expect_affected($q$update public.brechos set origem = 'curadoria', user_id = null where id = '10000000-0000-0000-0000-000000000002'$q$, 1, 'admin marca perfil como curadoria sem dono');
select t_expect_affected($q$update public.brechos set status = 'approved', latitude = -23.56, longitude = -46.69 where id = '10000000-0000-0000-0000-000000000002'$q$, 1, 'admin aprova e posiciona perfil da curadoria');
select t_expect_affected($q$insert into storage.objects (bucket_id, name) values ('brechos', '00000000-0000-0000-0000-00000000000a/capa.webp')$q$, 1, 'admin envia foto no bucket brechos');
select t_expect_affected($q$update public.brechos set user_id = '00000000-0000-0000-0000-00000000000d' where id = '10000000-0000-0000-0000-000000000002'$q$, 1, 'admin vincula o perfil ao dono');
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t_expect_rows($q$select 1 from public.brechos_publicos where id = '10000000-0000-0000-0000-000000000002' and origem = 'curadoria'$q$, 1, 'view pública mostra a origem');
select t_expect_error($q$select user_id from public.brechos_publicos$q$, 'view pública não expõe o dono');
reset role;
