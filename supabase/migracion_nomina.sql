-- ============================================================
-- MAPFLOW — Migración: NÓMINA + COMISIONES + PAÍS/MONEDA
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
--
-- 1) empresas.pais / empresas.moneda: la moneda elegida formatea
--    TODOS los montos de la plataforma (no convierte, solo formatea).
-- 2) empresas.config_nomina (jsonb): frecuencia y días de pago
--    del sueldo, una sola configuración para toda la empresa:
--      { "frecuencia": "semanal|quincenal|mensual", "dias": [n...] }
--      · semanal: días de la semana (0=Domingo … 6=Sábado)
--      · quincenal/mensual: días del mes (1 a 31)
-- 3) empresas.config_comisiones (jsonb): quién comisiona y CÓMO.
--    Las modalidades son EXCLUYENTES (una empresa maneja una sola):
--      { "modalidad": "venta|metas",
--        "tipo_venta": "directa|escalonada",
--        "roles": [{ "cargo": "Vendedor", "porcentaje": 5 }],
--        "tramos": [{ "desde": 0, "porcentaje": 5 },
--                   { "desde": 500000, "porcentaje": 10 }],
--        "metas": [{ "tipo": "monto|cantidad", "valor": 1000000,
--                    "bonificacion": 50000, "periodo": "semanal|quincenal|mensual" }] }
--    Si está vacío, nada de comisiones aparece en la plataforma.
-- 4) Tabla empleados: la nómina de la empresa.
-- 5) Facturas: vendedor asignado + % de comisión CONGELADO al
--    momento de la venta (cambios futuros del % no tocan el
--    historial) + marca de liquidada.
-- 6) Tabla liquidaciones_comision: historial de pagos de comisión.
-- ============================================================

-- ===== 1-3 · EMPRESAS =====
-- config_comisiones_pendiente: cambio de método programado para el
-- próximo cierre de nómina (requiere confirmación del usuario):
--   { "config": {…igual a config_comisiones…}, "aplica_el": "2026-07-31",
--     "confirmado": false, "aviso_enviado": false, "solicitado_el": "…" }
alter table public.empresas
  add column if not exists pais text,
  add column if not exists moneda text,
  add column if not exists config_nomina jsonb,
  add column if not exists config_comisiones jsonb,
  add column if not exists config_comisiones_pendiente jsonb;

-- ===== 4 · EMPLEADOS =====
create table if not exists public.empleados (
  id               uuid primary key default gen_random_uuid(),
  id_empresa       uuid not null references public.empresas(id) on delete cascade,
  nombre           text not null,
  documento        text,
  telefono         text,
  direccion        text,
  cargo            text not null,
  tipo_contrato    text not null default 'indefinido'
                   check (tipo_contrato in ('indefinido', 'fijo', 'prestacion', 'otro')),
  fecha_ingreso    date,
  salario_mensual  numeric(14,2) not null default 0 check (salario_mensual >= 0),
  fecha_nacimiento date,
  email            text,
  -- Contacto de emergencia del empleado
  emergencia_nombre   text,
  emergencia_telefono text,
  -- Desactivar en vez de borrar conserva el historial de comisiones
  activo           boolean not null default true,
  created_at       timestamptz not null default now()
);

-- Para quien ya corrió una versión anterior de esta migración:
-- estos campos se agregan sin tocar los datos existentes.
alter table public.empleados
  add column if not exists fecha_nacimiento date,
  add column if not exists email text,
  add column if not exists emergencia_nombre text,
  add column if not exists emergencia_telefono text;

create index if not exists idx_empleados_empresa
  on public.empleados (id_empresa, activo);

-- ===== 6 · LIQUIDACIONES DE COMISIÓN (historial) =====
create table if not exists public.liquidaciones_comision (
  id                 uuid primary key default gen_random_uuid(),
  id_empresa         uuid not null references public.empresas(id) on delete cascade,
  id_empleado        uuid not null references public.empleados(id) on delete cascade,
  desde              date,
  hasta              date,
  num_facturas       int not null default 0,
  total_comision     numeric(14,2) not null default 0,
  total_bonificacion numeric(14,2) not null default 0,
  -- Snapshot legible de lo que se pagó (facturas y metas cumplidas)
  detalle            jsonb,
  registrado_egreso  boolean not null default false,
  created_at         timestamptz not null default now()
);

create index if not exists idx_liquidaciones_empleado
  on public.liquidaciones_comision (id_empresa, id_empleado, created_at desc);

-- ===== 5 · FACTURAS: vendedor + comisión congelada =====
alter table public.facturas
  add column if not exists id_vendedor uuid references public.empleados(id) on delete set null,
  add column if not exists comision_porcentaje numeric(5,2),
  add column if not exists comision_liquidada boolean not null default false,
  add column if not exists id_liquidacion uuid references public.liquidaciones_comision(id) on delete set null;

-- "Comisiones pendientes de un vendedor" es la consulta caliente
create index if not exists idx_facturas_vendedor
  on public.facturas (id_empresa, id_vendedor)
  where id_vendedor is not null;

-- ===== SEGURIDAD (RLS) — mismas políticas dev del resto =====
alter table public.empleados enable row level security;
alter table public.liquidaciones_comision enable row level security;

drop policy if exists "dev_acceso_total" on public.empleados;
create policy "dev_acceso_total" on public.empleados
  for all using (true) with check (true);
drop policy if exists "dev_acceso_total" on public.liquidaciones_comision;
create policy "dev_acceso_total" on public.liquidaciones_comision
  for all using (true) with check (true);

-- ===== VERIFICACIÓN =====
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'empresas' and column_name in ('pais', 'moneda', 'config_nomina', 'config_comisiones'))
    or (table_name = 'facturas' and column_name in ('id_vendedor', 'comision_porcentaje', 'comision_liquidada', 'id_liquidacion'))
    or table_name in ('empleados', 'liquidaciones_comision')
  )
order by table_name, column_name;
