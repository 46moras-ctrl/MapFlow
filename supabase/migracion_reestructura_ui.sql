-- ============================================================
-- MAPFLOW — Migración: reestructura de navegación (5 pantallas)
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- Es idempotente: ejecutarla dos veces no rompe nada.
--
-- Qué agrega:
--   1. Tabla PLANES_PAGO — lo que guarda el cuadro modal de
--      cobro/pago (Facturas y Pendientes): cuotas, fechas,
--      contacto del deudor/acreedor y método de pago.
--   2. Columnas de EMPRESAS para Configuración: foto de perfil,
--      canales del bot, personas con acceso, colores de marca
--      y preferencias de notificaciones.
--   3. Tabla SESIONES_DISPOSITIVOS — dispositivos con la cuenta
--      abierta (sección Sesiones de Configuración).
-- ============================================================

-- ============================================================
-- 1. PLANES_PAGO: un plan de cobro (a deudor) o de pago
--    (a acreedor) por factura. Pantalla Pendientes lo lista;
--    el modal de Facturas/Pendientes lo crea o actualiza.
-- ============================================================
create table if not exists public.planes_pago (
  id                uuid primary key default gen_random_uuid(),
  id_empresa        uuid not null references public.empresas(id) on delete cascade,
  id_factura        uuid not null references public.facturas(id) on delete cascade,
  tipo              text not null
                    check (tipo in ('cobro', 'pago')),
  cuotas            integer not null default 1
                    check (cuotas between 1 and 48),
  fechas_pago       jsonb not null default '[]'::jsonb,   -- ["2026-07-15", ...]
  -- Contacto del deudor (cobro) o del acreedor (pago), para los
  -- mensajes del bot. Si coincide con la libreta, la app también
  -- lo vincula allí; estos campos guardan lo escrito en el modal.
  contacto_nombre   text,
  contacto_telefono text,
  contacto_email    text,
  -- Solo planes de PAGO:
  metodo_pago       text
                    check (metodo_pago is null or metodo_pago in ('transferencia', 'tarjeta', 'efectivo', 'otro')),
  detalle_metodo    text,                                 -- banco, nº de cuenta, link…
  destino_envio     text not null default 'contacto'
                    check (destino_envio in ('empresa', 'contacto')),
  estado            text not null default 'activo'
                    check (estado in ('activo', 'completado', 'cancelado')),
  created_at        timestamptz not null default now(),

  -- Un solo plan por factura: si se vuelve a abrir el modal,
  -- se actualiza el existente (upsert), no se duplica.
  constraint planes_pago_uno_por_factura unique (id_factura)
);

create index if not exists idx_planes_pago_listado
  on public.planes_pago (id_empresa, tipo, estado, created_at);

alter table public.planes_pago enable row level security;

drop policy if exists "planes_pago_solo_mi_empresa" on public.planes_pago;
create policy "planes_pago_solo_mi_empresa" on public.planes_pago
  for all
  using (
    id_empresa = (select id from public.empresas where id_usuario = auth.uid())
  )
  with check (
    id_empresa = (select id from public.empresas where id_usuario = auth.uid())
  );

-- ============================================================
-- 2. EMPRESAS: campos de la pantalla Configuración.
--    - foto_url: imagen de perfil (data-URL redimensionada o URL).
--    - canales_bot:   [{"tipo":"gmail","valor":"...","estado":"activo"}]
--    - personas_bot:  [{"nombre":"...","correo":"...","numero":"..."}]
--    - colores_marca: {"primario":"#4E6544","secundario":"#42682F","acento":"#7B5264"}
--    - notificaciones: {"alertas_empresa":{...},"alertas_cobros":{...},"generales":{...}}
-- ============================================================
alter table public.empresas
  add column if not exists foto_url text,
  add column if not exists canales_bot jsonb not null default '[]'::jsonb,
  add column if not exists personas_bot jsonb not null default '[]'::jsonb,
  add column if not exists colores_marca jsonb not null default
    '{"primario":"#4E6544","secundario":"#42682F","acento":"#7B5264"}'::jsonb,
  add column if not exists notificaciones jsonb not null default '{}'::jsonb;

-- ============================================================
-- 3. SESIONES_DISPOSITIVOS: dónde está abierta la cuenta.
--    La app registra la sesión al entrar (huella = user agent
--    resumido) y la sección Sesiones la lista y administra.
--    RLS por usuario: cada quien ve SOLO sus dispositivos.
-- ============================================================
create table if not exists public.sesiones_dispositivos (
  id                uuid primary key default gen_random_uuid(),
  id_usuario        uuid not null,                        -- auth.users.id
  huella            text not null,                        -- identifica el dispositivo
  dispositivo       text not null,                        -- "Mac · Chrome"
  lugar             text,                                 -- "Bogotá, Colombia" (aprox.)
  ultima_actividad  timestamptz not null default now(),
  estado            text not null default 'activa'
                    check (estado in ('activa', 'cerrada', 'reportada')),
  confirmada        boolean not null default false,       -- "¿Fuiste tú?" respondido
  created_at        timestamptz not null default now(),

  constraint sesiones_una_por_dispositivo unique (id_usuario, huella)
);

alter table public.sesiones_dispositivos enable row level security;

drop policy if exists "sesiones_solo_mias" on public.sesiones_dispositivos;
create policy "sesiones_solo_mias" on public.sesiones_dispositivos
  for all
  using (id_usuario = auth.uid())
  with check (id_usuario = auth.uid());

-- ===== VERIFICACIÓN =====
select table_name, count(*) as columnas
from information_schema.columns
where table_schema = 'public'
  and table_name in ('planes_pago', 'sesiones_dispositivos')
group by table_name;

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'empresas'
  and column_name in ('foto_url', 'canales_bot', 'personas_bot', 'colores_marca', 'notificaciones');
