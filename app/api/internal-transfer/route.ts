import { z } from "zod";
import { teams } from "@/lib/application-schema";
import { getApplicant } from "@/lib/server/session";
import { getInternalTransferWindow, saveInternalTransfer } from "@/lib/server/store";
import { checkOrigin, fail, limitedBody } from "@/lib/server/http";
const schema = z.object({ currentTeam: z.enum(teams), team1: z.enum(teams), team2: z.enum(teams), reason: z.string().min(1).max(5000) }).refine(value => value.team1 !== value.team2, "Choose two different destination teams.");
export async function POST(request: Request) { try { checkOrigin(request); const user = await getApplicant(); if (!user) return fail("Sign in first.", 401); const parsed = schema.safeParse(JSON.parse(new TextDecoder().decode(await limitedBody(request, 8000)))); if (!parsed.success) return fail(parsed.error.issues[0].message); const window = await getInternalTransferWindow(); if (window.mode === "closed" || (window.mode === "scheduled" && !(Date.now() >= Date.parse(window.opensAt ?? "") && Date.now() < Date.parse(window.closesAt ?? "")))) return fail("Internal transfers are currently closed.", 403); await saveInternalTransfer(user.id, { ...parsed.data, email: user.email }); return Response.json({ message: "Internal transfer submitted." }); } catch (error) { return fail(error instanceof Error ? error.message : "Could not submit the transfer."); } }
