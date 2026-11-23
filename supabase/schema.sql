-- KEYGUARD's hosted register: one private snapshot per signed-in user.
-- Apply this to the linked Supabase project with the Supabase SQL editor/MCP.
create table if not exists public.keyguard_registers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  constraint keyguard_registers_state_shape check (
    jsonb_typeof(state) = 'object'
    and state ?& array['keys', 'transactions', 'audit_events']
    and jsonb_typeof(state -> 'keys') = 'array'
    and jsonb_typeof(state -> 'transactions') = 'array'
    and jsonb_typeof(state -> 'audit_events') = 'array'
  )
);

alter table public.keyguard_registers enable row level security;

revoke all on table public.keyguard_registers from anon, public;
grant select, insert, update, delete on table public.keyguard_registers to authenticated;

drop policy if exists "Users manage their own KEYGUARD register" on public.keyguard_registers;
create policy "Users manage their own KEYGUARD register"
  on public.keyguard_registers
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
