import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { inspectFirebaseConfiguration } from "../lib/server/firebase-config";
import { authActionOrigin, isAllowedOrigin } from "../lib/request-origin";

const privateKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ format: "pem", type: "pkcs8" }).toString();
const account = { project_id: "test-project", client_email: "test@test-project.iam.gserviceaccount.com", private_key: privateKey };
const env = { NEXT_PUBLIC_FIREBASE_API_KEY: "test-key", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "test-project", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "test-project.firebaseapp.com", NEXT_PUBLIC_FIREBASE_APP_ID: "test-app", FIREBASE_PROJECT_ID: "test-project", FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(account) };

test("missing service-account file prevents false ready state without revealing credentials", () => {
  const result = inspectFirebaseConfiguration({ ...env, FIREBASE_SERVICE_ACCOUNT_JSON: "", FIREBASE_SERVICE_ACCOUNT_PATH: ".secrets/nonexistent-test-key.jsons" });
  assert.equal(result.config, undefined);
  assert.match(result.issues.join(" "), /does not exist/);
  assert.ok(!result.issues.join(" ").includes(privateKey));
});
test("matching Firebase project and valid key are ready", () => {
  const result = inspectFirebaseConfiguration(env);
  assert.deepEqual(result.issues, []);
  assert.equal(result.config?.projectId, "test-project");
});
test("reject invalid JSON, wrong project, empty and invalid keys", () => {
  for (const raw of ["{", "null", "[]", JSON.stringify({ ...account, project_id: "wrong-project" }), JSON.stringify({ ...account, private_key: "not a key" }), JSON.stringify({ ...account, client_email: "" })]) {
    assert.equal(inspectFirebaseConfiguration({ ...env, FIREBASE_SERVICE_ACCOUNT_JSON: raw }).config, undefined);
  }
  assert.equal(inspectFirebaseConfiguration({ ...env, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "another-project" }).config, undefined);
});
test("inline credentials take precedence; blank inline credentials fall back to file", () => {
  assert.ok(inspectFirebaseConfiguration({ ...env, FIREBASE_SERVICE_ACCOUNT_PATH: "missing-file.json" }).config);
  assert.equal(inspectFirebaseConfiguration({ ...env, FIREBASE_SERVICE_ACCOUNT_JSON: "  ", FIREBASE_SERVICE_ACCOUNT_PATH: "missing-file.json" }).config, undefined);
});
test("environment diagnostics accept a trailing slash but reject path or malformed origins", () => {
  assert.ok(inspectFirebaseConfiguration({ ...env, APP_ORIGIN: "http://localhost:3000/" }).config);
  for (const APP_ORIGIN of ["localhost:3000", "https://example.com/login", "https://user:password@example.com", "https://example.com?query=1"]) {
    assert.equal(inspectFirebaseConfiguration({ ...env, APP_ORIGIN }).config, undefined);
  }
});
test("origin check supports current localhost dev port without allowing cross-site requests", () => {
  assert.equal(isAllowedOrigin("http://localhost:3001/api/auth/login", "http://localhost:3001", "http://localhost:3000", true), true);
  assert.equal(isAllowedOrigin("http://127.0.0.1:3000/api/auth/login", "http://127.0.0.1:3000", "http://localhost:3000", true), true);
  assert.equal(isAllowedOrigin("http://localhost:3001/api/auth/login", "https://attacker.example", "http://localhost:3000", true), false);
  assert.equal(isAllowedOrigin("http://localhost:3001/api/auth/login", null, "http://localhost:3000", true), false);
  assert.equal(isAllowedOrigin("http://localhost:3001/api/auth/login", "null", "http://localhost:3000", true), false);
  assert.equal(isAllowedOrigin("http://localhost:3001/api/auth/login", "http://localhost:3001", "http://localhost:3000", false), false);
  assert.equal(isAllowedOrigin("http://internal:3000/api/auth/login", "https://portal.example", "https://portal.example/", false), true);
});
test("email links return to the active local dev port and configured production origin", () => {
  assert.equal(authActionOrigin("http://localhost:3001/api/auth/signup", "http://localhost:3000", true), "http://localhost:3001");
  assert.equal(authActionOrigin("http://internal:3000/api/auth/signup", "https://portal.example/", false), "https://portal.example");
});
