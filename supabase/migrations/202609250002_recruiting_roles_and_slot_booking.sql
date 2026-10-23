alter table public.recruiting_member_access drop constraint if exists recruiting_member_access_role_check;
alter table public.recruiting_member_access add constraint recruiting_member_access_role_check check (role in ('viewer', 'recruiter', 'group_interviewer', 'one_on_one_interviewer'));

alter table public.interview_slots add column if not exists available boolean not null default false;
alter table public.interview_slots add column if not exists booked_by uuid references auth.users(id) on delete set null;
alter table public.interview_slots add column if not exists booked_at timestamptz;
create index if not exists interview_slots_available_idx on public.interview_slots(cycle, available, starts_at);
