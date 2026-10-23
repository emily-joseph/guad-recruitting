alter table public.internal_transfers
  add column if not exists decision text not null default 'pending'
    check (decision in ('pending', 'approved', 'declined')),
  add column if not exists notes text not null default ''
    check (char_length(notes) <= 5000);

alter table public.applications
  add column if not exists reminder_sent_at timestamptz;
