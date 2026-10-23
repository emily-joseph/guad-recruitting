import { z } from "zod";
import { firebaseIdentityRequest } from "@/lib/server/firebase";
import { backendReady, testMode } from "@/lib/server/config";
import { startTestSession, clearTestSession, clearFirebaseSession, setFirebaseSession } from "@/lib/server/session";
import { checkOrigin, fail, limitedBody } from "@/lib/server/http";
import { isUtEmail, utEmailMessage } from "@/lib/ut-email";

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    checkOrigin(request);
    const { action } = await context.params;
    if (action === "test") {
      if (!testMode()) return fail("Local testing is disabled.", 404);
      const raw = await limitedBody(request, 2000);
      const body = raw.length ? JSON.parse(new TextDecoder().decode(raw)) : {};
      const parsed = z.object({ role: z.enum(["applicant", "viewer", "recruiter", "group_interviewer", "one_on_one_interviewer", "lead"]).default("lead") }).safeParse(body);
      if (!parsed.success) return fail("Choose a valid local preview role.");
      await startTestSession(parsed.data.role);
      return Response.json({ redirect: "/apply" });
    }
    if (action === "google") {
      if (testMode() || !backendReady()) return fail("Google sign-in is not configured yet.", 503);
      const body = JSON.parse(new TextDecoder().decode(await limitedBody(request, 4096)));
      const parsed = z.object({ idToken: z.string().min(1).max(10000) }).safeParse(body);
      if (!parsed.success) return fail("Google sign-in did not return a valid credential.", 400);
      try { await setFirebaseSession(parsed.data.idToken); }
      catch (error) { return fail(error instanceof Error ? error.message : "This Google account cannot access the portal.", 403); }
      return Response.json({ redirect: "/apply" });
    }
    if (action === "signout") {
      await clearTestSession();
      await clearFirebaseSession();
      return Response.json({ redirect: "/login" });
    }
    if (!["login", "signup", "forgot", "reset"].includes(action)) return fail("Not found.", 404);
    if (testMode() || !backendReady()) return fail("Email sign-in will be available once the recruitment portal is connected.", 503);
    const body = JSON.parse(new TextDecoder().decode(await limitedBody(request, 4096)));
    if (action === "forgot") {
      const parsed = z.object({ email: z.email().max(300) }).safeParse(body);
      if (!parsed.success) return fail("Enter a valid email address.");
      if (!isUtEmail(parsed.data.email)) return fail(utEmailMessage);
      await firebaseIdentityRequest("accounts:sendOobCode", { requestType: "PASSWORD_RESET", email: parsed.data.email });
      return Response.json({ message: "If an account exists for that email, you’ll receive a password reset link. Open it in this browser." });
    }
    if (action === "reset") {
      const parsed = z.object({ password: z.string().min(12).max(128), oobCode: z.string().min(1) }).safeParse(body);
      if (!parsed.success) return fail("Use a password with 12–128 characters.");
      await firebaseIdentityRequest("accounts:resetPassword", { oobCode: parsed.data.oobCode, newPassword: parsed.data.password });
      return Response.json({ redirect: "/login?password=updated" });
    }
    const parsed = z.object({ email: z.email().max(300), password: z.string().min(action === "signup" ? 12 : 1).max(128) }).safeParse(body);
    if (!parsed.success) return fail("Enter a valid email and password. New passwords must have at least 12 characters.");
    if (!isUtEmail(parsed.data.email)) return fail(utEmailMessage);
    const origin = process.env.APP_ORIGIN || new URL(request.url).origin;
    if (action === "signup") {
      const created = await firebaseIdentityRequest("accounts:signUp", { ...parsed.data, returnSecureToken: "true" });
      await firebaseIdentityRequest("accounts:sendOobCode", { requestType: "VERIFY_EMAIL", idToken: String(created.idToken), continueUrl: `${origin}/auth/callback` });
      return Response.json({ message: "Check your email to confirm your account, then return here to sign in." });
    }
    const signedIn = await firebaseIdentityRequest("accounts:signInWithPassword", { ...parsed.data, returnSecureToken: "true" });
    if (signedIn.emailVerified !== true) return fail("Confirm your email from the link we sent before signing in.", 401);
    await setFirebaseSession(String(signedIn.idToken));
    return Response.json({ redirect: "/apply" });
  } catch { return fail("We couldn't complete that request. Please try again."); }
}
