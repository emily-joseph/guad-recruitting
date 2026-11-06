import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { FirebaseIdentityError } from "../auth-errors";
import { FirebaseConfigurationError, inspectFirebaseConfiguration } from "./firebase-config";

function app() {
  const { config } = inspectFirebaseConfiguration();
  if (!config) throw new FirebaseConfigurationError();
  const existing = getApps().find(app => app.name === "[DEFAULT]" && app.options.projectId === config.projectId);
  if (existing) return existing;
  return initializeApp({ credential: cert(config.serviceAccount), projectId: config.projectId });
}

export function firebaseAuth() { return getAuth(app()); }
export function firestore() { return getFirestore(app()); }

export async function firebaseIdentityRequest(endpoint: string, body: Record<string, string | boolean>) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("Firebase web API key is missing.");
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  const result = await response.json() as { error?: { message?: string }; [key: string]: unknown };
  if (!response.ok) throw new FirebaseIdentityError(result.error?.message ?? "UNKNOWN");
  return result;
}
