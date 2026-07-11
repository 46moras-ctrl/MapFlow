-- ============================================================
-- MAPFLOW — Migración: importación de facturas (Google Sheets)
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
--
-- Agrega empresas.hoja_calculo (jsonb): la conexión con la hoja
-- de Google Sheets del usuario para traer facturas en vivo:
--   { "url": "...", "mapeo": {campo: columna}, "ultima_sync": "..." }
-- ============================================================

alter table public.empresas
  add column if not exists hoja_calculo jsonb;

-- ===== VERIFICACIÓN =====
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'empresas'
  and column_name = 'hoja_calculo';
