import { z } from "zod";
import { getApplicant } from "@/lib/server/session";
import { checkOrigin, fail, limitedBody } from "@/lib/server/http";
import { getInterviewAvailability, saveInterviewAvailability } from "@/lib/server/store";
const schema = z.object({ slots: z.array(z.object({ start: z.iso.datetime({ offset: true }), end: z.iso.datetime({ offset: true }) })).max(20) }).refine(value => value.slots.every(slot => Date.parse(slot.start) < Date.parse(slot.end)), "Each availability end must be after its start.");
export async function GET() { try { const user = await getApplicant(); if (!user) return fail("Sign in first.", 401); return Response.json({ slots: await getInterviewAvailability(user.id) }); } catch { return fail("Could not load availability.", 503); } }
export async function POST(request: Request) { try { checkOrigin(request); const user = await getApplicant(); if (!user) return fail("Sign in first.", 401); const parsed = schema.safeParse(JSON.parse(new TextDecoder().decode(await limitedBody(request, 12000)))); if (!parsed.success) return fail(parsed.error.issues[0].message); await saveInterviewAvailability(user.id, parsed.data.slots); return Response.json({ message: "Availability saved." }); } catch (error) { return fail(error instanceof Error ? error.message : "Could not save availability."); } }
