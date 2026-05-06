-- offers.pricing_override — opcjonalne ręczne nadpisanie wartości pricingu.
--
-- Format JSON:
--   {
--     "variants": {
--       "I":   { "base": 12000, "sfPct": 0.04, "monthly": 5000, "payment": [{"pct":50,"when":"podpisanie"},{"pct":50,"when":"finalizacja"}] },
--       "II":  { "base": 15000 },
--       "III": null  // null = use snapshot value
--     },
--     "execFee": { "monthly": 6000, "kicker": "Custom kicker text", "title": "...", "desc": "..." }
--   }
--
-- Logika: lib/pricing/applyOverride.ts merguje snapshot + override przed renderem.
-- Override zostaje zachowany przy save'ach — auto-calc go nie nadpisuje (tryb 'manual').
-- Toggle "Auto-calc" w UI czyści override przed save'em.
--
-- Pole jest opcjonalne (DEFAULT '{}') — istniejące oferty nadal działają
-- bezpiecznie (applyOverride zwraca snapshot bez zmian gdy override jest pusty).

alter table offers
  add column if not exists pricing_override jsonb not null default '{}'::jsonb;
