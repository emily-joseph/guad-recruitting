import { getApplicant } from "@/lib/server/session";
import { getApplication, readAttachment } from "@/lib/server/store";
import { fail } from "@/lib/server/http";

export async function GET(_request: Request, context: { params: Promise<{ kind: string }> }) {
  const user = await getApplicant();
  if (!user) return fail("Sign in to download your files.", 401);
  const { kind } = await context.params;
  if (kind !== "resume" && kind !== "portfolio") return fail("Not found.", 404);
  try {
    const attachment = (await getApplication(user))?.[kind];
    if (!attachment) return fail("File not found.", 404);
    const bytes = await readAttachment(user, attachment);
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${attachment.name}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return fail("Could not download this file. Please try again.", 500); }
}
