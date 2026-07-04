-- ============================================================
-- MAPFLOW — Migración: vincular empresas con usuarios (Auth)
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- ============================================================

-- Cada empresa pertenece a un usuario de Supabase Auth.
-- Si el usuario se elimina, la empresa queda huérfana (no se borra).
alter table public.empresas
  add column if not exists id_usuario uuid references auth.users(id) on delete set null;

-- Búsqueda rápida "la empresa de este usuario"
create index if not exists idx_empresas_usuario
  on public.empresas (id_usuario);
