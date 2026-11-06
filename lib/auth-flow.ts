import { z } from "zod";
import { FirebaseIdentityError } from "./auth-errors";
import { isUtEmail, utEmailMessage } from "./ut-email";

type Dependencies = {
  identity: (endpoint: string, body: Record<string, string | boolean>) => Promise<Record<string, unknown>>;
  session: (idToken: string) => Promise<void>;
};
type EmailAuthResult = { redirect: string; message?: never; nextMode?: never } | { redirect?: never; message: string; nextMode?: "login" };
const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(300)).refine(isUtEmail, utEmailMessage);
const passwordSchema = z.string().min(12).max(128);
export class AuthInputError extends Error {}
const resetMessage = "If an account exists for that email, you'll receive a password reset link.";
const verificationMessage = "Check your email to verify your account, then return here to sign in. If it doesn't arrive, check spam or use Resend verification email.";

/** Keep account creation separate from session creation until email is verified. */
export async function runEmailAuth(action: string, body: unknown, origin: string, deps: Dependencies): Promise<EmailAuthResult> {
  if (!["login", "signup", "forgot", "reset", "resend"].includes(action)) throw new AuthInputError("Choose a valid sign-in action.");
  if (action === "reset") {
    const parsed = z.object({ password: passwordSchema, oobCode: z.string().trim().min(1).max(2048) }).safeParse(body);
    if (!parsed.success) throw new AuthInputError("Use a password with 12–128 characters and a valid reset link.");
    await deps.identity("accounts:resetPassword", { oobCode: parsed.data.oobCode, newPassword: parsed.data.password });
    return { redirect: "/login?password=updated" };
  }
  const parsed = z.object({ email: emailSchema }).safeParse(body);
  if (!parsed.success) throw new AuthInputError(utEmailMessage);
  if (action === "forgot") {
    try {
      await deps.identity("accounts:sendOobCode", { requestType: "PASSWORD_RESET", email: parsed.data.email, continueUrl: `${origin}/login` });
    } catch (error) {
      if (!(error instanceof FirebaseIdentityError) || error.code !== "EMAIL_NOT_FOUND") throw error;
    }
    return { message: resetMessage };
  }
  const password = z.object({ password: action === "signup" ? passwordSchema : z.string().min(1).max(128) }).safeParse(body);
  if (!password.success) throw new AuthInputError(action === "signup" ? "Choose a portal password with 12–128 characters." : "Enter your portal password (up to 128 characters). Your UT EID password does not automatically sign you in here.");
  const credentials = { email: parsed.data.email, password: password.data.password, returnSecureToken: true };
  const result = await deps.identity(action === "signup" ? "accounts:signUp" : "accounts:signInWithPassword", credentials);
  if (result.mfaPendingCredential) throw new FirebaseIdentityError("MFA_REQUIRED");
  if (typeof result.idToken !== "string" || !result.idToken.trim()) throw new FirebaseIdentityError("INVALID_ID_TOKEN");
  if (action === "signup" || action === "resend") {
    try {
      await deps.identity("accounts:sendOobCode", { requestType: "VERIFY_EMAIL", idToken: result.idToken, continueUrl: `${origin}/login` });
    } catch (error) {
      if (action !== "signup") throw error;
      // Account creation already succeeded. Retrying signup would only produce
      // EMAIL_EXISTS, so keep the user on the verification recovery path.
      const detail = error instanceof FirebaseIdentityError ? ` ${error.message}` : "";
      return { nextMode: "login" as const, message: `Your account was created, but we couldn't send the verification email.${detail} Use Resend verification email with the portal password you just chose. You must verify your email before signing in.` };
    }
    return { message: verificationMessage, ...(action === "signup" ? { nextMode: "login" as const } : {}) };
  }
  // signInWithPassword does not return emailVerified. Validate the signed token
  // in the Admin SDK, which also enforces UT email, revocation and recent login.
  await deps.session(result.idToken);
  return { redirect: "/apply" };
}
