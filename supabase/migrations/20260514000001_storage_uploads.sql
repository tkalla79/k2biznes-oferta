-- Storage bucket dla logo/photo (case studies, contact persons, programs)
-- SVG celowo niedozwolone — XSS surface przy admin-compromise (browsers run
-- <script> w SVG na top-level storage.supabase.co).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-uploads', 'public-uploads', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- RLS dla storage.objects (bucket-scoped) — idempotent drop+create dla re-run safety
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

-- Nowe kolumny dla storage keys (legacy logo_url/photo_url zostaja dla backwards compat)
alter table case_studies add column if not exists logo_storage_key text;
alter table contact_persons add column if not exists photo_storage_key text;
alter table programs add column if not exists cover_storage_key text;

comment on column case_studies.logo_storage_key is 'Storage key (np. case-studies/logo-uuid.png) w bucket public-uploads. Fallback do logo_big jesli null.';
comment on column contact_persons.photo_storage_key is 'Storage key (np. contact-persons/photo-uuid.jpg) w bucket public-uploads. Fallback do photo_url.';
comment on column programs.cover_storage_key is 'Storage key (np. programs/cover-uuid.webp) w bucket public-uploads.';
