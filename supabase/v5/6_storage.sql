-- ============================================================
-- REPETECO — migration v5, parte 6 de 6: buckets e policies do Storage
-- Cole ESTE ARQUIVO INTEIRO no SQL Editor e clique em Run.
-- Rode as partes em ordem (1 → 6). Cada uma pode ser repetida
-- sem problema (idempotente).
-- ============================================================

-- ------------------------------------------------------------
-- 9. STORAGE — buckets públicos para leitura, escrita por pasta
-- Estrutura de caminhos: <bucket>/<auth.uid()>/<arquivo>
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',   'avatars',   true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('brechos',   'brechos',   true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('editorial', 'editorial', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "repeteco_storage_select_own" on storage.objects;
create policy "repeteco_storage_select_own"
on storage.objects for select
using (
  bucket_id in ('avatars', 'brechos', 'editorial')
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

drop policy if exists "repeteco_storage_insert" on storage.objects;
create policy "repeteco_storage_insert"
on storage.objects for insert
with check (
  (storage.foldername(name))[1] = auth.uid()::text
  and (
    bucket_id = 'avatars'
    or (bucket_id = 'brechos' and exists (select 1 from public.brechos b where b.user_id = auth.uid() or b.dono_id = auth.uid()))
    or (bucket_id = 'editorial' and public.is_admin())
  )
);

drop policy if exists "repeteco_storage_update" on storage.objects;
create policy "repeteco_storage_update"
on storage.objects for update
using (bucket_id in ('avatars', 'brechos', 'editorial') and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id in ('avatars', 'brechos', 'editorial') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "repeteco_storage_delete" on storage.objects;
create policy "repeteco_storage_delete"
on storage.objects for delete
using (
  bucket_id in ('avatars', 'brechos', 'editorial')
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);
