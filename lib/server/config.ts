import "server-only";
import { inspectFirebaseConfiguration } from "./firebase-config";

export function testMode() {
  return process.env.NODE_ENV === "development" && process.env.APPLICATION_TEST_MODE === "true";
}
export function backendReady() {
  return Boolean(inspectFirebaseConfiguration().config);
}
