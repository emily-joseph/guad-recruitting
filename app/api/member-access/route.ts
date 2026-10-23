import { z } from "zod";
import { getApplicant } from "@/lib/server/session";
import { getMemberAccess, updateMemberAccess } from "@/lib/server/store";
import { checkOrigin, fail, limitedBody } from "@/lib/server/http";
import { isUtEmail, utEmailMessage } from "@/lib/ut-email";

const bodySchema = z.object({ emails: z.array(z.email("Enter a valid UT email.").transform(value => value.toLowerCase())).min(1).max(200), action: z.enum(["grant", "revoke"]), role: z.enum(["viewer", "recruiter", "group_interviewer", "one_on_one_interviewer"]).default("viewer") });
export async function GET() {
  try {
    if (!(await getApplicant())?.admin) return fail("Recruiting lead access is required.", 403);
    return Response.json({ members: await getMemberAccess() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return fail(error instanceof Error ? error.message : "Could not load member access.", 503); }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const lead = await getApplicant();
    if (!lead?.admin) return fail("Recruiting lead access is required.", 403);
    const parsed = bodySchema.safeParse(JSON.parse(new TextDecoder().decode(await limitedBody(request, 4096))));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const { emails, action, role } = parsed.data;
    if (!emails.every(isUtEmail)) return fail(utEmailMessage);
    await Promise.all(emails.map(email => updateMemberAccess(lead, email, action, role)));
    return Response.json({ message: action === "grant" ? `${emails.length} member${emails.length === 1 ? "" : "s"} invited with ${role.replaceAll("_", " ")} access.` : `${emails.length} member${emails.length === 1 ? "" : "s"} removed from recruiting access.` });
  } catch (error) { return fail(error instanceof Error ? error.message : "Could not update member access."); }
}
