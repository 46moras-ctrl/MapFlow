-- ============================================================
-- MAPFLOW — Migración: columna "concepto" en facturas
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- El formulario de Nueva Factura guarda una descripción del
-- trabajo facturado; la tabla original no tenía esta columna.
-- ============================================================

alter table public.facturas
  add column if not exists concepto text;
