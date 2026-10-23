import { z } from "zod";
import { getApplicant } from "@/lib/server/session";
import { claimInterviewOffering, getInterviewOfferings, getReviewApplications, publishInterviewOfferings, saveInterviewInvitation, withWriteLock } from "@/lib/server/store";
import { sendRecruitingEmail } from "@/lib/server/email";
import { checkOrigin, fail, limitedBody } from "@/lib/server/http";
const schema = z.discriminatedUnion("action", [
	z.object({ action: z.literal("publish"), slots: z.array(z.object({ startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }) }).refine(slot => Date.parse(slot.startsAt) < Date.parse(slot.endsAt), "End time must be after start time.")).min(1).max(50) }),
	z.object({ action: z.literal("book"), slotId: z.uuid() }),
	z.object({ action: z.literal("invite"), slotId: z.uuid(), location: z.string().trim().min(1).max(300), preparation: z.string().trim().min(1).max(2000), attire: z.string().trim().min(1).max(500) }),
]);
function calendarUrl(slot: { starts_at: string; ends_at: string; location: string; preparation: string; attire: string }, applicantEmail: string) {
	const date = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(".000Z", "Z");
	const params = new URLSearchParams({ action: "TEMPLATE", text: "Texas Guadaloop one-on-one interview", dates: `${date(slot.starts_at)}/${date(slot.ends_at)}`, location: slot.location, details: `Preparation: ${slot.preparation}\nWhat to wear: ${slot.attire}\nApplicant: ${applicantEmail}`, add: applicantEmail });
	return `https://calendar.google.com/calendar/render?${params}`;
}

export async function GET() {
	try {
		const user = await getApplicant();
		if (!user) return fail("Sign in first.", 401);
		const offerings = await getInterviewOfferings();
		if (user.editor || user.oneOnOneInterviewer) {
			const applications = await getReviewApplications();
			const booked = offerings.filter(slot => slot.booked_by).map(slot => {
				const applicant = applications.find(application => application.user_id === slot.booked_by);
				return { ...slot, applicant: applicant ? { name: applicant.answers.name, email: applicant.answers.email } : null };
			});
			return Response.json({ slots: offerings, booked }, { headers: { "Cache-Control": "no-store" } });
		}
		const application = (await getReviewApplications()).find(item => item.user_id === user.id && item.submitted_at);
		if (application?.review?.decision !== "pass_to_one_on_one") return fail("Interview booking is available after you pass to one-on-ones.", 403);
		return Response.json({ slots: offerings.filter(slot => (!slot.booked_by || slot.booked_by === user.id) && Date.parse(slot.starts_at) > Date.now()) }, { headers: { "Cache-Control": "no-store" } });
	} catch (error) { return fail(error instanceof Error ? error.message : "Could not load interview times.", 503); }
}

export async function POST(request: Request) {
	try {
		checkOrigin(request);
		const user = await getApplicant();
		if (!user) return fail("Sign in first.", 401);
		const parsed = schema.safeParse(JSON.parse(new TextDecoder().decode(await limitedBody(request, 16000))));
		if (!parsed.success) return fail(parsed.error.issues[0].message);
		const payload = parsed.data;
		if (payload.action === "publish") {
			if (!user.oneOnOneInterviewer) return fail("One-on-one interviewer access is required.", 403);
			if (payload.slots.some(slot => Date.parse(slot.startsAt) <= Date.now())) return fail("Interview times must be in the future.");
			const created = await withWriteLock(() => publishInterviewOfferings(user, payload.slots.map(slot => ({ starts_at: slot.startsAt, ends_at: slot.endsAt }))));
			const allOfferings = await getInterviewOfferings();
			const bookedApplicantIds = new Set(allOfferings.flatMap(slot => slot.booked_by ? [slot.booked_by] : []));
			const applications = (await getReviewApplications()).filter(item => item.review?.decision === "pass_to_one_on_one" && !bookedApplicantIds.has(item.user_id));
			const origin = process.env.APP_ORIGIN || new URL(request.url).origin;
			const emails = await Promise.all(applications.map(application => sendRecruitingEmail({ to: application.answers.email, subject: "Choose a Texas Guadaloop interview time", text: `You have been invited to choose a one-on-one interview time. Sign in to reserve an available time: ${origin}/interview-availability` })));
			return Response.json({ slots: created, notified: emails.filter(Boolean).length, eligible: applications.length, emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RECRUITING_FROM_EMAIL) });
		}
		if (payload.action === "book") {
			const application = (await getReviewApplications()).find(item => item.user_id === user.id && item.submitted_at);
			if (application?.review?.decision !== "pass_to_one_on_one") return fail("Interview booking is available after you pass to one-on-ones.", 403);
			const existing = (await getInterviewOfferings()).find(slot => slot.booked_by === user.id);
			if (existing) return fail("You already have an interview time reserved.", 409);
			const slotId = payload.slotId;
			const booked = await withWriteLock(() => claimInterviewOffering(user, slotId));
			return booked ? Response.json({ slot: booked, message: "Interview time reserved. Recruiting will send your formal invitation." }) : fail("That time was just booked or is no longer available. Refresh and choose another.", 409);
		}
		if (!user.editor) return fail("A recruiting lead must finalize interview invitations.", 403);
		const slot = (await getInterviewOfferings()).find(item => item.id === payload.slotId && item.booked_by);
		if (!slot?.booked_by) return fail("Booked interview not found.", 404);
		const application = (await getReviewApplications()).find(item => item.user_id === slot.booked_by);
		if (!application) return fail("Applicant not found.", 404);
		const eventUrl = calendarUrl({ ...slot, ...payload }, application.answers.email);
		const emailSent = await sendRecruitingEmail({ to: application.answers.email, subject: "Your Texas Guadaloop interview invitation", text: `Hi ${application.answers.name},\n\nYour one-on-one interview is scheduled for ${new Date(slot.starts_at).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short", timeZone: "America/Chicago" })} (Central Time).\n\nLocation: ${payload.location}\nWhat to prepare: ${payload.preparation}\nWhat to wear: ${payload.attire}\n\nAdd the event to Google Calendar: ${eventUrl}\n\nTexas Guadaloop Recruiting` });
		const saved = await saveInterviewInvitation(user, slot.id, { ...payload, google_calendar_event_url: eventUrl }, emailSent);
		if (!saved) return fail("Could not save the interview invitation.", 500);
		return Response.json({ slot: saved, eventUrl, emailSent, message: emailSent ? "Formal invitation emailed. Use the Google Calendar link to add the event." : "Invitation saved. Configure recruiting email to send it automatically; use the Google Calendar link to add the event." });
	} catch (error) { return fail(error instanceof Error ? error.message : "Could not update interview scheduling."); }
}
