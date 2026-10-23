import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { AvailabilityForm } from "@/components/portal/availability-form";
import { getApplicant } from "@/lib/server/session";
import { getOpenInterviewOfferings, getReviewApplications } from "@/lib/server/store";
export const dynamic = "force-dynamic";
export default async function AvailabilityPage() { const user = await getApplicant(); if (!user) redirect("/login"); const eligible = user.editor || (await getReviewApplications()).some(application => application.user_id === user.id && application.review?.decision === "pass_to_one_on_one"); const initialSlots = eligible ? await getOpenInterviewOfferings(user.id) : []; return <PortalShell user={user} test={user.test}><p className="eyebrow">One-on-one interviews</p><h1 className="section-title">Choose an interview time</h1><p className="mb-8 mt-4 text-gray-400">Reserve one open time after you are invited to the interview stage.</p>{eligible ? <AvailabilityForm initialSlots={initialSlots} /> : <section className="portal-card"><h2 className="text-xl font-bold">Booking is not open yet</h2><p className="mt-3 text-sm text-gray-400">Interview booking becomes available after you pass to one-on-ones.</p></section>}</PortalShell>; }
