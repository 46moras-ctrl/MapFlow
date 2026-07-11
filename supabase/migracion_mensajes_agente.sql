-- ============================================================
-- MAPFLOW — Migración: Registro del agente de cobros
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- ⚠️ Recrea la tabla mensajes_agente desde cero (borra la
-- versión vieja, que estaba vacía). NO volver a ejecutarla
-- cuando el agente ya tenga historial guardado.
--
-- Qué agrega:
--   0. Columnas de EMPRESAS que usa el agente: telegram_chat_id,
--      email_dueno y telefono_dueno (datos_cobro ya existía).
--   1. Tabla MENSAJES_AGENTE — registro/historial (log) de lo
--      que hace el agente de cobros: consultas que respondió,
--      recordatorios a deudores y alertas al dueño. NO es una
--      bandeja de aprobación: los mensajes ya salieron
--      automáticamente; esta tabla deja constancia y evita
--      que el mismo mensaje salga dos veces.
--   2. Anti-duplicación por huella única (regla de oro #1).
--   3. RLS con el mismo candado por empresa del resto del
--      proyecto (ver rls_policies.sql).
-- ============================================================

-- ============================================================
-- 0. EMPRESAS: columnas que el agente necesita y que ninguna
--    migración anterior creó (verificado contra la base el
--    2026-07-08: datos_cobro ya existía; estas tres no).
--      telegram_chat_id → vincula el chat de Telegram del dueño
--                         con SU empresa (aislamiento).
--      email_dueno / telefono_dueno → a dónde llegan las
--                         alertas de morosos.
-- ============================================================
alter table public.empresas
  add column if not exists telegram_chat_id text,
  add column if not exists email_dueno text,
  add column if not exists telefono_dueno text;

-- Un chat de Telegram solo puede pertenecer a UNA empresa
-- (si dos empresas compartieran chat, se rompería el aislamiento).
create unique index if not exists idx_empresas_telegram_chat_id
  on public.empresas (telegram_chat_id)
  where telegram_chat_id is not null;

-- ============================================================
-- 1. MENSAJES_AGENTE: cada fila es una acción ya ejecutada.
--    Las FKs a factura y contacto son opcionales y con
--    on delete set null: si se borra la factura o el contacto,
--    el registro sobrevive (una app financiera no destruye
--    historial).
--
--    NOTA: en esta base ya existía una tabla mensajes_agente
--    de un intento anterior, con otra estructura (sin
--    tipo_accion) y VERIFICADA VACÍA (0 filas el 2026-07-08).
--    Por eso se elimina y se recrea con la estructura correcta.
--    Si alguna vez esta tabla tuviera datos, NO ejecutar el
--    drop a ciegas: primero respaldar.
-- ============================================================
drop table if exists public.mensajes_agente cascade;

create table public.mensajes_agente (
  id                uuid primary key default gen_random_uuid(),
  id_empresa        uuid not null references public.empresas(id) on delete cascade,
  id_factura        uuid references public.facturas(id) on delete set null,
  id_contacto       uuid references public.contactos(id) on delete set null,
  tipo_accion       text not null
                    check (tipo_accion in ('consulta_interna', 'recordatorio_deudor', 'alerta_dueno')),
  canal             text not null
                    check (canal in ('email', 'telegram', 'chat_plataforma', 'whatsapp')),
  direccion         text not null
                    check (direccion in ('entrante', 'saliente')),
  mensaje_entrante  text,                      -- lo que preguntó el usuario/cliente, si aplica
  mensaje_generado  text,                      -- lo que redactó Gemini y se envió
  destinatario      text,                      -- correo o teléfono al que se envió
  estado_envio      text not null default 'enviado'
                    check (estado_envio in ('enviado', 'fallido')),
  huella_unica      text not null,             -- anti-duplicación (regla de oro #1)
  created_at        timestamptz not null default now(),

  -- REGLA ANTI-DUPLICACIÓN: la misma huella no puede repetirse
  -- dentro de la misma empresa. Postgres rechaza el duplicado
  -- aunque el código de la app falle (mismo patrón que
  -- movimientos_sin_duplicados).
  constraint mensajes_agente_sin_duplicados unique (id_empresa, huella_unica)
);

-- Consulta típica: "el historial del agente, por tipo de acción,
-- del más reciente al más viejo"
create index if not exists idx_mensajes_agente_historial
  on public.mensajes_agente (id_empresa, tipo_accion, created_at);

-- ============================================================
-- 2. RLS: el mismo candado por empresa del resto del proyecto.
--      using      → solo veo/toco registros de MI empresa
--      with check → solo escribo registros con MI id_empresa
-- ============================================================
alter table public.mensajes_agente enable row level security;

drop policy if exists "mensajes_agente_solo_mi_empresa" on public.mensajes_agente;
create policy "mensajes_agente_solo_mi_empresa" on public.mensajes_agente
  for all
  using (
    id_empresa = (select id from public.empresas where id_usuario = auth.uid())
  )
  with check (
    id_empresa = (select id from public.empresas where id_usuario = auth.uid())
  );

-- ===== VERIFICACIÓN =====
-- a) Estructura de la tabla nueva
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'mensajes_agente'
order by ordinal_position;

-- b) La política debe aparecer aquí
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'mensajes_agente';
