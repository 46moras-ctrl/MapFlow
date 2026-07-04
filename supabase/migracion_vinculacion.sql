-- ============================================================
-- MAPFLOW — Migración: vinculación de cuentas y empresa única
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
--
-- Garantiza que:
--   1. Un usuario tenga COMO MÁXIMO una empresa (constraint UNIQUE)
--   2. La empresa se cree automáticamente al registrarse el usuario
--      (trigger en auth.users), sin importar si entró por email
--      o por Google — y nunca dos veces.
-- ============================================================

-- ------------------------------------------------------------
-- PASO 0: Saneamiento. Si por el flujo anterior quedaron dos
-- empresas apuntando al mismo usuario, se DESVINCULA la más
-- reciente (id_usuario = null). No se borra nada: una app
-- financiera no destruye datos, los deja para revisión manual.
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- PASO 1: Regla de oro — un usuario, una empresa.
-- (Las empresas sin usuario, id_usuario NULL, no chocan entre sí)
-- ------------------------------------------------------------
alter table public.empresas
  add constraint empresas_usuario_unico unique (id_usuario);

-- ------------------------------------------------------------
-- PASO 2: Crear la empresa automáticamente cuando nace un
-- usuario en auth.users. El nombre sale de los metadatos del
-- registro (nombre_negocio); si entró con Google, de su nombre
-- de perfil; si no hay nada, "Mi negocio".
--
-- ON CONFLICT DO NOTHING = si la empresa ya existe, no pasa
-- nada. Imposible duplicar, incluso con condiciones de carrera.
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- PASO 3: Backfill — usuarios ya existentes que aún no tengan
-- empresa reciben la suya (misma lógica de nombre).
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- VERIFICACIÓN: debe devolver 0 filas (ningún usuario con más
-- de una empresa).
-- ------------------------------------------------------------
select id_usuario, count(*) as empresas
from public.empresas
where id_usuario is not null
group by id_usuario
having count(*) > 1;
