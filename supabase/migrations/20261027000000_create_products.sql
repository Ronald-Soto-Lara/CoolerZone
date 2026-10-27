create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  brand text,
  description text,
  price numeric(12, 2) not null check (price >= 0),
  category text,
  image_url text,
  stock integer not null default 0 check (stock >= 0),
  published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_products_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at
before update on public.products
for each row execute function public.set_products_updated_at();

alter table public.products enable row level security;

drop policy if exists "Published products are publicly readable" on public.products;
create policy "Published products are publicly readable"
on public.products
for select
to anon, authenticated
using (published = true);

comment on table public.products is 'Catálogo público de productos CoolerZone; la administración se realiza desde Supabase.';