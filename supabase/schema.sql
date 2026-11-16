-- =====================================================================
-- Seguimiento de L - Esquema para Supabase
-- Ejecutar completo en: Supabase > SQL Editor > New query > Run
-- =====================================================================

-- 1) Tabla única de registros (tomas, pañales, medidas, episodios, etc.)
create table if not exists public.registros (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null,                 -- toma, panal, medida, saturacion, episodio, sueno, temperatura, medicamento, nota
  fecha       timestamptz not null,          -- cuándo ocurrió
  datos       jsonb not null default '{}'::jsonb,
  nota        text,
  fotos       text[] not null default '{}',  -- URLs de fotos
  creado_por  uuid default auth.uid(),
  creado_en   timestamptz not null default now()
);
create index if not exists registros_fecha_idx on public.registros (fecha desc);
create index if not exists registros_tipo_idx  on public.registros (tipo);

-- 2) Enlaces de solo lectura para la doctora
create table if not exists public.enlaces (
  token      text primary key,
  nombre     text not null,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

-- 3) Permisos y seguridad: solo usuarios con sesión (ustedes dos) leen/escriben
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.registros to authenticated;
grant select, insert, update, delete on public.enlaces   to authenticated;

alter table public.registros enable row level security;
alter table public.enlaces   enable row level security;

drop policy if exists "padres_registros" on public.registros;
create policy "padres_registros" on public.registros
  for all to authenticated using (true) with check (true);

drop policy if exists "padres_enlaces" on public.enlaces;
create policy "padres_enlaces" on public.enlaces
  for all to authenticated using (true) with check (true);

-- 4) Función para la doctora: lee SOLO si el enlace es válido y activo
create or replace function public.datos_compartidos(p_token text, p_desde timestamptz, p_hasta timestamptz)
returns setof public.registros
language sql
security definer
set search_path = public
as $$
  select r.*
  from public.registros r
  where exists (select 1 from public.enlaces e where e.token = p_token and e.activo)
    and r.fecha >= p_desde and r.fecha <= p_hasta
  order by r.fecha asc;
$$;
revoke all on function public.datos_compartidos(text, timestamptz, timestamptz) from public;
grant execute on function public.datos_compartidos(text, timestamptz, timestamptz) to anon, authenticated;

-- 5) Almacenamiento de fotos (bucket público con nombres aleatorios)
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

drop policy if exists "fotos_subir" on storage.objects;
create policy "fotos_subir" on storage.objects
  for insert to authenticated with check (bucket_id = 'fotos');

drop policy if exists "fotos_borrar" on storage.objects;
create policy "fotos_borrar" on storage.objects
  for delete to authenticated using (bucket_id = 'fotos');
