import { notFound, redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { InterviewScheduler } from "@/components/portal/interview-scheduler";
import { getApplicant } from "@/lib/server/session";
import { getInterviewOfferings, getReviewApplications } from "@/lib/server/store";
export const dynamic = "force-dynamic";
export default async function InterviewsPage() { const user = await getApplicant(); if (!user) redirect("/login"); if (!user.oneOnOneInterviewer) notFound(); const [offerings, applications] = await Promise.all([getInterviewOfferings(), getReviewApplications()]); const booked = offerings.filter(slot => slot.booked_by).map(slot => { const applicant = applications.find(application => application.user_id === slot.booked_by); return { ...slot, applicant: applicant ? { name: applicant.answers.name, email: applicant.answers.email } : null }; }); return <PortalShell user={user} test={user.test}><p className="eyebrow">Recruiting operations</p><h1 className="section-title">One-on-one interviews</h1><p className="mb-8 mt-4 text-gray-400">Publish open times for passed applicants, then send each booked applicant a formal invitation.</p><InterviewScheduler initialBooked={booked} /></PortalShell>; }
