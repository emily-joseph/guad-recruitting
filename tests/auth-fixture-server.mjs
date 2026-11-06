import { generateKeyPairSync } from "node:crypto";

// Ephemeral credentials belong to no Firebase project and grant no access.
// Browser tests intercept auth requests; validation tests stop before Firebase.
const projectId = "demo-guad-auth-tests";
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
Object.assign(process.env, {
  APPLICATION_TEST_MODE: "false",
  AUTH_BROWSER_TESTS: "true",
  APP_ORIGIN: "http://localhost:3101",
  NEXT_PUBLIC_FIREBASE_API_KEY: "fake-api-key-for-auth-browser-tests",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: projectId,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${projectId}.firebaseapp.com`,
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:1234567890:web:auth-browser-tests",
  FIREBASE_PROJECT_ID: projectId,
  FIREBASE_SERVICE_ACCOUNT_PATH: "",
  FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: projectId, client_email: `test@${projectId}.iam.gserviceaccount.com`, private_key: privateKey }),
  NEXT_TELEMETRY_DISABLED: "1",
});
process.argv = [process.execPath, "next", "dev", "--port", "3101"];
await import("../node_modules/next/dist/bin/next");
