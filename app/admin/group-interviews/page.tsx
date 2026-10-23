import { notFound, redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { GroupBuilder } from "@/components/portal/group-builder";
import { getApplicant } from "@/lib/server/session";
import { getGroupInterviewRuns } from "@/lib/server/store";
export const dynamic = "force-dynamic";
export default async function GroupInterviewsPage() { const user = await getApplicant(); if (!user) redirect("/login"); if (!user.groupInterviewer) notFound(); const runs = await getGroupInterviewRuns(); return <PortalShell user={user} test={user.test}><p className="eyebrow">Recruiting operations</p><h1 className="section-title">Group interview assignments</h1><p className="mb-8 mt-4 text-gray-400">Build and review assignments separately for each group-interview day. Only applicants marked “Accepted to group interview” are included.</p><GroupBuilder initialRuns={runs} /></PortalShell>; }
