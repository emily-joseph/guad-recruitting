import { getApplicant } from "@/lib/server/session";
import { claimDraftReminder, getDraftApplicants, releaseDraftReminder } from "@/lib/server/store";
import { sendRecruitingEmail } from "@/lib/server/email";
import { checkOrigin, fail, limitedBody } from "@/lib/server/http";
import { z } from "zod";

const payload = z.object({ userId: z.uuid() });

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await getApplicant();
    if (!user?.editor) return fail("Editable recruiting access is required.", 403);
    const parsed = payload.safeParse(JSON.parse(new TextDecoder().decode(await limitedBody(request, 2000))));
    if (!parsed.success) return fail("Choose an unfinished application.");
    const applicant = (await getDraftApplicants()).find(item => item.user_id === parsed.data.userId);
    if (!applicant) return fail("This applicant has no unfinished application.", 404);
    if (applicant.reminder_sent_at) return fail("A completion reminder was already sent for this draft.", 409);
    if (!await claimDraftReminder(applicant.user_id)) return fail("A completion reminder was already sent for this draft.", 409);
    const origin = process.env.APP_ORIGIN ?? new URL(request.url).origin;
    const sent = await sendRecruitingEmail({ to: applicant.email, subject: "Finish your Texas Guadaloop application", text: `Hi ${applicant.name},\n\nYou have a saved Texas Guadaloop application that has not been submitted yet. Sign in to review and finish it: ${origin}/apply\n\nThank you,\nTexas Guadaloop Recruiting` });
    if (!sent) {
      await releaseDraftReminder(applicant.user_id);
      return fail("The reminder email could not be sent. Check the recruiting email configuration and try again.", 503);
    }
    return Response.json({ message: `Completion reminder sent to ${applicant.email}.` });
  } catch (error) { return fail(error instanceof Error ? error.message : "Could not send the completion reminder."); }
}
