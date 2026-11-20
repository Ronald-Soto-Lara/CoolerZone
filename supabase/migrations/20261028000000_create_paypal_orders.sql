create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  paypal_order_id text not null unique,
  paypal_capture_request_id uuid not null default gen_random_uuid(),
  paypal_refund_request_id uuid not null default gen_random_uuid(),
  paypal_capture_id text unique,
  paypal_refund_id text unique,
  product_id uuid not null,
  product_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_bob numeric(12, 2) not null check (unit_price_bob >= 0),
  exchange_rate numeric(18, 8) not null check (exchange_rate > 0),
  amount_usd numeric(12, 2) not null check (amount_usd > 0),
  currency_code text not null default 'USD' check (currency_code = 'USD'),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'refund_pending', 'refunded')),
  payer_name text,
  payer_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  refunded_at timestamptz
);

create index if not exists orders_product_created_at_idx
  on public.orders (product_id, created_at desc);
create index if not exists orders_refund_pending_idx
  on public.orders (created_at)
  where status = 'refund_pending';

alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant all on public.orders to service_role;

comment on table public.orders is
  'Private PayPal order records; client access is denied and server-side writes use the Supabase service role.';

create or replace function public.finalize_paypal_order(
  p_paypal_order_id text,
  p_capture_id text,
  p_payer_name text,
  p_payer_email text
)
returns table(order_status text, order_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  if nullif(trim(p_capture_id), '') is null then
    raise exception 'A PayPal capture ID is required.';
  end if;

  select *
    into v_order
    from public.orders
   where paypal_order_id = p_paypal_order_id
   for update;

  if not found then
    raise exception 'PayPal order not found.';
  end if;

  if v_order.status in ('completed', 'refund_pending', 'refunded') then
    if v_order.paypal_capture_id is distinct from p_capture_id then
      raise exception 'PayPal capture ID does not match the saved order.';
    end if;
    return query select v_order.status, v_order.id;
    return;
  end if;

  if v_order.status <> 'pending' then
    raise exception 'PayPal order is not pending.';
  end if;

  update public.products
     set stock = stock - v_order.quantity
   where id = v_order.product_id
     and stock >= v_order.quantity;

  if not found then
    update public.orders
       set status = 'refund_pending',
           paypal_capture_id = p_capture_id,
           payer_name = p_payer_name,
           payer_email = p_payer_email,
           paid_at = now(),
           updated_at = now()
     where id = v_order.id;

    return query select 'refund_pending'::text, v_order.id;
    return;
  end if;

  update public.orders
     set status = 'completed',
         paypal_capture_id = p_capture_id,
         payer_name = p_payer_name,
         payer_email = p_payer_email,
         paid_at = now(),
         updated_at = now()
   where id = v_order.id;

  return query select 'completed'::text, v_order.id;
end;
$$;

revoke all on function public.finalize_paypal_order(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.finalize_paypal_order(text, text, text, text)
  to service_role;

create or replace function public.finalize_paypal_refund(
  p_paypal_order_id text,
  p_refund_id text
)
returns table(order_status text, order_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  if nullif(trim(p_refund_id), '') is null then
    raise exception 'A PayPal refund ID is required.';
  end if;

  select *
    into v_order
    from public.orders
   where paypal_order_id = p_paypal_order_id
   for update;

  if not found then
    raise exception 'PayPal order not found.';
  end if;

  if v_order.status = 'refunded' then
    if v_order.paypal_refund_id is distinct from p_refund_id then
      raise exception 'PayPal refund ID does not match the saved order.';
    end if;
    return query select v_order.status, v_order.id;
    return;
  end if;

  if v_order.status <> 'refund_pending' then
    raise exception 'PayPal order is not awaiting a refund.';
  end if;

  update public.orders
     set status = 'refunded',
         paypal_refund_id = p_refund_id,
         refunded_at = now(),
         updated_at = now()
   where id = v_order.id;

  return query select 'refunded'::text, v_order.id;
end;
$$;

revoke all on function public.finalize_paypal_refund(text, text)
  from public, anon, authenticated;
grant execute on function public.finalize_paypal_refund(text, text)
  to service_role;
