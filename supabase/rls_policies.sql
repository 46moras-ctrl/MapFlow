-- ============================================================
-- MAPFLOW — Migración: RLS REAL (candado por empresa)
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- Es idempotente: ejecutarlo dos veces no rompe nada.
--
-- Qué hace:
--   1. Elimina las políticas temporales de desarrollo
--      ("dev_acceso_total", que permitían leer/escribir todo).
--   2. Activa RLS en las 5 tablas (por si alguna no lo tenía).
--   3. Crea políticas reales: cada usuario autenticado solo ve
--      y toca las filas de SU empresa. Un usuario sin sesión
--      (anon) no ve NADA, porque auth.uid() devuelve null.
--
-- Cadena de propiedad:
--   auth.uid() → empresas.id_usuario → empresas.id
--             → id_empresa en movimientos / facturas / presupuestos
--             → recordatorios vía id_factura → facturas.id_empresa
--   (recordatorios NO tiene id_empresa propia: hereda la de su factura)
-- ============================================================

-- ============================================================
-- PASO 1: Fuera las políticas de desarrollo
-- ============================================================
drop policy if exists "dev_acceso_total" on public.empresas;
drop policy if exists "dev_acceso_total" on public.movimientos;
drop policy if exists "dev_acceso_total" on public.facturas;
drop policy if exists "dev_acceso_total" on public.recordatorios;
drop policy if exists "dev_acceso_total" on public.presupuestos;

-- ============================================================
-- PASO 2: RLS activado en todo (ya lo estaba en el schema
-- original, pero lo repetimos: es inofensivo y explícito)
-- ============================================================
alter table public.empresas      enable row level security;
alter table public.movimientos   enable row level security;
alter table public.facturas      enable row level security;
alter table public.recordatorios enable row level security;
alter table public.presupuestos  enable row level security;

-- ============================================================
-- PASO 3: EMPRESAS — cada usuario solo ve y edita la suya
--
-- Ojo: NO hay política de INSERT ni DELETE a propósito:
--   - INSERT: la empresa la crea el trigger trg_crear_empresa
--     (security definer, corre como dueño de la tabla y no pasa
--     por RLS). Nadie debería crear empresas desde el cliente.
--   - DELETE: borrar la empresa arrasaría en cascada con todos
--     los movimientos y facturas. Eso jamás desde el navegador;
--     si algún día hace falta, será una función de servidor.
-- ============================================================
drop policy if exists "empresas_select_propia" on public.empresas;
create policy "empresas_select_propia" on public.empresas
  for select
  using (id_usuario = auth.uid());

drop policy if exists "empresas_update_propia" on public.empresas;
create policy "empresas_update_propia" on public.empresas
  for update
  using (id_usuario = auth.uid())
  with check (id_usuario = auth.uid());
  -- El with check impide "regalar" la empresa: no puedes
  -- actualizar la fila y dejarle un id_usuario distinto al tuyo.

-- ============================================================
-- PASO 4: MOVIMIENTOS — solo los de mi empresa
--
-- for all = SELECT + INSERT + UPDATE + DELETE en una sola política.
--   using      → filtra lo que puedo VER/tocar (select/update/delete)
--   with check → valida lo que ESCRIBO (insert/update): no puedo
--                insertar un movimiento con el id_empresa de otro.
-- ============================================================
drop policy if exists "movimientos_solo_mi_empresa" on public.movimientos;
create policy "movimientos_solo_mi_empresa" on public.movimientos
  for all
  using (
    id_empresa = (select id from public.empresas where id_usuario = auth.uid())
  )
  with check (
    id_empresa = (select id from public.empresas where id_usuario = auth.uid())
  );

-- ============================================================
-- PASO 5: FACTURAS — solo las de mi empresa
-- ============================================================
drop policy if exists "facturas_solo_mi_empresa" on public.facturas;
create policy "facturas_solo_mi_empresa" on public.facturas
  for all
  using (
    id_empresa = (select id from public.empresas where id_usuario = auth.uid())
  )
  with check (
    id_empresa = (select id from public.empresas where id_usuario = auth.uid())
  );

-- ============================================================
-- PASO 6: RECORDATORIOS — heredan la empresa de su factura
--
-- Esta tabla no tiene id_empresa, así que el candado pasa por
-- facturas: el recordatorio es mío si su factura es de mi
-- empresa. Vale tanto para leer como para escribir: no puedo
-- crear un recordatorio colgado de una factura ajena.
-- ============================================================
drop policy if exists "recordatorios_solo_mi_empresa" on public.recordatorios;
create policy "recordatorios_solo_mi_empresa" on public.recordatorios
  for all
  using (
    exists (
      select 1
      from public.facturas f
      where f.id = recordatorios.id_factura
        and f.id_empresa = (select id from public.empresas where id_usuario = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.facturas f
      where f.id = recordatorios.id_factura
        and f.id_empresa = (select id from public.empresas where id_usuario = auth.uid())
    )
  );

-- ============================================================
-- PASO 7: PRESUPUESTOS — solo los de mi empresa
-- ============================================================
drop policy if exists "presupuestos_solo_mi_empresa" on public.presupuestos;
create policy "presupuestos_solo_mi_empresa" on public.presupuestos
  for all
  using (
    id_empresa = (select id from public.empresas where id_usuario = auth.uid())
  )
  with check (
    id_empresa = (select id from public.empresas where id_usuario = auth.uid())
  );

-- ============================================================
-- VERIFICACIÓN: lista de políticas activas por tabla.
-- No debe aparecer ninguna "dev_acceso_total".
-- ============================================================
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
