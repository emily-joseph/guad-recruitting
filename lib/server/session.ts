import "server-only";
import { cookies } from "next/headers";
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { authClient } from "./supabase";
import { backendReady, testMode } from "./config";

export type Applicant = { id: string; email: string; admin: boolean; test: boolean };
const globals = globalThis as typeof globalThis & { guadTestSecret?: string };
function signature(value: string) {
  globals.guadTestSecret ??= randomBytes(32).toString("hex");
  return createHmac("sha256", globals.guadTestSecret).update(value).digest("hex");
}
export async function startTestSession() {
  if (!testMode()) throw new Error("Local testing is disabled.");
  const value = `${randomBytes(16).toString("hex")}.${Date.now() + 86400000}`;
  (await cookies()).set("guad-test", `${value}.${signature(value)}`, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 86400 });
}
export async function clearTestSession() { (await cookies()).delete("guad-test"); }
export async function getApplicant(): Promise<Applicant | null> {
  if (testMode()) {
    const token = (await cookies()).get("guad-test")?.value ?? "";
    const [id, expires, mac] = token.split(".");
    if (!/^[a-f0-9]{32}$/.test(id ?? "") || !/^[a-f0-9]{64}$/.test(mac ?? "") || Number(expires) < Date.now() || !Number.isFinite(Number(expires))) return null;
    if (!timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(signature(`${id}.${expires}`), "hex"))) return null;
    return { id, email: "tester@example.com", admin: true, test: true };
  }
  if (!backendReady()) return null;
  const { data: { user } } = await (await authClient()).auth.getUser();
  if (!user?.email || !user.email_confirmed_at) return null;
  const admins = (process.env.RECRUITING_ADMIN_EMAILS ?? "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
  return { id: user.id, email: user.email, admin: admins.includes(user.email.toLowerCase()), test: false };
}
