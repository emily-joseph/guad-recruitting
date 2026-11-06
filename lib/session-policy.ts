import { isUtEmail } from "./ut-email";

export type RecruitingRole = "viewer" | "recruiter" | "group_interviewer" | "one_on_one_interviewer";
type SessionErrorCode = "school-email-required" | "email-unverified" | "recent-login-required" | "invalid-credential" | "account-disabled";

/** These messages are safe to return to the browser, unlike raw Admin SDK errors. */
export class AuthSessionError extends Error {
  constructor(public readonly code: SessionErrorCode, message: string, public readonly status: 401 | 403 = 403) {
    super(message);
    this.name = "AuthSessionError";
  }
}

type SessionClaims = { email?: unknown; email_verified?: unknown; auth_time?: unknown };

/** Call only after Firebase has verified the token's signature and revocation. */
export function validateSessionClaims(claims: SessionClaims, nowSeconds = Date.now() / 1000) {
  if (typeof claims.email !== "string" || !isUtEmail(claims.email)) {
    throw new AuthSessionError("school-email-required", "Use your @utexas.edu or @my.utexas.edu account to access the portal.");
  }
  if (claims.email_verified !== true) {
    throw new AuthSessionError("email-unverified", "Verify your email address before signing in.");
  }
  // Allow a minute of clock skew, but never treat a missing or nonnumeric claim
  // as recent authentication. Token refresh does not update auth_time.
  if (typeof claims.auth_time !== "number" || !Number.isFinite(claims.auth_time) || !Number.isFinite(nowSeconds)
    || nowSeconds - claims.auth_time > 300 || claims.auth_time > nowSeconds + 60) {
    throw new AuthSessionError("recent-login-required", "Please sign in again to start a new session.", 401);
  }
}

const invalidCredentialCodes = new Set([
  "auth/argument-error", "auth/invalid-argument", "auth/invalid-id-token",
  "auth/id-token-expired", "auth/id-token-revoked",
  "auth/session-cookie-expired", "auth/session-cookie-revoked", "auth/user-not-found",
]);

/** Unknown/network/configuration errors must remain errors, not a logged-out user. */
export function normalizeSessionError(error: unknown): AuthSessionError | null {
  if (error instanceof AuthSessionError) return error;
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  if (error.code === "auth/user-disabled") {
    return new AuthSessionError("account-disabled", "This account has been disabled. Contact the recruiting team.");
  }
  if (typeof error.code === "string" && invalidCredentialCodes.has(error.code)) {
    return new AuthSessionError("invalid-credential", "Your sign-in has expired or is no longer valid. Please sign in again.", 401);
  }
  return null;
}

export function isInvalidFirebaseSession(error: unknown) {
  return normalizeSessionError(error) !== null;
}

export function recruitingPermissions(admin: boolean, storedRole: unknown) {
  const role: RecruitingRole | undefined = storedRole === "viewer" || storedRole === "recruiter"
    || storedRole === "group_interviewer" || storedRole === "one_on_one_interviewer" ? storedRole : undefined;
  return {
    admin,
    editor: admin || role === "recruiter",
    member: admin || role !== undefined,
    groupInterviewer: admin || role === "recruiter" || role === "group_interviewer",
    oneOnOneInterviewer: admin || role === "recruiter" || role === "one_on_one_interviewer",
  };
}
