-- Bucket `offer-pdfs`: cache PDF oferty (apps/web/lib/pdf/storage.ts, BACKEND_SPEC 9.1 i 11.8).
-- Do 2026-10-26 bucket był zdefiniowany tylko w supabase/config.toml (lokalny Supabase CLI), więc w
-- produkcji go nie było ("Bucket not found" w logu trasy PDF) i cache nie działał. Produkcyjny bucket
-- założono ręcznie w panelu; ta migracja odtwarza go w nowym środowisku i niczego nie zmienia,
-- gdy bucket już istnieje (on conflict do nothing).
-- Prywatny, bez polityk RLS: trasa używa klucza serwisowego, a klient dostaje PDF przez API.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('offer-pdfs', 'offer-pdfs', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;
