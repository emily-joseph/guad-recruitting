import { windowSchema } from "@/lib/recruitment-window";
import { getApplicant } from "@/lib/server/session";
import { getWindow, saveWindow, withWriteLock } from "@/lib/server/store";
import { checkOrigin, fail, limitedBody } from "@/lib/server/http";

export async function GET() {
  try { return Response.json(await getWindow(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return fail("Recruitment settings are temporarily unavailable.", 503); }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (!(await getApplicant())?.admin) return fail("Recruiting administrator access is required.", 403);
    const result = windowSchema.safeParse(JSON.parse(new TextDecoder().decode(await limitedBody(request, 4096))));
    if (!result.success) return fail(result.error.issues[0].message);
    await withWriteLock(() => saveWindow(result.data));
    return Response.json({ message: "Recruitment settings saved." });
  } catch { return fail("Could not save recruitment settings. Please try again."); }
}
