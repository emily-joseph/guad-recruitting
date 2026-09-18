-- Run once in the Supabase SQL editor. Writes go through authenticated Next.js
-- routes using the server-only service-role client. No browser can write these tables.
create table public.recruitment_windows (
  cycle text primary key,
  mode text not null default 'closed' check (mode in ('closed', 'open', 'scheduled')),
  opens_at timestamptz,
  closes_at timestamptz,
  check (mode <> 'scheduled' or (opens_at is not null and closes_at is not null and opens_at < closes_at))
);
create table public.applications (
  user_id uuid not null references auth.users(id) on delete cascade,
  cycle text not null references public.recruitment_windows(cycle),
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  resume jsonb,
  portfolio jsonb,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, cycle),
  check (submitted_at is null or resume is not null)
);
alter table public.recruitment_windows enable row level security;
alter table public.applications enable row level security;
revoke all on public.recruitment_windows, public.applications from anon, authenticated;
grant all on public.recruitment_windows, public.applications to service_role;

insert into public.recruitment_windows(cycle, mode) values ('spring-2027', 'closed');

-- Enforce the deadline in the database as well as the API, and make submissions
-- immutable. Lock the window row so closing and submitting serialize correctly.
create function public.guard_application_write() returns trigger
language plpgsql set search_path = '' as $$
declare
  recruitment public.recruitment_windows;
begin
  if TG_OP = 'UPDATE' and OLD.submitted_at is not null then
    raise exception 'Application already submitted';
  end if;
  select * into recruitment from public.recruitment_windows where cycle = NEW.cycle for share;
  if not found or recruitment.mode = 'closed' or
     (recruitment.mode = 'scheduled' and not
       (clock_timestamp() >= recruitment.opens_at and clock_timestamp() < recruitment.closes_at)) then
    raise exception 'Applications are closed';
  end if;
  NEW.updated_at := clock_timestamp();
  if NEW.submitted_at is not null then NEW.submitted_at := clock_timestamp(); end if;
  return NEW;
end;
$$;
create trigger application_window_guard before insert or update on public.applications
for each row execute function public.guard_application_write();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('application-files', 'application-files', false, 5242880, array['application/pdf']);
-- Intentionally no storage policies for anon/authenticated: uploads and downloads
-- go through server routes that verify the signed-in applicant owns the record.
