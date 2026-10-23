alter table public.application_reviews
  add column if not exists applicant_status text not null default 'in_review'
    check (applicant_status in (
      'in_review',
      'accepted_group_interview',
      'waiting_group_results',
      'accepted_one_on_one',
      'waiting_one_on_one',
      'waitlisted',
      'rejected',
      'accepted_to_team'
    ));

update public.application_reviews
set applicant_status = case
  when decision = 'pass_to_one_on_one' then 'accepted_one_on_one'
  when decision = 'reject' then 'rejected'
  else 'in_review'
end
where applicant_status = 'in_review';
