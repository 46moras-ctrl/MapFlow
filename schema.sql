-- ============================================================
-- MAPFLOW — Esquema de base de datos
-- Pegar completo en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- Extensión para generar UUIDs (ya viene activa en Supabase,
-- pero lo dejamos explícito por si acaso)
create extension if not exists pgcrypto;

-- ============================================================
-- 1. EMPRESAS — cada negocio que usa MapFlow
-- ============================================================
create table public.empresas (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  tipo_negocio  text,                                -- ej: restaurante, ferretería, servicios
  plan          text not null default 'gratis'
                check (plan in ('gratis', 'pro', 'premium')),
  created_at    timestamptz not null default now()
);

-- ============================================================
-- 2. MOVIMIENTOS — el corazón: todo dinero que entra o sale
-- ============================================================
create table public.movimientos (
  id            uuid primary key default gen_random_uuid(),
  id_empresa    uuid not null references public.empresas(id) on delete cascade,
  tipo          text not null
                check (tipo in ('ingreso', 'egreso', 'factura_por_cobrar', 'pago')),
  monto         numeric(14,2) not null check (monto >= 0),
  descripcion   text,
  fecha         date not null default current_date,
  categoria     text,
  canal_origen  text not null default 'web'
                check (canal_origen in ('web', 'whatsapp', 'csv', 'sistema')),
  contraparte   text,                                -- cliente o proveedor
  referencia    text,                                -- referencia bancaria o folio externo
  huella_unica  text not null,                       -- la calcula el trigger si no se envía
  estado        text not null default 'pendiente'
                check (estado in ('pendiente', 'pagado', 'vencido')),
  created_at    timestamptz not null default now(),

  -- REGLA ANTI-DUPLICACIÓN: la misma huella no puede repetirse
  -- dentro de la misma empresa. Postgres rechaza el duplicado
  -- aunque el código de la app falle.
  constraint movimientos_sin_duplicados unique (id_empresa, huella_unica)
);

-- ============================================================
-- 3. FACTURAS — cuentas por cobrar formales
-- ============================================================
create table public.facturas (
  id                uuid primary key default gen_random_uuid(),
  id_empresa        uuid not null references public.empresas(id) on delete cascade,
  numero_factura    text not null,
  cliente           text not null,
  monto             numeric(14,2) not null check (monto >= 0),
  fecha_emision     date not null default current_date,
  fecha_vencimiento date,
  estado            text not null default 'pendiente'
                    check (estado in ('pendiente', 'pagado', 'vencido')),
  huella_unica      text,                            -- la calcula el trigger
  created_at        timestamptz not null default now(),

  -- REGLA ANTI-DUPLICACIÓN: no puede haber dos facturas con el
  -- mismo número en la misma empresa.
  constraint facturas_sin_duplicados unique (id_empresa, numero_factura)
);

-- ============================================================
-- 4. RECORDATORIOS — los "toques" de cobranza de cada factura
-- ============================================================
create table public.recordatorios (
  id               uuid primary key default gen_random_uuid(),
  id_factura       uuid not null references public.facturas(id) on delete cascade,
  canal            text not null default 'whatsapp'
                   check (canal in ('whatsapp', 'email', 'sms')),
  fecha_programada timestamptz not null,
  estado           text not null default 'pendiente'
                   check (estado in ('pendiente', 'enviado', 'cancelado')),
  tono             text not null default 'amistoso'
                   check (tono in ('amistoso', 'neutral', 'firme')),
  created_at       timestamptz not null default now()
);

-- ============================================================
-- 5. PRESUPUESTOS — topes de gasto por categoría
-- ============================================================
create table public.presupuestos (
  id                uuid primary key default gen_random_uuid(),
  id_empresa        uuid not null references public.empresas(id) on delete cascade,
  categoria         text not null,
  monto_tope        numeric(14,2) not null check (monto_tope > 0),
  periodo           text not null default 'mensual'
                    check (periodo in ('semanal', 'mensual', 'trimestral', 'anual')),
  alerta_porcentaje int not null default 80
                    check (alerta_porcentaje between 1 and 100),
  created_at        timestamptz not null default now(),

  -- Evita dos presupuestos para la misma categoría y periodo
  constraint presupuestos_unicos unique (id_empresa, categoria, periodo)
);

