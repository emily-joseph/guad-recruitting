create table public.interview_availability (
  application_user_id uuid not null references auth.users(id) on delete cascade,
  cycle text not null references public.recruitment_windows(cycle),
  slots jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (application_user_id, cycle)
);
create table public.group_interview_runs (
  id uuid primary key default gen_random_uuid(), cycle text not null references public.recruitment_windows(cycle), interview_day date not null,
  groups jsonb not null, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create table public.internal_transfer_windows (
  cycle text primary key, mode text not null default 'closed' check (mode in ('closed','open','scheduled')), opens_at timestamptz, closes_at timestamptz,
  check (mode <> 'scheduled' or (opens_at is not null and closes_at is not null and opens_at < closes_at))
);
create table public.internal_transfers (
  user_id uuid not null references auth.users(id) on delete cascade, cycle text not null references public.internal_transfer_windows(cycle), answers jsonb not null,
  submitted_at timestamptz, updated_at timestamptz not null default now(), primary key (user_id, cycle)
);
insert into public.internal_transfer_windows(cycle, mode) values ('spring-2027-transfer', 'closed');
alter table public.interview_availability enable row level security; alter table public.group_interview_runs enable row level security; alter table public.internal_transfer_windows enable row level security; alter table public.internal_transfers enable row level security;
revoke all on public.interview_availability, public.group_interview_runs, public.internal_transfer_windows, public.internal_transfers from anon, authenticated;
grant all on public.interview_availability, public.group_interview_runs, public.internal_transfer_windows, public.internal_transfers to service_role;
