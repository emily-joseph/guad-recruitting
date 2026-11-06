# Recruitment portal

The portal targets **Spring 2027**, inferred from the current Fall 2026 form. The season constants live in `lib/recruitment-window.ts`. All 16 team options and the three original essay prompts are in `lib/application-schema.ts`. The previous August deadline and info-session dates are intentionally not reused.

## Try it locally

Copy `.env.example` to `.env.local`. For local role previews, explicitly set `APPLICATION_TEST_MODE=true`. Set it to `false` to test real Firebase login.

1. Run `npm run dev` and open `http://localhost:3000/login`.
2. Choose **Applicant**, **Guest viewer**, **Group interviewer**, **One-on-one interviewer**, **Recruiter**, or **Lead**, then start the local role preview. This is a sample identity, not email authentication; sign out to preview another role.
3. Open **Recruiting settings**, select **Open now**, and save. The default is **Closed**.
4. Return to **My application**. Fill in the two sections, use **Save draft**, and reload to verify persistence.
5. Enter a resume link from Google Drive or Google Docs and, optionally, a website portfolio link. Review and submit.
6. The receipt is read-only. Sign out and start another test session for a fresh applicant.
7. Set recruiting back to **Closed** when finished, or try a **Scheduled** window.

Test records are written under `.local-recruitment/`, which is ignored by Git and never served as static files. Do not enter real applicant information in test mode. Test session cookies expire after 24 hours or a dev-server restart; saved records remain on disk. Local mode is single-process development tooling, not a deployment backend.

`APPLICATION_TEST_MODE` is honored **only when NODE_ENV is development**. `npm run build` and `npm start` cannot enable the test login, even if that environment variable remains set. Without Firebase configuration, production stays closed and shows the setup-in-progress sign-in screen.

## Connect real sign-in and persistence

Run `npm run check:auth` before testing real login (Node 22.6+). This checks required values, matching project IDs, the service-account file, and its private key without printing credentials. A filled-in `FIREBASE_SERVICE_ACCOUNT_PATH` is not enough: download the JSON key from Firebase **Project settings > Service accounts > Generate new private key**, and save it at that exact path. The web app configuration/API key cannot replace this server credential. Development login pages show these setup problems directly; production does not disclose local configuration details.

Email/password sign-in uses the password created for this recruitment portal. A UT EID password does not automatically create a Firebase account. First-time users must choose **Create account** and verify their school email, or use **Continue with Google** with a Google identity whose email is an accepted UT address. A school email that is not a Google account can use email/password signup. If signup creates the account but email delivery fails, use **Resend verification email**, not signup again.

1. Create a Firebase project and enable **Email/Password** and **Google** sign-in providers in Authentication. Create a Cloud Firestore database and deploy `firestore.rules` from this repo (`firebase deploy --only firestore:rules`). The app stores application data in Firestore through the server Admin SDK; browser database access is denied by the rules. Resumes stay in Google Drive, so the app does not need Cloud Storage.
2. Copy the values from `.env.example` into your local environment or deployment settings:
   - `APPLICATION_TEST_MODE=false`
   - `NEXT_PUBLIC_FIREBASE_API_KEY` — Firebase web API key for account actions.
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` — normally `<project-id>.firebaseapp.com` from the registered web app config.
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_SERVICE_ACCOUNT_PATH=.secrets/firebase-service-account.json` — save the downloaded service account JSON at this path. The `.secrets/` folder is ignored by Git. Alternatively set `FIREBASE_SERVICE_ACCOUNT_JSON` to compact JSON in a private environment variable.
   - `APP_ORIGIN` — exact app origin without a trailing slash, such as `https://recruiting.example.org`.
   - `RECRUITING_ADMIN_EMAILS` — comma-separated verified email addresses allowed to change the window.
   - `RESEND_API_KEY` and `RECRUITING_FROM_EMAIL` — optional, but required for application receipts, interview emails, and referral email notifications. Verify the sender domain with Resend.
   - `RECRUITING_TEAM_EMAILS` — optional JSON object mapping exact team names to recipient email addresses, for example `{"Engineering":"engineering@example.org","Business":"business@example.org"}`.
3. Add your deployed domain and localhost to Firebase Authentication's authorized domains. Customize the action URL for verification and password reset email templates to `https://your-domain/auth/callback` (use your localhost origin for local testing). This is the action handler URL, not the continue URL; the app sets the continue URL to `/login`. The default Firebase hosted email handler also works.
4. Restart the app. Create and verify a UT account, add your lead email to `RECRUITING_ADMIN_EMAILS`, then visit `/admin/recruitment`.
5. Keep the window **Closed** until ready, then save an opening and deadline using **Scheduled**.

