-- ============================================================
-- MAPFLOW — Migración: Asistente + Ajustes de recordatorios
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- Es idempotente: ejecutarlo dos veces no rompe nada.
--
-- Qué agrega (verificado contra el esquema real):
--   1. empresas.email_dueno / telefono_dueno — dónde recibe el
--      DUEÑO sus recordatorios de pagos y alertas internas.
--   2. empresas.recordatorios_cobros_canal — canal general de
--      los recordatorios de COBROS a clientes (los cobros no
--      llevan switch on/off: siempre activos; solo se elige
--      por dónde salen).
--
-- Ya existían (migracion_agente_cobros.sql, aplicada):
--   datos_cobro, recordatorios_pagos_activo,
--   recordatorios_pagos_canal, tabla contactos, facturas.id_contacto.
-- ============================================================

-- 1. Contacto del DUEÑO para recibir sus propios recordatorios
alter table public.empresas
  add column if not exists email_dueno text;

alter table public.empresas
  add column if not exists telefono_dueno text;

-- 2. Canal general de recordatorios de COBROS (a clientes).
--    Es un control de toda la cuenta, no mensaje por mensaje.
alter table public.empresas
  add column if not exists recordatorios_cobros_canal text not null default 'ambos'
  check (recordatorios_cobros_canal in ('whatsapp', 'email', 'ambos'));

-- ===== VERIFICACIÓN: las 3 columnas nuevas presentes =====
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'empresas'
  and column_name in ('email_dueno', 'telefono_dueno', 'recordatorios_cobros_canal')
order by column_name;
