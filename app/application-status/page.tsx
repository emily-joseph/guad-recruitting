import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { getApplicant } from "@/lib/server/session";
import { getApplicantApplicationProgress } from "@/lib/server/store";
import { formatAustinDate } from "@/lib/recruitment-window";

export const dynamic = "force-dynamic";
export const metadata = { title: "Application status | Texas Guadaloop" };

function statusFor(progress: Awaited<ReturnType<typeof getApplicantApplicationProgress>>) {
  if (!progress.hasApplication) return { title: "No application started", message: "Start an application to see its status here." };
  if (!progress.submittedAt) return { title: "Draft not submitted", message: "Your answers are saved as a draft. Submit your application before the deadline for recruiting to review it." };
  switch (progress.status) {
    case "accepted_group_interview": return { title: "Accepted to group interview", message: "You’ve been selected for a group interview. Recruiting will share the interview details with you." };
    case "waiting_group_results": return { title: "Waiting for group interview results", message: "Your group interview is complete. Recruiting is reviewing the results and will update this page." };
    case "accepted_one_on_one": return { title: "Accepted to one-on-one interview", message: "You can choose an available interview time below." };
    case "waiting_one_on_one": return { title: "Waiting for one-on-one interview", message: "Your interview is booked. Check Interview slots for the time and invitation details." };
    case "waitlisted": return { title: "Waitlisted", message: "Your application remains under consideration. Recruiting will update this page if your status changes." };
    case "rejected": return { title: "Rejected", message: "We’re unable to move forward with your application this cycle. Thank you for your interest in Texas Guadaloop." };
    case "accepted_to_team": return { title: "Accepted to a team", message: progress.team ? `Congratulations! You’ve been accepted to ${progress.team}.` : "Congratulations! You’ve been accepted to a team." };
    default: return { title: "In review", message: "Your application was submitted and is being reviewed. Recruiting will update this page when there is a next step." };
  }
}

export default async function ApplicationStatusPage() {
  const user = await getApplicant();
  if (!user) redirect("/login");
  const progress = await getApplicantApplicationProgress(user);
  const status = statusFor(progress);
  return <PortalShell user={user} test={user.test}>
    <p className="eyebrow">Applicant portal</p>
    <h1 className="section-title">Application status</h1>
    <section className="portal-card mt-8" aria-live="polite">
      <p className="text-sm text-accent">Current status</p>
      <h2 className="mt-3 text-2xl font-bold">{status.title}</h2>
      <p className="mt-3 leading-7 text-gray-300">{status.message}</p>
      {progress.submittedAt && <dl className="mt-6 grid gap-4 border-t border-white/10 pt-5 text-sm sm:grid-cols-2"><div><dt className="text-gray-400">Submitted</dt><dd className="mt-1">{formatAustinDate(progress.submittedAt)}</dd></div>{progress.updatedAt && <div><dt className="text-gray-400">Last status update</dt><dd className="mt-1">{formatAustinDate(progress.updatedAt)}</dd></div>}</dl>}
      <div className="mt-6 flex flex-wrap gap-3">{!progress.hasApplication && <Link className="button" href="/apply">Start application</Link>}{progress.hasApplication && !progress.submittedAt && <Link className="button" href="/apply">Continue application</Link>}{progress.status === "accepted_one_on_one" && <Link className="button" href="/interview-availability">Choose interview time</Link>}{progress.status === "waiting_one_on_one" && <Link className="button" href="/interview-availability">View interview details</Link>}{progress.submittedAt && <Link className="button button-secondary" href="/apply">View submitted application</Link>}</div>
    </section>
    <p className="mt-6 text-sm text-gray-400">This page shows applicant-facing updates only. For questions, contact <a className="text-accent underline" href="mailto:guadaloop.recruiting@gmail.com">guadaloop.recruiting@gmail.com</a>.</p>
  </PortalShell>;
}