Firebase Auth email actions, Firestore persistence, and Resend delivery need to be exercised against your configured Firebase project before public launch. The application form stores a Google Drive resume URL and optional portfolio URL; it does not upload files to Firebase Storage. Existing `supabase/migrations/` files document the retired Supabase schema and are not used by the Firebase implementation. No remote project or accounts were created here.

## Recruitment controls

- **Closed**: immediately refuses draft saves and final submissions. Applicants can still sign in and view existing drafts or submissions.
- **Open now**: accepts immediately with no automatic deadline; stays open until changed.
- **Scheduled**: accepts at or after opening, and strictly before closing. Both inputs use **America/Chicago**, independent of the administrator’s browser timezone. Invalid and ambiguous daylight-saving times are rejected. No cron job is needed; the API and database compare the current time on every write.

The API rechecks the window before persisting. It refuses updates to submitted applications. A stale browser page cannot bypass a deadline.

## Application behavior

- Two form sections reproduce the provided questions; all answers are required except portfolio and the conditional “Other” text when not applicable.
- Application email comes from the verified sign-in identity and cannot be spoofed in the submitted payload.
- Two distinct team preferences are required; each essay has a 250-word maximum enforced on both client and server.
- Answering **No** to info-session attendance does not block submission. The form gives the recruiting contact for applicants unable to attend, matching the original guidance.
- Draft saving is explicit. Unsaved changes remain in the current page; **Save draft** persists answers and links. Submit is a separate review-and-confirm action.
- A resume link from `drive.google.com` or `docs.google.com` is required. Portfolio is optional and accepts any valid HTTP or HTTPS website URL. Link sharing settings cannot be checked by the portal.
- One application per authenticated user per cycle. Successful submission is read-only and provides an on-page receipt; a confirmation email is sent when Resend is configured.
- The application uses server-only Firestore access. Keep the Firebase service account private; never ship it to the browser.
- Editors can send a one-time completion reminder to applicants with saved drafts. Email delivery requires Resend configuration.
- Applicants can view their status as **In review**, **Accepted to group interview**, **Waiting for group interview results**, **Accepted to one-on-one interview**, **Waiting for one-on-one interview**, **Waitlisted**, **Rejected**, or **Accepted to a team**. Private reviewer notes and internal routing decisions are not shown.
- Recruitment review/export workflows are not included; records are visible to project administrators in the Supabase dashboard.

## Interview scheduling and notifications

Leads or assigned one-on-one interviewers publish shared future time slots from `/admin/interviews`. Applicants must have a submitted application and a `pass_to_one_on_one` decision before booking. A slot can be claimed once, and an applicant can reserve only one slot. After booking, a lead adds the location, preparation, and attire, then sends the formal invitation. Applicants can add the prefilled event to Google Calendar from the invitation page; this does not create an event automatically and does not require OAuth.

When Resend is configured, publishing times emails eligible applicants a booking link, finalizing an invitation emails its logistics, and application submission sends a receipt. Referrals and steals send to the matching recipient in `RECRUITING_TEAM_EMAILS` and always create an in-portal notification. Without Resend configuration the core workflows still work, but those emails are not sent.

The portal root redirects to `/login`. The organization’s Join/Apply button should link directly to the deployed portal’s `/login` URL.

Internal transfer windows and request reviews are managed separately at `/admin/transfers`. Completion reminders are sent manually by an editor from the application review page.

## Checks

Firebase auth regression tests are included in `npm test`. Run `npx playwright test --config tests/auth.playwright.config.ts` to exercise the sign-in UI and API validation. It starts an isolated local fixture on port 3101 with generated test credentials that have no Firebase access. These UI tests mock auth responses and create no remote accounts. `TEST_ORIGIN` can instead point to an already-running server with valid configuration and preview mode disabled. Live Google sign-in, email delivery, and service account access still require a configured Firebase project.

```sh
npm run lint
npm test
npm run build
```

With the local development server running and local test mode enabled:

```sh
node tests/local-flow.mjs
npx playwright test
```

`TEST_ORIGIN` can override `http://localhost:3000`. The Playwright config uses installed Microsoft Edge; change its channel for another browser environment. These tests temporarily change the local window and restore its original value in `finally`. They leave sample records in the ignored local store. Do not run them concurrently with manual schedule testing.

The unit tests cover required fields, conditional answers, team preferences, word counts, exact deadline boundaries, and Austin daylight-saving behavior. The API flow covers authentication, cross-origin request rejection, saved drafts, and duplicate/immutable submissions. The browser test covers both form steps, persisted drafts, review, receipt persistence, and a 390px mobile layout.

Implementation references: [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup), [Firebase email actions](https://firebase.google.com/docs/auth/custom-email-handler), and [Firebase Authentication with Google](https://firebase.google.com/docs/auth/web/google-signin).
