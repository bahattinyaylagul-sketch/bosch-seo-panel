-- ============================================================
-- Storage: iş takibi çıktı dosyaları
-- schema.sql çalıştırıldıktan SONRA çalıştır.
-- ============================================================

-- Public okunabilir bucket (çıktı dosyaları linkle paylaşılır)
insert into storage.buckets (id, name, public)
values ('execution-outputs', 'execution-outputs', true)
on conflict (id) do nothing;

-- Herkes (giriş yapmış) okuyabilir; yükleme/silme sadece admin
drop policy if exists "exec_outputs_read" on storage.objects;
create policy "exec_outputs_read" on storage.objects
  for select using (bucket_id = 'execution-outputs');

drop policy if exists "exec_outputs_insert_admin" on storage.objects;
create policy "exec_outputs_insert_admin" on storage.objects
  for insert with check (bucket_id = 'execution-outputs' and public.is_admin());

drop policy if exists "exec_outputs_update_admin" on storage.objects;
create policy "exec_outputs_update_admin" on storage.objects
  for update using (bucket_id = 'execution-outputs' and public.is_admin());

drop policy if exists "exec_outputs_delete_admin" on storage.objects;
create policy "exec_outputs_delete_admin" on storage.objects
  for delete using (bucket_id = 'execution-outputs' and public.is_admin());
