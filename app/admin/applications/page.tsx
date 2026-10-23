import { notFound, redirect } from "next/navigation";
import { ApplicationReviewBoard } from "@/components/portal/application-review-board";
import { ApplicationMetrics } from "@/components/portal/application-metrics";
import { ApplicationReminderBoard } from "@/components/portal/application-reminder-board";
import { PortalShell } from "@/components/portal/portal-shell";
import { getApplicant } from "@/lib/server/session";
import { getApplicationMetrics, getDraftApplicants, getReviewApplications } from "@/lib/server/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Applications | Texas Guadaloop" };
export default async function ApplicationsPage() {
  const user = await getApplicant();
  if (!user) redirect("/login");
  if (!user.member) notFound();
  const drafts = user.editor ? await getDraftApplicants() : [];
  return <PortalShell user={user} test={user.test}><p className="eyebrow">Recruiting operations</p><h1 className="section-title">Application review</h1><p className="mb-8 mt-4 text-gray-400">Record group-interview notes and route candidates using their two stated team preferences.</p><ApplicationMetrics metrics={await getApplicationMetrics()} />{user.editor && <ApplicationReminderBoard initial={drafts} />}<ApplicationReviewBoard initial={await getReviewApplications()} canEdit={user.editor} /></PortalShell>;
}
