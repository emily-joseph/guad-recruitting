export const applicantStatuses = [
  "in_review",
  "accepted_group_interview",
  "waiting_group_results",
  "accepted_one_on_one",
  "waiting_one_on_one",
  "waitlisted",
  "rejected",
  "accepted_to_team",
] as const;

export type ApplicantStatus = typeof applicantStatuses[number];

export const applicantStatusLabels: Record<ApplicantStatus, string> = {
  in_review: "In review",
  accepted_group_interview: "Accepted to group interview",
  waiting_group_results: "Waiting for group interview results",
  accepted_one_on_one: "Accepted to one-on-one interview",
  waiting_one_on_one: "Waiting for one-on-one interview",
  waitlisted: "Waitlisted",
  rejected: "Rejected",
  accepted_to_team: "Accepted to a team",
};
