import "server-only";
import { cookies } from "next/headers";
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { firebaseAuth, firestore } from "./firebase";
import { backendReady, testMode } from "./config";
import { isUtEmail } from "../ut-email";
import { isInvalidFirebaseSession, normalizeSessionError, recruitingPermissions, validateSessionClaims, type RecruitingRole } from "../session-policy";

export type { RecruitingRole } from "../session-policy";
export type TestRole = "applicant" | "viewer" | RecruitingRole | "lead";
export type Applicant = { id: string; email: string; admin: boolean; editor: boolean; member: boolean; groupInterviewer: boolean; oneOnOneInterviewer: boolean; test: boolean; previewRole?: TestRole };
const globals = globalThis as typeof globalThis & { guadTestSecret?: string };
function signature(value: string) {
  globals.guadTestSecret ??= randomBytes(32).toString("hex");
  return createHmac("sha256", globals.guadTestSecret).update(value).digest("hex");
}
const testRoles: TestRole[] = ["applicant", "viewer", "recruiter", "group_interviewer", "one_on_one_interviewer", "lead"];
export async function startTestSession(role: TestRole = "lead") {
  if (!testMode()) throw new Error("Local testing is disabled.");
  if (!testRoles.includes(role)) throw new Error("Choose a valid local preview role.");
  const value = `${randomBytes(16).toString("hex")}.${Date.now() + 86400000}.${role}`;
  (await cookies()).set("guad-test", `${value}.${signature(value)}`, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 86400 });
}
export async function clearTestSession() { (await cookies()).delete("guad-test"); }
export async function setFirebaseSession(idToken: string) {
  // Initialize outside the credential-error handler: invalid server credentials
  // must not be reported as an invalid user token.
  const auth = firebaseAuth();
  let session: string;
  try {
    const decoded = await auth.verifyIdToken(idToken, true);
    validateSessionClaims(decoded);
    session = await auth.createSessionCookie(idToken, { expiresIn: 5 * 24 * 60 * 60 * 1000 });
  } catch (error) { throw normalizeSessionError(error) ?? error; }
  (await cookies()).set("guad-session", session, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 5 * 24 * 60 * 60 });
}
export async function clearFirebaseSession() { (await cookies()).delete("guad-session"); }
export async function getApplicant(): Promise<Applicant | null> {
  if (testMode()) {
    const token = (await cookies()).get("guad-test")?.value ?? "";
    const [id, expires, role, mac] = token.split(".");
    if (!/^[a-f0-9]{32}$/.test(id ?? "") || !/^[a-f0-9]{64}$/.test(mac ?? "") || !testRoles.includes(role as TestRole) || Number(expires) < Date.now() || !Number.isFinite(Number(expires))) return null;
    if (!timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(signature(`${id}.${expires}.${role}`), "hex"))) return null;
    return { id, email: `tester+${role}@example.com`, admin: role === "lead", editor: role === "lead" || role === "recruiter", member: role !== "applicant", groupInterviewer: role === "lead" || role === "recruiter" || role === "group_interviewer", oneOnOneInterviewer: role === "lead" || role === "recruiter" || role === "one_on_one_interviewer", test: true, previewRole: role as TestRole };
  }
  if (!backendReady()) return null;
  const sessionCookie = (await cookies()).get("guad-session")?.value;
  if (!sessionCookie) return null;
  const auth = firebaseAuth();
  let user: Awaited<ReturnType<ReturnType<typeof firebaseAuth>["getUser"]>>;
  try {
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    user = await auth.getUser(decoded.uid);
  } catch (error) {
    if (isInvalidFirebaseSession(error)) return null;
    throw error;
  }
  if (user.disabled || !user.email || !user.emailVerified || !isUtEmail(user.email)) return null;
  const admins = (process.env.RECRUITING_ADMIN_EMAILS ?? "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
  const email = user.email.toLowerCase();
  const admin = admins.includes(email);
  const role = admin ? undefined : (await firestore().collection("recruiting_member_access").doc(email).get()).data()?.role;
  return { id: user.uid, email: user.email, ...recruitingPermissions(admin, role), test: false };
}
