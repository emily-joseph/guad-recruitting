import "server-only";

export function testMode() {
  return process.env.NODE_ENV === "development" && process.env.APPLICATION_TEST_MODE === "true";
}
export function backendReady() {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN && process.env.NEXT_PUBLIC_FIREBASE_APP_ID && process.env.FIREBASE_PROJECT_ID && (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
}
