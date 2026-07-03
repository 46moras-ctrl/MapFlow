-- ============================================================
-- MAPFLOW — Prueba de la regla anti-duplicación en facturas
-- Pegar completo en el SQL Editor de Supabase y presionar Run.
-- Se puede ejecutar varias veces: se limpia sola al inicio.
-- ============================================================

-- Limpieza previa: borra la empresa demo si ya existía
-- (el ON DELETE CASCADE elimina también sus facturas)
delete from public.empresas
where id = '00000000-0000-0000-0000-000000000001';

-- ------------------------------------------------------------
-- PASO 1: Insertar una empresa de ejemplo
-- ------------------------------------------------------------
insert into public.empresas (id, nombre, tipo_negocio, plan)
values (
  '00000000-0000-0000-0000-000000000001',
  'Panadería La Espiga (DEMO)',
  'panadería',
  'gratis'
);

-- ------------------------------------------------------------
-- PASO 2: Insertar una factura
-- ------------------------------------------------------------
insert into public.facturas
  (id_empresa, numero_factura, cliente, monto, fecha_emision, fecha_vencimiento)
values (
  '00000000-0000-0000-0000-000000000001',
  'F-0001',
  'Cafetería El Portal',
  4500.00,
  current_date,
  current_date + 30
);

-- ------------------------------------------------------------
-- PASO 3: Intentar insertar la MISMA factura otra vez
-- (misma empresa + mismo numero_factura)
--
-- Si la constraint funciona, Postgres lanza el error
-- "unique_violation" (código 23505), lo atrapamos y la prueba
-- continúa. Si el duplicado llegara a guardarse, forzamos un
-- error rojo con el mensaje "PRUEBA FALLIDA".
-- ------------------------------------------------------------
do $$
begin
  insert into public.facturas (id_empresa, numero_factura, cliente, monto)
  values (
    '00000000-0000-0000-0000-000000000001',
    'F-0001',
    'Cafetería El Portal',
    4500.00
  );

  -- Si llegamos aquí, el duplicado SÍ se insertó: eso es un bug
  raise exception 'PRUEBA FALLIDA: el duplicado NO fue rechazado';

exception
  when unique_violation then
    -- Esto es lo que queremos: la base de datos rechazó el duplicado
    raise notice 'Duplicado rechazado correctamente por la constraint';
end $$;

-- ------------------------------------------------------------
-- VEREDICTO: si ves esta tabla de resultados, la prueba pasó.
-- Debe haber exactamente 1 factura (no 2).
-- ------------------------------------------------------------
select
  'PRUEBA SUPERADA ✅ — el duplicado fue rechazado' as resultado,
  count(*) as facturas_registradas,
  min(numero_factura) as numero_factura,
  min(huella_unica) as huella_generada_por_trigger
from public.facturas
where id_empresa = '00000000-0000-0000-0000-000000000001';
