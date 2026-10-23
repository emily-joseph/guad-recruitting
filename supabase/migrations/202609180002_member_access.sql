-- Run after the recruiting operations migration. All authenticated members can
-- view applications; this table grants editable recruiting-review access.
create table public.recruiting_member_access (
  email text primary key check (email = lower(email)),
  role text not null check (role in ('editor')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now()
);
alter table public.recruiting_member_access enable row level security;
revoke all on public.recruiting_member_access from anon, authenticated;
grant all on public.recruiting_member_access to service_role;
