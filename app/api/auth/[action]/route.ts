import { z } from "zod";
import { firebaseIdentityRequest } from "@/lib/server/firebase";
import { backendReady, testMode } from "@/lib/server/config";
import { startTestSession, clearTestSession, clearFirebaseSession, setFirebaseSession } from "@/lib/server/session";
import { checkOrigin, fail, limitedBody, HttpRequestError } from "@/lib/server/http";
import { runEmailAuth, AuthInputError } from "@/lib/auth-flow";
import { FirebaseIdentityError } from "@/lib/auth-errors";
import { FirebaseConfigurationError, inspectFirebaseConfiguration } from "@/lib/server/firebase-config";
import { AuthSessionError } from "@/lib/session-policy";
import { authActionOrigin } from "@/lib/request-origin";

function configurationFailure() {
  const issues = process.env.NODE_ENV === "development" ? inspectFirebaseConfiguration().issues.join(" ") : "Contact the recruiting team.";
  return fail(`Firebase sign-in setup is incomplete. ${issues}`, 503);
}

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
      if (testMode()) return fail("Local role previews are enabled. Set APPLICATION_TEST_MODE=false to test Firebase sign-in.", 503);
      if (!backendReady()) return configurationFailure();
      const body = JSON.parse(new TextDecoder().decode(await limitedBody(request, 16384)));
      const parsed = z.object({ idToken: z.string().min(1).max(10000) }).safeParse(body);
      if (!parsed.success) return fail("Google sign-in did not return a valid credential.", 400);
      await setFirebaseSession(parsed.data.idToken);
      return Response.json({ redirect: "/apply" });
    }
    if (action === "signout") {
      await clearTestSession();
      await clearFirebaseSession();
      return Response.json({ redirect: "/login" });
    }
    if (!["login", "signup", "forgot", "reset", "resend"].includes(action)) return fail("Not found.", 404);
    if (testMode()) return fail("Local role previews are enabled. Set APPLICATION_TEST_MODE=false to test Firebase sign-in.", 503);
    if (!backendReady()) return configurationFailure();
    const body = JSON.parse(new TextDecoder().decode(await limitedBody(request, 4096)));
    const result = await runEmailAuth(action, body, authActionOrigin(request.url, process.env.APP_ORIGIN, process.env.NODE_ENV === "development"), {
      identity: firebaseIdentityRequest,
      session: setFirebaseSession,
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof HttpRequestError || error instanceof AuthSessionError) return fail(error.message, error.status);
    if (error instanceof AuthInputError || error instanceof FirebaseIdentityError) return fail(error.message);
    if (error instanceof FirebaseConfigurationError) return configurationFailure();
    if (error instanceof SyntaxError) return fail("The request could not be read. Reload the page and try again.");
    // Never return raw Admin SDK messages, which can contain local paths or credentials.
    console.error("[auth] Authentication service failed", { code: typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : "service-unavailable" });
    return fail("The sign-in service is unavailable. Please try again shortly. If it continues, contact the recruiting team.", 503);
  }
}
