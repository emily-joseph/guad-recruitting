import { z } from "zod";
import { authClient } from "@/lib/server/supabase";
import { backendReady, testMode } from "@/lib/server/config";
import { startTestSession, clearTestSession, getApplicant } from "@/lib/server/session";
import { checkOrigin, fail, limitedBody } from "@/lib/server/http";

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    checkOrigin(request);
    const { action } = await context.params;
    if (action === "test") {
      if (!testMode()) return fail("Local testing is disabled.", 404);
      await startTestSession();
      return Response.json({ redirect: "/apply" });
    }
    if (action === "signout") {
      await clearTestSession();
      if (!testMode() && backendReady()) await (await authClient()).auth.signOut();
      return Response.json({ redirect: "/login" });
    }
    if (!["login", "signup", "forgot", "reset"].includes(action)) return fail("Not found.", 404);
    if (testMode() || !backendReady()) return fail("Email sign-in will be available once the recruitment portal is connected.", 503);
    const body = JSON.parse(new TextDecoder().decode(await limitedBody(request, 4096)));
    if (action === "forgot") {
      const parsed = z.object({ email: z.email().max(300) }).safeParse(body);
      if (!parsed.success) return fail("Enter a valid email address.");
      const origin = process.env.APP_ORIGIN || new URL(request.url).origin;
      await (await authClient()).auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${origin}/auth/callback` });
      return Response.json({ message: "If an account exists for that email, you’ll receive a password reset link. Open it in this browser." });
    }
    if (action === "reset") {
      if (!(await getApplicant())) return fail("Open the password reset link in your email first.", 401);
      const parsed = z.object({ password: z.string().min(12).max(128) }).safeParse(body);
      if (!parsed.success) return fail("Use a password with 12–128 characters.");
      const { error } = await (await authClient()).auth.updateUser(parsed.data);
      if (error) return fail("Could not update your password. Request a new reset link and try again.");
      return Response.json({ redirect: "/apply" });
    }
    const parsed = z.object({ email: z.email().max(300), password: z.string().min(action === "signup" ? 12 : 1).max(128) }).safeParse(body);
    if (!parsed.success) return fail("Enter a valid email and password. New passwords must have at least 12 characters.");
    const client = await authClient();
    if (action === "signup") {
      const { error } = await client.auth.signUp(parsed.data);
      if (error) return fail("We couldn't create an account. Try again later or sign in if you already have one.");
      return Response.json({ message: "Check your email to confirm your account, then return here to sign in." });
    }
    const { error } = await client.auth.signInWithPassword(parsed.data);
    if (error) return fail("Unable to sign in. Check your email and password, and confirm your email first.", 401);
    return Response.json({ redirect: "/apply" });
  } catch { return fail("We couldn't complete that request. Please try again."); }
}
