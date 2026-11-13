import test from "node:test";
import assert from "node:assert/strict";
import { AuthSessionError, isInvalidFirebaseSession, normalizeSessionError, recruitingPermissions, validateSessionClaims } from "../lib/session-policy";

const now = 1_800_000_000;
const verifiedClaims = { email: "student@my.utexas.edu", email_verified: true, auth_time: now };

test("verified UT identities can start sessions only with recent authentication", () => {
  for (const email of ["student@my.utexas.edu", "Student@utexas.edu"]) {
    for (const auth_time of [now, now - 299, now - 300, now + 30]) {
      assert.doesNotThrow(() => validateSessionClaims({ ...verifiedClaims, email, auth_time }, now));
    }
  }
});

test("school address policy rejects missing, unrelated and lookalike identities", () => {
  for (const email of [undefined, null, 123, "", "student@gmail.com", "student@utexas.edu.attacker.com", "student@notutexas.edu"]) {
    assert.throws(() => validateSessionClaims({ ...verifiedClaims, email }, now), error => {
      assert.ok(error instanceof AuthSessionError);
      assert.equal(error.code, "school-email-required");
      assert.equal(error.status, 403);
      return true;
    });
  }
});

test("email verification requires a true boolean claim", () => {
  for (const email_verified of [undefined, null, false, "true", 1]) {
    assert.throws(() => validateSessionClaims({ ...verifiedClaims, email_verified }, now), { code: "email-unverified" });
  }
});

test("stale, missing, nonfinite, nonnumeric and future auth times cannot create sessions", () => {
  for (const auth_time of [now - 301, undefined, null, NaN, Infinity, -Infinity, String(now), now + 61]) {
    assert.throws(() => validateSessionClaims({ ...verifiedClaims, auth_time }, now), { code: "recent-login-required", status: 401 });
  }
});

test("revoked, expired, deleted-user and malformed sessions return safe reauthentication errors", () => {
  for (const code of ["auth/id-token-expired", "auth/id-token-revoked", "auth/session-cookie-expired", "auth/session-cookie-revoked", "auth/user-not-found", "auth/invalid-id-token", "auth/argument-error", "auth/invalid-argument"]) {
    const failure = Object.assign(new Error("Internal detail must not reach the browser"), { code });
    const safe = normalizeSessionError(failure);
    assert.ok(isInvalidFirebaseSession(failure));
    assert.ok(safe instanceof AuthSessionError);
    assert.equal(safe.status, 401);
    assert.match(safe.message, /sign in again/);
    assert.ok(!safe.message.includes("Internal detail"));
  }
});

test("disabled accounts get a safe account-specific error", () => {
  const failure = { code: "auth/user-disabled" };
  assert.ok(isInvalidFirebaseSession(failure));
  const safe = normalizeSessionError(failure);
  assert.equal(safe?.code, "account-disabled");
  assert.equal(safe?.status, 403);
  assert.match(safe!.message, /disabled/);
});

test("configuration, IAM and network errors are not mistaken for invalid sessions", () => {
  for (const failure of [null, new Error("configuration missing"), { code: "auth/invalid-credential" }, { code: "auth/insufficient-permission" }, { code: "auth/internal-error" }, { code: "auth/project-not-found" }, { code: "app/network-error" }, { code: "ECONNRESET" }, { code: 7 }]) {
    assert.equal(isInvalidFirebaseSession(failure), false);
    assert.equal(normalizeSessionError(failure), null);
  }
  const original = new AuthSessionError("email-unverified", "Verify your email address before signing in.");
  assert.equal(normalizeSessionError(original), original);
});

test("only recognized recruiting roles grant access and each has its intended permissions", () => {
  assert.deepEqual(recruitingPermissions(false, "viewer"), { admin: false, editor: false, member: true, groupInterviewer: false, oneOnOneInterviewer: false });
  assert.deepEqual(recruitingPermissions(false, "recruiter"), { admin: false, editor: true, member: true, groupInterviewer: true, oneOnOneInterviewer: true });
  assert.deepEqual(recruitingPermissions(false, "group_interviewer"), { admin: false, editor: false, member: true, groupInterviewer: true, oneOnOneInterviewer: false });
  assert.deepEqual(recruitingPermissions(false, "one_on_one_interviewer"), { admin: false, editor: false, member: true, groupInterviewer: false, oneOnOneInterviewer: true });
  for (const role of [undefined, null, "", "admin", "lead", "VIEWER", "removed_role", true, 1, {}, ["viewer"]]) {
    assert.deepEqual(recruitingPermissions(false, role), { admin: false, editor: false, member: false, groupInterviewer: false, oneOnOneInterviewer: false });
  }
});

test("verified allowlisted admins do not depend on a stored recruiting role", () => {
  for (const role of [undefined, "viewer", "unknown"]) {
    assert.deepEqual(recruitingPermissions(true, role), { admin: true, editor: true, member: true, groupInterviewer: true, oneOnOneInterviewer: true });
  }
});
