import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function app() {
  const existing = getApps()[0];
  if (existing) return existing;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const rawAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const accountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!projectId || (!rawAccount && !accountPath)) throw new Error("Firebase server configuration is missing.");
  let serviceAccount: Record<string, string>;
  try {
    const accountJson = rawAccount ?? readFileSync(path.resolve(process.cwd(), accountPath!), "utf8");
    serviceAccount = JSON.parse(accountJson) as Record<string, string>;
  } catch { throw new Error("Could not read the Firebase service account. Check its JSON file or environment value."); }
  return initializeApp({ credential: cert({ ...serviceAccount, projectId }), projectId });
}

export function firebaseAuth() { return getAuth(app()); }
export function firestore() { return getFirestore(app()); }

export async function firebaseIdentityRequest(endpoint: string, body: Record<string, string>) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("Firebase web API key is missing.");
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store",
  });
  const result = await response.json() as { error?: { message?: string }; [key: string]: unknown };
  if (!response.ok) throw new Error(result.error?.message ?? "Firebase authentication failed.");
  return result;
}
