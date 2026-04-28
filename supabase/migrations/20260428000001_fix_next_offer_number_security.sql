-- Fix: `next_offer_number()` używa `execute format('create sequence ...')`
-- co wymaga CREATE permission w schema public. Domyślnie tylko `postgres`
-- ma to prawo — service_role i authenticated dostawały "permission denied for schema public".
--
-- Rozwiązanie: SECURITY DEFINER (funkcja runs as owner = postgres) +
-- jawny grant execute. Funkcja jest wywoływana tylko przez API z service role,
-- ale grant'ujemy authenticated też dla testowych narzędzi.

create or replace function next_offer_number()
returns text language plpgsql security definer set search_path = public as $$
declare
  yyyy_mm text := to_char(now(), 'YYYY/MM');
  seq_name text := 'offer_seq_' || to_char(now(), 'YYYY_MM');
  next_val bigint;
begin
  execute format('create sequence if not exists %I', seq_name);
  execute format('select nextval(%L)', seq_name) into next_val;
  return 'K2/' || yyyy_mm || '/' || lpad(next_val::text, 3, '0');
end $$;

grant execute on function public.next_offer_number() to authenticated, service_role;
