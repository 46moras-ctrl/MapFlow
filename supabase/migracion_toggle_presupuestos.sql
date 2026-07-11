-- ============================================================
-- MAPFLOW — Migración: toggle del módulo de Presupuestos
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- Es idempotente: ejecutarla dos veces no rompe nada.
--
-- Agrega empresas.mostrar_presupuestos (boolean, default false):
-- cuando está apagado, el módulo de presupuestos se oculta en
-- toda la plataforma (menú, Reportes y la ruta /presupuestos)
-- sin borrar ningún dato ni código.
-- ============================================================

alter table public.empresas
  add column if not exists mostrar_presupuestos boolean not null default false;

-- ===== VERIFICACIÓN =====
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'empresas'
  and column_name = 'mostrar_presupuestos';
