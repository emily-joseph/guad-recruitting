# Recruiting operations plan

## Implemented recruiting workflows

Every applicant supplies two different ordered team preferences. Group-interview reviewers record private notes and exactly one decision: pass to one-on-ones, recommend the applicant to their second choice, refer to another team, place them in the shared pool, or reject. A referral creates a team notification. A steal is represented as a referral with the source team retained, so both teams have an auditable notice.

The shared pool is for applicants a reviewing team does not want but another team may take. A team can claim from the pool or refer an applicant. A direct steal is rejected unless the current decision is rejection or release to the shared pool. Referrals create an in-app team notification and send email when the team-recipient map and mail provider are configured.

Interviewers publish shared one-on-one time slots. Applicants who passed to one-on-ones can reserve one open slot, and the database prevents two applicants from claiming the same slot or one applicant claiming multiple slots. Leads then send the formal invitation with location, preparation, attire, and a Google Calendar event link. Applications also receive an email receipt when delivery is configured.

## Rollout order

1. Run all migrations in order, configure lead and guest emails, and verify the application form’s Drive-link requirements.
2. Invite member viewers, recruiters, and group or one-on-one interviewers from Recruiting settings.
3. Configure Resend and the team-recipient map to enable application receipts, applicant scheduling messages, and team referral email.
4. Schedule interviews by publishing shared times, letting passed applicants book, then sending each applicant a formal invitation.
5. Use the distinct internal-transfer form and its independent cycle/window before general recruiting.

## Access model

`RECRUITING_ADMIN_EMAILS` are leads and can mutate reviewer data. `RECRUITING_GUEST_EMAILS` are read-only recruiting members; they can view applications but cannot change notes, decisions, assignments, or schedules. Role grants can also be managed by leads in Recruiting settings. Keep configured emails to verified organization addresses.

The portal root redirects to `/login`; the organization website should link its Join/Apply button directly to the portal’s `/login` URL. Google Calendar links are prefilled event templates, not automatically-created events; Google OAuth is not configured.

## Google Drive requirements

Applicants provide a `drive.google.com` or `docs.google.com` resume link and may provide any valid HTTP or HTTPS portfolio link. The form cannot verify sharing settings, so it asks applicants to share the resume with recruiting or enable link access. Reviewers should report inaccessible links rather than editing the applicant record. Leads manage the separate transfer deadline and requests at `/admin/transfers`; editors can send one-time completion reminders from the application review page.
