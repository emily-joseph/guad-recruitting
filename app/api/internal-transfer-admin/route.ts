import { z } from "zod";
import { windowSchema } from "@/lib/recruitment-window";
import { getApplicant } from "@/lib/server/session";
import { getInternalTransfers, getInternalTransferWindow, reviewInternalTransfer, saveInternalTransferWindow } from "@/lib/server/store";
import { checkOrigin, fail, limitedBody } from "@/lib/server/http";

const reviewSchema = z.object({ action: z.literal("review"), userId: z.string().uuid(), decision: z.enum(["pending", "approved", "declined"]), notes: z.string().max(5000) });
const windowUpdateSchema = windowSchema.extend({ action: z.literal("window") });

export async function GET() {
  try {
    const user = await getApplicant();
    if (!user?.admin) return fail("Recruiting lead access is required.", 403);
    const [window, transfers] = await Promise.all([getInternalTransferWindow(), getInternalTransfers()]);
    return Response.json({ window, transfers });
  } catch (error) { return fail(error instanceof Error ? error.message : "Could not load transfer requests."); }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await getApplicant();
    if (!user?.admin) return fail("Recruiting lead access is required.", 403);
    const body = JSON.parse(new TextDecoder().decode(await limitedBody(request, 12000)));
    if (body?.action === "review") {
      const parsed = reviewSchema.safeParse(body);
      if (!parsed.success) return fail(parsed.error.issues[0].message);
      await reviewInternalTransfer(parsed.data.userId, parsed.data.decision, parsed.data.notes.trim());
      return Response.json({ message: "Transfer review saved." });
    }
    const parsed = windowUpdateSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const window = { mode: parsed.data.mode, opensAt: parsed.data.opensAt, closesAt: parsed.data.closesAt };
    await saveInternalTransferWindow(window);
    return Response.json({ message: "Internal transfer window saved." });
  } catch (error) { return fail(error instanceof Error ? error.message : "Could not save transfer settings."); }
}
