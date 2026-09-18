import "server-only";

export function testMode() {
  return process.env.NODE_ENV === "development" && process.env.APPLICATION_TEST_MODE === "true";
}
export function backendReady() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