-- ============================================================
-- HUELLA ÚNICA — función que aplica la jerarquía:
--   1) referencia bancaria si existe
--   2) si no, número de factura
--   3) si no, hash de (fecha + monto + descripción + contraparte)
-- Normaliza a minúsculas y sin espacios sobrantes para que
-- "REF-001" y " ref-001 " generen la misma huella.
-- ============================================================
create or replace function public.generar_huella(
  p_referencia     text,
  p_numero_factura text,
  p_fecha          date,
  p_monto          numeric,
  p_descripcion    text,
  p_contraparte    text
) returns text
language sql
immutable
as $$
  select case
    -- Nivel 1: referencia bancaria
    when nullif(trim(p_referencia), '') is not null
      then 'ref:' || lower(trim(p_referencia))
    -- Nivel 2: número de factura
    when nullif(trim(p_numero_factura), '') is not null
      then 'fac:' || lower(trim(p_numero_factura))
    -- Nivel 3: hash de los datos del movimiento
    else 'hash:' || md5(
      coalesce(p_fecha::text, '') || '|' ||
      coalesce(p_monto::text, '') || '|' ||
      lower(coalesce(trim(p_descripcion), '')) || '|' ||
      lower(coalesce(trim(p_contraparte), ''))
    )
  end;
$$;

-- ------------------------------------------------------------
-- Trigger en MOVIMIENTOS: si el insert no trae huella_unica,
-- se calcula sola antes de guardar. En movimientos el número
-- de factura viaja en el campo "referencia".
-- ------------------------------------------------------------
create or replace function public.movimientos_asignar_huella()
returns trigger
language plpgsql
as $$
begin
  if nullif(trim(coalesce(new.huella_unica, '')), '') is null then
    new.huella_unica := public.generar_huella(
      new.referencia, null, new.fecha, new.monto, new.descripcion, new.contraparte
    );
  end if;
  return new;
end;
$$;

create trigger trg_movimientos_huella
  before insert on public.movimientos
  for each row execute function public.movimientos_asignar_huella();

-- ------------------------------------------------------------
-- Trigger en FACTURAS: la huella sale del número de factura
-- ------------------------------------------------------------
create or replace function public.facturas_asignar_huella()
returns trigger
language plpgsql
as $$
begin
  if nullif(trim(coalesce(new.huella_unica, '')), '') is null then
    new.huella_unica := public.generar_huella(
      null, new.numero_factura, new.fecha_emision, new.monto, null, new.cliente
    );
  end if;
  return new;
end;
$$;

create trigger trg_facturas_huella
  before insert on public.facturas
  for each row execute function public.facturas_asignar_huella();

-- ============================================================
-- ÍNDICES — para que las consultas típicas vuelen
-- ============================================================
-- "Movimientos de mi empresa, del más reciente al más viejo"
create index idx_movimientos_empresa_fecha
  on public.movimientos (id_empresa, fecha desc);

-- "¿Qué tengo pendiente o vencido?"
create index idx_movimientos_empresa_estado
  on public.movimientos (id_empresa, estado);

-- "Facturas sin pagar ordenadas por vencimiento"
create index idx_facturas_por_vencer
  on public.facturas (id_empresa, fecha_vencimiento)
  where estado <> 'pagado';

-- "Recordatorios que toca enviar hoy"
create index idx_recordatorios_pendientes
  on public.recordatorios (fecha_programada)
  where estado = 'pendiente';

-- ============================================================
-- SEGURIDAD (RLS) — Row Level Security activado en todo
-- ============================================================
alter table public.empresas      enable row level security;
alter table public.movimientos   enable row level security;
alter table public.facturas      enable row level security;
alter table public.recordatorios enable row level security;
alter table public.presupuestos  enable row level security;

-- ⚠️ POLÍTICAS TEMPORALES DE DESARROLLO ⚠️
-- Permiten leer y escribir todo con la key pública para que
-- puedas probar la app YA. Antes de salir a producción hay que
-- reemplazarlas por políticas que filtren por el usuario
-- autenticado y su empresa.
create policy "dev_acceso_total" on public.empresas
  for all using (true) with check (true);
create policy "dev_acceso_total" on public.movimientos
  for all using (true) with check (true);
create policy "dev_acceso_total" on public.facturas
  for all using (true) with check (true);
create policy "dev_acceso_total" on public.recordatorios
  for all using (true) with check (true);
create policy "dev_acceso_total" on public.presupuestos
  for all using (true) with check (true);
