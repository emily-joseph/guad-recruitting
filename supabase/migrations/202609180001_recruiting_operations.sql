-- Run after 202609110001_recruitment.sql. Reviewer data is only available through
-- the server-side service-role client; applicants never receive these records.
create table public.application_reviews (
  application_user_id uuid not null references auth.users(id) on delete cascade,
  cycle text not null references public.recruitment_windows(cycle),
  stage text not null default 'group_interview' check (stage in ('group_interview', 'one_on_one', 'shared_pool', 'closed')),
  owning_team text,
  decision text not null default 'pending' check (decision in ('pending', 'pass_to_one_on_one', 'recommend_team_2', 'refer_team', 'shared_pool', 'reject')),
  notes text not null default '' check (char_length(notes) <= 10000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (application_user_id, cycle)
);
create table public.recruiting_notifications (
  id uuid primary key default gen_random_uuid(),
  cycle text not null references public.recruitment_windows(cycle),
  application_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_team text not null,
  source_team text,
  kind text not null check (kind in ('referral', 'steal')),
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create table public.interview_slots (
  id uuid primary key default gen_random_uuid(),
  application_user_id uuid not null references auth.users(id) on delete cascade,
  cycle text not null references public.recruitment_windows(cycle),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  location text not null default '',
  preparation text not null default '',
  attire text not null default '',
  availability jsonb not null default '[]'::jsonb,
  google_calendar_event_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.application_reviews enable row level security;
alter table public.recruiting_notifications enable row level security;
alter table public.interview_slots enable row level security;
revoke all on public.application_reviews, public.recruiting_notifications, public.interview_slots from anon, authenticated;
grant all on public.application_reviews, public.recruiting_notifications, public.interview_slots to service_role;
