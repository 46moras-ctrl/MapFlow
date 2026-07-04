-- ============================================================
-- MAPFLOW — TODAS las migraciones pendientes en un solo archivo
-- Pegar completo en el SQL Editor de Supabase y presionar Run.
-- Es idempotente: ejecutarlo dos veces no rompe nada.
--
-- Incluye:
--   A. empresas.id_usuario (vincular empresa ↔ usuario de Auth)
--   B. Regla "un usuario, una empresa" + trigger de creación
--      automática de empresa al registrarse + backfill
--   C. facturas.concepto (campo del formulario Nueva Factura)
-- ============================================================

-- ===== A. Vincular empresas con usuarios =====
alter table public.empresas
  add column if not exists id_usuario uuid references auth.users(id) on delete set null;

create index if not exists idx_empresas_usuario
  on public.empresas (id_usuario);

-- ===== B1. Sanear duplicados previos (desvincula, no borra) =====
update public.empresas e
set id_usuario = null
where e.id_usuario is not null
  and exists (
    select 1
    from public.empresas d
    where d.id_usuario = e.id_usuario
      and (d.created_at < e.created_at
           or (d.created_at = e.created_at and d.id < e.id))
  );

-- ===== B2. Regla de oro: un usuario, máximo una empresa =====
do $$
begin
  alter table public.empresas
    add constraint empresas_usuario_unico unique (id_usuario);
exception
  when duplicate_object then null;  -- ya existía
  when duplicate_table then null;
end $$;

-- ===== B3. Trigger: al nacer un usuario, nace su empresa =====
create or replace function public.crear_empresa_para_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.empresas (nombre, id_usuario)
  values (
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nombre_negocio'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      'Mi negocio'
    ),
    new.id
  )
  on conflict (id_usuario) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_crear_empresa on auth.users;
create trigger trg_crear_empresa
  after insert on auth.users
  for each row execute function public.crear_empresa_para_usuario();

-- ===== B4. Backfill: usuarios existentes sin empresa =====
insert into public.empresas (nombre, id_usuario)
select
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'nombre_negocio'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    'Mi negocio'
  ),
  u.id
from auth.users u
left join public.empresas e on e.id_usuario = u.id
where e.id is null
on conflict (id_usuario) do nothing;

-- ===== C. Columna concepto en facturas =====
alter table public.facturas
  add column if not exists concepto text;

-- ===== VERIFICACIÓN =====
-- Fila 1: usuarios con más de una empresa (debe ser 0)
-- Fila 2: usuarios sin empresa (debe ser 0)
select
  (select count(*) from (
    select id_usuario from public.empresas
    where id_usuario is not null
    group by id_usuario having count(*) > 1
  ) x) as usuarios_con_empresa_duplicada,
  (select count(*) from auth.users u
   left join public.empresas e on e.id_usuario = u.id
   where e.id is null) as usuarios_sin_empresa;
