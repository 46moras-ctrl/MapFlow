-- ============================================================
-- MAPFLOW — Migración: Agente de Cobros y Pagos (v2)
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- Es idempotente: ejecutarlo dos veces no rompe nada.
--
-- Qué agrega (verificado contra el esquema real: NADA de esto
-- existía en schema.sql ni en las migraciones anteriores):
--   1. empresas.datos_cobro — cómo le pagan al dueño (jsonb).
--   2. empresas.recordatorios_pagos_activo + canal — config
--      on/off del ciclo de PAGOS (el de COBROS no lleva switch,
--      siempre está activo).
--   3. Tabla CONTACTOS — libreta de clientes/proveedores por
--      empresa, con teléfono y email. Cada contacto vive UNA
--      sola vez aunque tenga muchas facturas (anti-duplicación).
--   4. facturas.id_contacto — cada factura apunta a su contacto.
--   5. RLS en contactos con el mismo candado por empresa.
-- ============================================================

-- ============================================================
-- 1. EMPRESAS: datos de cobro configurables del dueño.
--    jsonb flexible para que cada empresa guarde lo suyo, ej.:
--    {
--      "banco":        "BAC",
--      "cuenta":       "123-456789-0",
--      "titular":      "Mi Negocio S.A.",
--      "qr_url":       "https://.../qr.png",
--      "link_pasarela":"https://pagos.ejemplo.com/mi-negocio"
--    }
--    El botón "Pagar" de los mensajes de cobro entrega esto.
-- ============================================================
alter table public.empresas
  add column if not exists datos_cobro jsonb not null default '{}'::jsonb;

-- ============================================================
-- 2. EMPRESAS: configuración de recordatorios de PAGOS.
--    - activo: switch on/off (por defecto ENCENDIDO; el dueño
--      lo apaga si no lo quiere).
--    - canal: por dónde prefiere recibirlos.
--    Los recordatorios de COBROS no llevan switch: siempre van.
-- ============================================================
alter table public.empresas
  add column if not exists recordatorios_pagos_activo boolean not null default true;

alter table public.empresas
  add column if not exists recordatorios_pagos_canal text not null default 'ambos'
  check (recordatorios_pagos_canal in ('whatsapp', 'email', 'ambos'));

-- ============================================================
-- 3. CONTACTOS: libreta de clientes y proveedores por empresa.
--    Un contacto se registra UNA vez y todas sus facturas lo
--    referencian: el teléfono no se repite factura por factura.
-- ============================================================
create table if not exists public.contactos (
  id          uuid primary key default gen_random_uuid(),
  id_empresa  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,
  telefono    text,                            -- WhatsApp / botón "Llamar"
  email       text,                            -- canal email
  tipo        text
              check (tipo in ('cliente', 'proveedor')),  -- opcional
  created_at  timestamptz not null default now()
);

-- REGLA ANTI-DUPLICACIÓN (dos candados, como la huella única):
--
-- a) El NOMBRE normalizado es único por empresa. Se usa
--    lower(trim(...)) para que "Ferretería López" y
--    " ferretería lópez " cuenten como el mismo contacto
--    (misma filosofía que generar_huella). El nombre es el
--    candado principal porque es el único campo obligatorio.
create unique index if not exists contactos_nombre_unico
  on public.contactos (id_empresa, lower(trim(nombre)));

-- b) El TELÉFONO también es único por empresa (solo cuando
--    existe: los contactos sin teléfono no chocan entre sí).
--    Evita el duplicado más peligroso en la práctica: el mismo
--    número registrado con dos nombres escritos distinto, que
--    provocaría recordatorios dobles por WhatsApp.
create unique index if not exists contactos_telefono_unico
  on public.contactos (id_empresa, telefono)
  where telefono is not null;

-- Búsqueda típica: "los contactos de mi empresa"
create index if not exists idx_contactos_empresa
  on public.contactos (id_empresa, nombre);

-- ============================================================
-- 4. FACTURAS: relación con su contacto.
--    on delete set null = si se borra el contacto, la factura
--    sobrevive (una app financiera no destruye historial).
--    Es opcional: las facturas viejas quedan sin contacto hasta
--    que el dueño las vincule.
-- ============================================================
alter table public.facturas
  add column if not exists id_contacto uuid
  references public.contactos(id) on delete set null;

create index if not exists idx_facturas_contacto
  on public.facturas (id_contacto);

-- Limpieza defensiva: si llegó a ejecutarse la versión anterior
-- de esta migración (teléfono/email directos en facturas), esas
-- columnas sobran — el contacto es ahora la única fuente.
alter table public.facturas drop column if exists telefono_contacto;
alter table public.facturas drop column if exists email_contacto;

-- ============================================================
-- 5. RLS EN CONTACTOS: el mismo candado por empresa del resto
--    del proyecto (ver rls_policies.sql).
--      using      → solo veo/toco contactos de MI empresa
--      with check → solo escribo contactos con MI id_empresa
-- ============================================================
alter table public.contactos enable row level security;

drop policy if exists "contactos_solo_mi_empresa" on public.contactos;
create policy "contactos_solo_mi_empresa" on public.contactos
  for all
  using (
    id_empresa = (select id from public.empresas where id_usuario = auth.uid())
  )
  with check (
    id_empresa = (select id from public.empresas where id_usuario = auth.uid())
  );

-- ===== VERIFICACIÓN =====
-- a) Columnas nuevas presentes
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'empresas' and column_name in
      ('datos_cobro', 'recordatorios_pagos_activo', 'recordatorios_pagos_canal'))
    or (table_name = 'facturas' and column_name = 'id_contacto')
    or table_name = 'contactos'
  )
order by table_name, column_name;

-- b) La política de contactos debe aparecer aquí
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'contactos';
