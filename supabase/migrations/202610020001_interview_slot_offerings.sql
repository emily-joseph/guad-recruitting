create table public.interview_slot_offerings (
  id uuid primary key default gen_random_uuid(),
  cycle text not null references public.recruitment_windows(cycle),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  booked_by uuid references auth.users(id) on delete set null,
  booked_at timestamptz,
  location text not null default '',
  preparation text not null default '',
  attire text not null default '',
  google_calendar_event_url text,
  invitation_sent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create unique index interview_slot_offerings_unique_start
  on public.interview_slot_offerings(cycle, starts_at, ends_at);
create unique index interview_slot_offerings_one_booking_per_applicant
  on public.interview_slot_offerings(cycle, booked_by) where booked_by is not null;
create index interview_slot_offerings_open_slots
  on public.interview_slot_offerings(cycle, starts_at) where booked_by is null;
alter table public.interview_slot_offerings enable row level security;
revoke all on public.interview_slot_offerings from anon, authenticated;
grant all on public.interview_slot_offerings to service_role;