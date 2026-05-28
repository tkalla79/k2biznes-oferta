-- Pre-launch security fixes (po code review):
-- 1. Usun image/svg+xml z bucket public-uploads (admin-compromise XSS surface)
-- 2. Idempotent policies (drop+create) — backstop dla re-runow

-- Update bucket allowed_mime_types (SVG out)
update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id = 'public-uploads';

-- Re-create policies idempotently (zachowuje semantyke + safe dla re-run)
drop policy if exists "public_read_uploads" on storage.objects;
create policy "public_read_uploads" on storage.objects for select to anon, authenticated
  using (bucket_id = 'public-uploads');

drop policy if exists "admin_write_uploads" on storage.objects;
create policy "admin_write_uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-uploads' and (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','super_admin'));

drop policy if exists "admin_update_uploads" on storage.objects;
create policy "admin_update_uploads" on storage.objects for update to authenticated
  using (bucket_id = 'public-uploads' and (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','super_admin'));

drop policy if exists "admin_delete_uploads" on storage.objects;
create policy "admin_delete_uploads" on storage.objects for delete to authenticated
  using (bucket_id = 'public-uploads' and (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','super_admin'));
