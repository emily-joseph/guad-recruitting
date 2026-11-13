import { readFileSync } from "node:fs";
import { createPrivateKey } from "node:crypto";
import path from "node:path";

type Environment = Record<string, string | undefined>;
export type FirebaseConfiguration = {
  projectId: string;
  serviceAccount: { projectId: string; clientEmail: string; privateKey: string };
};

/** Checks local configuration without making requests or exposing credential values. */
export function inspectFirebaseConfiguration(env: Environment = process.env, cwd = process.cwd()): { issues: string[]; config?: FirebaseConfiguration } {
  const issues: string[] = [];
  for (const key of ["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_APP_ID", "FIREBASE_PROJECT_ID"]) {
    if (!env[key]?.trim()) issues.push(`Set ${key} in .env.local.`);
    else if (env[key] !== env[key].trim()) issues.push(`Remove surrounding whitespace from ${key}.`);
  }
  const projectId = env.FIREBASE_PROJECT_ID?.trim() ?? "";
  if (projectId && env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() && projectId !== env.NEXT_PUBLIC_FIREBASE_PROJECT_ID.trim()) {
    issues.push("FIREBASE_PROJECT_ID and NEXT_PUBLIC_FIREBASE_PROJECT_ID must use the same Firebase project.");
  }
  if (env.APP_ORIGIN) {
    try {
      const origin = new URL(env.APP_ORIGIN);
      if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error();
    } catch { issues.push("APP_ORIGIN must be an http:// or https:// origin without a path, query, or credentials."); }
  }
  let account: Record<string, unknown> | undefined;
  const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const filename = env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (!raw && !filename) {
    issues.push("Set FIREBASE_SERVICE_ACCOUNT_PATH to your downloaded service-account JSON file, or set FIREBASE_SERVICE_ACCOUNT_JSON.");
  } else {
    let json = raw;
    if (!json) {
      try { json = readFileSync(path.resolve(/* turbopackIgnore: true */ cwd, filename!), "utf8"); }
      catch { issues.push("The file specified by FIREBASE_SERVICE_ACCOUNT_PATH does not exist or cannot be read. Save the Firebase service-account JSON at that path."); }
    }
    if (json) {
      try {
        const parsed: unknown = JSON.parse(json.replace(/^\uFEFF/, ""));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
        account = parsed as Record<string, unknown>;
      } catch { issues.push("The Firebase service account must contain valid JSON. Use the downloaded service-account key, not the web app configuration."); }
    }
  }
  if (account) {
    if (account.project_id !== projectId) issues.push("The Firebase service-account key belongs to a different project than FIREBASE_PROJECT_ID.");
    if (typeof account.client_email !== "string" || !account.client_email.includes("@")) issues.push("The Firebase service-account JSON is missing client_email.");
    try {
      if (typeof account.private_key !== "string" || createPrivateKey(account.private_key).asymmetricKeyType !== "rsa") throw new Error();
    } catch { issues.push("The Firebase service-account JSON is missing a valid RSA private_key. Download a service-account key from Firebase Project settings > Service accounts."); }
  }
  if (issues.length || !account) return { issues };
  return { issues, config: { projectId, serviceAccount: { projectId, clientEmail: account.client_email as string, privateKey: account.private_key as string } } };
}

export class FirebaseConfigurationError extends Error {
  constructor() { super("Firebase server setup is incomplete. Contact the recruiting team."); }
}
