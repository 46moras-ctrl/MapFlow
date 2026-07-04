-- ============================================================
-- MAPFLOW — Migración: Cuentas por Pagar, medios de pago,
-- recurrencia y enlace de deudas de crédito.
-- Pegar completo en el SQL Editor de Supabase y presionar Run.
-- Es idempotente: ejecutarlo dos veces no rompe nada.
-- ============================================================

-- 1. Tipo de factura: 'cobrar' (a clientes) o 'pagar' (a proveedores,
--    renta, servicios, créditos...). Lo existente queda como 'cobrar'.
alter table public.facturas
  add column if not exists tipo text not null default 'cobrar'
  check (tipo in ('cobrar', 'pagar'));

-- 2. Medios de pago:
--    medio_pago_previsto = cómo SE DEBE pagar (al registrar una cuenta por pagar)
--    medio_pago          = cómo SE PAGÓ/COBRÓ realmente (al marcar pagada)
alter table public.facturas
  add column if not exists medio_pago_previsto text
  check (medio_pago_previsto in ('transferencia', 'tarjeta', 'efectivo', 'credito'));

alter table public.facturas
  add column if not exists medio_pago text
  check (medio_pago in ('transferencia', 'tarjeta', 'efectivo', 'credito'));

-- 3. Recurrencia (renta, nómina, servicios: "el día N de cada mes").
--    Al pagar una factura recurrente, la app genera la del mes siguiente.
alter table public.facturas
  add column if not exists es_recurrente boolean not null default false;

alter table public.facturas
  add column if not exists dia_recurrencia int
  check (dia_recurrencia between 1 and 31);

-- 4. Enlace de deudas: cuando algo se paga con CRÉDITO, la nueva deuda
--    de la tarjeta apunta a la factura original que la generó.
alter table public.facturas
  add column if not exists id_factura_origen uuid
  references public.facturas(id) on delete set null;

create index if not exists idx_facturas_origen
  on public.facturas (id_factura_origen);

create index if not exists idx_facturas_tipo
  on public.facturas (id_empresa, tipo, estado);

-- 5. REGLA ANTI-DUPLICACIÓN actualizada: el número de factura es único
--    por empresa Y POR TIPO. Motivo: tu factura emitida "FAC-001" y una
--    factura recibida de un proveedor "FAC-001" son documentos distintos
--    y ambos deben poder existir; pero dos "FAC-001" del mismo tipo en
--    la misma empresa siguen siendo un duplicado y se rechazan.
alter table public.facturas
  drop constraint if exists facturas_sin_duplicados;

alter table public.facturas
  add constraint facturas_sin_duplicados unique (id_empresa, tipo, numero_factura);

-- ===== VERIFICACIÓN: estructura final de la tabla =====
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'facturas'
order by ordinal_position;
