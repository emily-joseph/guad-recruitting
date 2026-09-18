import { applicationSchema, draftSchema, MAX_FILE_SIZE, validatePdf } from "@/lib/application-schema";
import { CYCLE, isAccepting } from "@/lib/recruitment-window";
import { getApplicant } from "@/lib/server/session";
import { getWindow, getApplication, saveApplication, saveAttachment, removeAttachment, withWriteLock, type Attachment } from "@/lib/server/store";
import { checkOrigin, fail, limitedBody } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await getApplicant();
    if (!user) return fail("Your session expired. Sign in again before saving.", 401);
    if (Number(request.headers.get("content-length")) > 11 * 1024 * 1024) return fail("Files are too large.", 413);
    if (!isAccepting(await getWindow())) return fail("Applications are closed. Your saved draft is still available.", 403);
    const body = await limitedBody(request, 11 * 1024 * 1024);
    const form = await new Response(body, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
    const intent = form.get("intent");
    if (intent !== "draft" && intent !== "submit") return fail("Choose save draft or submit.");
    if (typeof form.get("answers") !== "string" || String(form.get("answers")).length > 65000) return fail("Invalid application data.");
    const answers = JSON.parse(String(form.get("answers")));
    answers.email = user.email;
    const parsed = (intent === "submit" ? applicationSchema : draftSchema).safeParse(answers);
    if (!parsed.success) {
      const errors = Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message]));
      return Response.json({ error: "Please check the highlighted answers.", errors }, { status: 400 });
    }
    const uploads: { kind: "resume" | "portfolio"; file: File; bytes: Uint8Array }[] = [];
    for (const kind of ["resume", "portfolio"] as const) {
      const file = form.get(kind);
      if (file instanceof File && file.size) {
        if (file.size > MAX_FILE_SIZE) return fail("Each PDF must be 5 MB or smaller.");
        const bytes = new Uint8Array(await file.arrayBuffer());
        const error = validatePdf(file.name, bytes);
        if (error) return fail(`${kind === "resume" ? "Resume" : "Portfolio"}: ${error}`);
        uploads.push({ kind, file, bytes });
      }
    }
    return await withWriteLock(async () => {
      if (!isAccepting(await getWindow())) return fail("The application window has closed.", 403);
      const existing = await getApplication(user);
      if (existing?.submitted_at) return fail("This application has already been submitted.", 409);
      if (intent === "submit" && !existing?.resume && !uploads.some(upload => upload.kind === "resume")) {
        return Response.json({ error: "Please attach your resume.", errors: { resume: "A resume PDF is required." } }, { status: 400 });
      }
      const added: Attachment[] = [];
      const replaced: Attachment[] = [];
      const record = { user_id: user.id, cycle: CYCLE, answers: parsed.data, resume: existing?.resume ?? null, portfolio: existing?.portfolio ?? null, updated_at: new Date().toISOString(), submitted_at: intent === "submit" ? new Date().toISOString() : null };
      try {
        for (const upload of uploads) {
          if (record[upload.kind]) replaced.push(record[upload.kind]!);
          const attachment = await saveAttachment(user, upload.file, upload.bytes);
          added.push(attachment);
          record[upload.kind] = attachment;
        }
        if (!isAccepting(await getWindow())) throw new Error("The application window closed before your save completed.");
        await saveApplication(user, record);
      } catch (error) {
        await Promise.allSettled(added.map(file => removeAttachment(user, file)));
        throw error;
      }
      await Promise.allSettled(replaced.map(file => removeAttachment(user, file)));
      return Response.json({ record, message: intent === "submit" ? "Application submitted." : "Draft saved." });
    });
  } catch (error) { return fail(error instanceof Error ? error.message : "Could not save your application. Please try again."); }
}
