import { applicationSchema, draftSchema } from "@/lib/application-schema";
import { CYCLE, isAccepting } from "@/lib/recruitment-window";
import { getApplicant } from "@/lib/server/session";
import { getWindow, getApplication, saveApplication, withWriteLock } from "@/lib/server/store";
import { checkOrigin, fail, limitedBody } from "@/lib/server/http";
import { sendRecruitingEmail } from "@/lib/server/email";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await getApplicant();
    if (!user) return fail("Your session expired. Sign in again before saving.", 401);
    if (Number(request.headers.get("content-length")) > 70 * 1024) return fail("Application data is too large.", 413);
    if (!isAccepting(await getWindow())) return fail("Applications are closed. Your saved draft is still available.", 403);
    const body = JSON.parse(new TextDecoder().decode(await limitedBody(request, 70 * 1024)));
    const intent = body.intent;
    if (intent !== "draft" && intent !== "submit") return fail("Choose save draft or submit.");
    if (!body.answers || typeof body.answers !== "object") return fail("Invalid application data.");
    const answers = body.answers;
    answers.email = user.email;
    const parsed = (intent === "submit" ? applicationSchema : draftSchema).safeParse(answers);
    if (!parsed.success) {
      const errors = Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message]));
      return Response.json({ error: "Please check the highlighted answers.", errors }, { status: 400 });
    }
    const saved = await withWriteLock(async () => {
      if (!isAccepting(await getWindow())) return fail("The application window has closed.", 403);
      const existing = await getApplication(user);
      if (existing?.submitted_at) return fail("This application has already been submitted.", 409);
      const record = { user_id: user.id, cycle: CYCLE, answers: parsed.data, updated_at: new Date().toISOString(), submitted_at: intent === "submit" ? new Date().toISOString() : null, reminder_sent_at: intent === "draft" ? existing?.reminder_sent_at ?? null : null };
      if (!isAccepting(await getWindow())) throw new Error("The application window closed before your save completed.");
      await saveApplication(user, record);
      return record;
    });
    if (saved instanceof Response) return saved;
    const emailSent = intent === "submit" ? await sendRecruitingEmail({ to: user.email, subject: "Texas Guadaloop application received", text: `Hi ${saved.answers.name},\n\nYour Spring 2027 Texas Guadaloop application has been received. Your submitted application is read-only.\n\nThank you,\nTexas Guadaloop Recruiting` }) : false;
    return Response.json({ record: saved, message: intent === "submit" ? "Application submitted." : "Draft saved.", emailSent });
  } catch (error) { return fail(error instanceof Error ? error.message : "Could not save your application. Please try again."); }
}
