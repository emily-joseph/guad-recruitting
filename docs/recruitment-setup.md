# Recruitment portal

The portal targets **Spring 2027**, inferred from the current Fall 2026 form. The season constants live in `lib/recruitment-window.ts`. All 16 team options and the three original essay prompts are in `lib/application-schema.ts`. The previous August deadline and info-session dates are intentionally not reused.

## Try it locally

The workspace has an ignored `.env.local` with `APPLICATION_TEST_MODE=true`.

1. Run `npm run dev` and open `http://localhost:3000/login`.
2. Click **Start local test session**. This is a sample identity, not email authentication.
3. Open **Recruiting settings**, select **Open now**, and save. The default is **Closed**.
4. Return to **My application**. Fill in the two sections, use **Save draft**, and reload to verify persistence.
5. Upload a sample PDF resume (5 MB maximum); a portfolio PDF is optional. Review and submit.
6. The receipt is read-only. Sign out and start another test session for a fresh applicant.
7. Set recruiting back to **Closed** when finished, or try a **Scheduled** window.

Test records and uploads are written under `.local-recruitment/`, which is ignored by Git and never served as static files. Do not enter real applicant information in test mode. Test session cookies expire after 24 hours or a dev-server restart; saved records remain on disk. Local mode is single-process development tooling, not a deployment backend.

`APPLICATION_TEST_MODE` is honored **only when NODE_ENV is development**. `npm run build` and `npm start` cannot enable the test login, even if that environment variable remains set. Without Supabase configuration, production stays closed and shows the setup-in-progress sign-in screen.

## Connect real sign-in and persistence

1. Create a Supabase project. Run `supabase/migrations/202609110001_recruitment.sql` once in its SQL editor. This creates the closed spring window, applications table, immutable-submission/deadline trigger, and private PDF storage bucket.
2. Copy the values from `.env.example` into your local environment or deployment settings:
   - `APPLICATION_TEST_MODE=false`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — **server only**, never use a `NEXT_PUBLIC_` prefix.
   - `APP_ORIGIN` — exact app origin without a trailing slash, such as `https://recruiting.example.org`.
   - `RECRUITING_ADMIN_EMAILS` — comma-separated verified email addresses allowed to change the window.
3. Enable email/password auth and **Confirm email** in Supabase Authentication. Set the Site URL to your app’s `/login` URL. Allow your exact origin’s `/auth/callback` URL in the redirect allowlist, including localhost while testing.
4. Configure Supabase SMTP for production email delivery. Account confirmation uses Supabase’s standard confirmation email; applicants then sign in with their password. Password reset uses its standard reset email with a PKCE callback; open that link in the browser where reset was requested.
5. Restart the app. Create and verify a real account. Sign in with an allowlisted admin email and visit `/admin/recruitment`.
6. Keep the window **Closed** until ready, then save an opening and deadline using **Scheduled**.

Real email delivery, confirmation/reset links, database policies, and hosted storage must be exercised against your configured Supabase project before public launch. No remote project or accounts were created by this implementation.

## Recruitment controls

- **Closed**: immediately refuses draft saves, uploads, and final submissions. Applicants can still sign in and view existing drafts or submissions.
- **Open now**: accepts immediately with no automatic deadline; stays open until changed.
- **Scheduled**: accepts at or after opening, and strictly before closing. Both inputs use **America/Chicago**, independent of the administrator’s browser timezone. Invalid and ambiguous daylight-saving times are rejected. No cron job is needed; the API and database compare the current time on every write.

The API rechecks the window after uploads and before persisting. The database independently checks it at write time and refuses updates to submitted applications. A stale browser page cannot bypass a deadline. An upload that fails to attach to an application is removed on a best-effort basis.

## Application behavior

- Two form sections reproduce the provided questions; all answers are required except portfolio and the conditional “Other” text when not applicable.
- Application email comes from the verified sign-in identity and cannot be spoofed in the submitted payload.
- Two distinct team preferences are required; each essay has a 250-word maximum enforced on both client and server.
- Answering **No** to info-session attendance does not block submission. The form gives the recruiting contact for applicants unable to attend, matching the original guidance.
- Draft saving is explicit. Unsaved changes remain in the current page; **Save draft** persists answers and selected PDFs. Submit is a separate review-and-confirm action.
- PDF resume is required for submission; portfolio PDF is optional. Each is limited to 5 MB. Extension and file signature are checked; this is not malware scanning.
- One application per authenticated user per cycle. Successful submission is read-only and provides an on-page receipt, not an email receipt.
- File downloads are authenticated and restricted to the applicant’s own record. The application uses server-only database/storage access, with no anonymous or authenticated browser table-write grants. The service key must remain private.
- Recruitment review/export workflows are not included; records are visible to project administrators in the Supabase dashboard.

Uploads currently travel through the Next.js server. When selecting hosting, ensure its request-body limit supports the 11 MB multipart cap (two 5 MB PDFs plus answers). If the host has a smaller cap, lower both per-file and total limits or switch to signed direct-to-storage uploads before launch.

## Checks

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

The unit tests cover required fields, conditional answers, team preferences, word counts, PDF limits, exact deadline boundaries, and Austin daylight-saving behavior. The API flow also covers authentication, cross-origin request rejection, private file isolation, saved drafts, and duplicate/immutable submissions. The browser test covers both form steps, persisted drafts, upload, review, receipt persistence, and a 390px mobile layout.

Implementation references: [Supabase server-side authentication](https://supabase.com/docs/guides/auth/server-side/creating-a-client) and [private storage access control](https://supabase.com/docs/guides/storage/security/access-control).
