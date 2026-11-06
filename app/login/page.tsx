import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { AuthForm } from "@/components/portal/auth-form";
import { getApplicant } from "@/lib/server/session";
import { backendReady, testMode } from "@/lib/server/config";
import { CYCLE_TITLE } from "@/lib/recruitment-window";
import { inspectFirebaseConfiguration } from "@/lib/server/firebase-config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Applicant sign-in | Texas Guadaloop" };
export default async function Login({ searchParams }: { searchParams: Promise<{ recovery?: string; verified?: string; password?: string; verification?: string }> }) {
  if (await getApplicant()) redirect("/apply");
  const params = await searchParams;
  const setupIssues = process.env.NODE_ENV === "development" && !testMode() ? inspectFirebaseConfiguration().issues : [];
  return <PortalShell test={testMode()}>
    <div className="mb-10 text-center">
      <p className="eyebrow">{CYCLE_TITLE} recruitment</p>
      <h1 className="section-title">Your next chapter starts here.</h1>
      <p className="mt-4 text-gray-400">Sign in to save your progress and manage your application.</p>
    </div>
    {params.recovery === "expired" && <p role="alert" className="mb-6 text-center text-sm text-red-300">This email link is invalid or expired. For a reset link, use Forgot your password. For email verification, enter your portal credentials and use Resend verification email.</p>}
    {params.verification === "unavailable" && <p role="alert" className="mb-6 text-center text-sm text-red-300">Email verification is temporarily unavailable. Try opening your email link again later.</p>}
    {params.verified === "1" && <p role="status" className="mb-6 text-center text-sm text-green-300">Your email is verified. You can now sign in.</p>}
    {params.password === "updated" && <p role="status" className="mb-6 text-center text-sm text-green-300">Your password was updated. Sign in with your new password.</p>}
    {setupIssues.length > 0 && <aside role="alert" className="portal-card mx-auto mb-6 max-w-lg border border-amber-400/40">
      <h2 className="font-bold text-amber-200">Firebase setup needs attention</h2>
      <p className="mt-2 text-sm text-gray-300">Local development: sign-in cannot work until these settings are fixed.</p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-300">{setupIssues.map(issue => <li key={issue}>{issue}</li>)}</ul>
      <p className="mt-3 text-sm text-gray-300">Run npm run check:auth to check again. Restart the development server after changing .env.local.</p>
    </aside>}
    <AuthForm test={testMode()} ready={backendReady()} />
  </PortalShell>;
}
