import test from "node:test";
import assert from "node:assert/strict";
import { AuthInputError, runEmailAuth } from "../lib/auth-flow";
import { authErrorMessage, FirebaseIdentityError } from "../lib/auth-errors";

const credentials = { email: " Student@my.utexas.edu ", password: "a strong password" };
function fixture() {
  const calls: { endpoint: string; body: Record<string, string | boolean> }[] = [];
  const sessions: string[] = [];
  return { calls, sessions, identity: async (endpoint: string, body: Record<string, string | boolean>) => { calls.push({ endpoint, body }); return { idToken: "signed-token" }; }, session: async (token: string) => { sessions.push(token); } };
}
test("verified password login uses token validation, not a nonexistent REST response field", async () => {
  const deps = fixture();
  assert.deepEqual(await runEmailAuth("login", credentials, "https://portal.example", deps), { redirect: "/apply" });
  assert.deepEqual(deps.sessions, ["signed-token"]);
  assert.deepEqual(deps.calls[0].body, { email: "student@my.utexas.edu", password: credentials.password, returnSecureToken: true });
});
test("signup sends verification and never creates an authenticated session", async () => {
  const deps = fixture();
  const result = await runEmailAuth("signup", credentials, "https://portal.example", deps);
  assert.ok(result.message?.includes("verify"));
  assert.equal(result.nextMode, "login");
  assert.deepEqual(deps.calls.map(call => call.endpoint), ["accounts:signUp", "accounts:sendOobCode"]);
  assert.equal(deps.calls[1].body.continueUrl, "https://portal.example/login");
  assert.deepEqual(deps.sessions, []);
});
test("verification resend authenticates credentials first and creates no session", async () => {
  const deps = fixture();
  await runEmailAuth("resend", credentials, "https://portal.example", deps);
  assert.equal(deps.calls[0].endpoint, "accounts:signInWithPassword");
  assert.equal(deps.calls[1].body.requestType, "VERIFY_EMAIL");
  assert.deepEqual(deps.sessions, []);
});
test("signup reports partial success and leads to resend if verification delivery fails", async () => {
  for (const error of [new FirebaseIdentityError("TOO_MANY_ATTEMPTS_TRY_LATER"), new Error("internal delivery detail")]) {
    const deps = fixture();
    const identity = deps.identity;
    deps.identity = async (endpoint, body) => {
      if (endpoint === "accounts:sendOobCode") throw error;
      return identity(endpoint, body);
    };
    const result = await runEmailAuth("signup", credentials, "https://portal.example", deps);
    assert.equal(result.nextMode, "login");
    assert.match(result.message ?? "", /account was created/);
    assert.match(result.message ?? "", /couldn't send/);
    assert.match(result.message ?? "", /Resend verification email/);
    assert.doesNotMatch(result.message ?? "", /internal delivery detail/);
    assert.deepEqual(deps.sessions, []);
  }
});
test("failed signup and resend never claim that verification was sent", async () => {
  for (const action of ["signup", "resend"]) {
    const deps = fixture();
    deps.identity = async () => { throw new FirebaseIdentityError("INVALID_LOGIN_CREDENTIALS"); };
    await assert.rejects(runEmailAuth(action, credentials, "https://portal.example", deps), FirebaseIdentityError);
    assert.deepEqual(deps.sessions, []);
  }
  const deps = fixture();
  deps.identity = async endpoint => {
    if (endpoint === "accounts:sendOobCode") throw new FirebaseIdentityError("TOO_MANY_REQUESTS");
    return { idToken: "signed-token" };
  };
  await assert.rejects(runEmailAuth("resend", credentials, "https://portal.example", deps), /Too many/);
  assert.deepEqual(deps.sessions, []);
});
test("reject non-UT, lookalike domains, empty and overlong input before Firebase", async () => {
  for (const email of ["student@example.com", "student@utexas.edu.attacker.com", "student@notutexas.edu", "", "x".repeat(301) + "@utexas.edu"]) {
    const deps = fixture();
    await assert.rejects(runEmailAuth("login", { ...credentials, email }, "https://portal.example", deps));
    assert.equal(deps.calls.length, 0);
  }
});
test("signup enforces password boundaries while login permits existing shorter passwords", async () => {
  for (const password of ["x".repeat(11), "x".repeat(129)]) await assert.rejects(runEmailAuth("signup", { ...credentials, password }, "https://portal.example", fixture()));
  for (const password of ["x".repeat(12), "x".repeat(128)]) await runEmailAuth("signup", { ...credentials, password }, "https://portal.example", fixture());
  await runEmailAuth("login", { ...credentials, password: "short" }, "https://portal.example", fixture());
});
test("passwords retain exact whitespace while emails are normalized", async () => {
  const deps = fixture();
  const password = "  a strong password  ";
  await runEmailAuth("login", { ...credentials, password }, "https://portal.example", deps);
  assert.equal(deps.calls[0].body.password, password);
  assert.equal(deps.calls[0].body.email, "student@my.utexas.edu");
});
test("unverified, disabled or revoked session failures propagate without success", async () => {
  for (const message of ["Verify your email address before signing in.", "revoked", "disabled"]) {
    const deps = fixture();
    deps.session = async () => { throw new Error(message); };
    await assert.rejects(runEmailAuth("login", credentials, "https://portal.example", deps), { message });
  }
});
test("missing token cannot create a session or send verification", async () => {
  const deps = { ...fixture(), identity: async () => ({}) };
  await assert.rejects(runEmailAuth("signup", credentials, "https://portal.example", deps));
  assert.deepEqual(deps.sessions, []);
});
test("MFA and blank credentials cannot bypass verification or create sessions", async () => {
  for (const result of [{ mfaPendingCredential: "pending-credential" }, { idToken: "   " }]) {
    const deps = { ...fixture(), identity: async () => result };
    await assert.rejects(runEmailAuth("login", credentials, "https://portal.example", deps), FirebaseIdentityError);
    assert.deepEqual(deps.sessions, []);
  }
});
test("unsupported actions cannot fall through to password login", async () => {
  const deps = fixture();
  await assert.rejects(runEmailAuth("unknown", credentials, "https://portal.example", deps), AuthInputError);
  assert.deepEqual(deps.calls, []);
  assert.deepEqual(deps.sessions, []);
});
test("password recovery does not reveal whether the email exists", async () => {
  const present = await runEmailAuth("forgot", { email: credentials.email }, "https://portal.example", fixture());
  const absent = await runEmailAuth("forgot", { email: credentials.email }, "https://portal.example", { ...fixture(), identity: async () => { throw new FirebaseIdentityError("EMAIL_NOT_FOUND"); } });
  assert.deepEqual(absent, present);
});
test("recovery provider failures remain visible", async () => {
  await assert.rejects(runEmailAuth("forgot", { email: credentials.email }, "https://portal.example", { ...fixture(), identity: async () => { throw new FirebaseIdentityError("OPERATION_NOT_ALLOWED"); } }));
});
test("forgot password validates the email alone and never forwards a password", async () => {
  const deps = fixture();
  await runEmailAuth("forgot", { email: credentials.email, password: null }, "https://portal.example", deps);
  assert.deepEqual(deps.calls[0].body, { requestType: "PASSWORD_RESET", email: "student@my.utexas.edu", continueUrl: "https://portal.example/login" });
  await assert.rejects(runEmailAuth("forgot", { email: "not-an-email" }, "https://portal.example", deps), error => error instanceof AuthInputError && !error.message.includes("password"));
});
test("reset requires a code and strong password, forwards exact password, and returns to login", async () => {
  const deps = fixture();
  await assert.rejects(runEmailAuth("reset", { password: credentials.password }, "https://portal.example", deps));
  await assert.rejects(runEmailAuth("reset", { password: credentials.password, oobCode: "   " }, "https://portal.example", deps));
  assert.deepEqual(await runEmailAuth("reset", { password: credentials.password, oobCode: "valid-code" }, "https://portal.example", deps), { redirect: "/login?password=updated" });
  assert.deepEqual(deps.calls[0].body, { oobCode: "valid-code", newPassword: credentials.password });
  assert.deepEqual(deps.sessions, []);
});
test("duplicate signup, expired links and weak-password errors have actionable messages", () => {
  assert.match(authErrorMessage("EMAIL_EXISTS"), /already exists/);
  assert.match(authErrorMessage("EXPIRED_OOB_CODE"), /expired/);
  assert.match(authErrorMessage("WEAK_PASSWORD : Password should be stronger"), /stronger/);
  assert.match(authErrorMessage("auth/popup-blocked"), /Allow popups/);
  assert.equal(authErrorMessage("INVALID_PASSWORD"), authErrorMessage("EMAIL_NOT_FOUND"));
  assert.ok(!authErrorMessage("sensitive internal detail").includes("sensitive"));
});
test("sign-in errors explain portal accounts without exposing whether an email is registered", () => {
  const message = authErrorMessage("INVALID_LOGIN_CREDENTIALS");
  for (const code of ["EMAIL_NOT_FOUND", "INVALID_PASSWORD", "auth/user-not-found", "auth/wrong-password", "auth/invalid-credential"]) {
    assert.equal(authErrorMessage(code), message);
  }
  assert.match(message, /Create an account first/);
  assert.match(message, /UT EID password/);
  assert.match(message, /Continue with Google/);
});
test("provider and action-link errors provide safe and specific recovery guidance", () => {
  assert.match(authErrorMessage("auth/account-exists-with-different-credential"), /method you originally used/);
  assert.match(authErrorMessage(" auth/invalid-api-key "), /configuration/);
  assert.match(authErrorMessage("UNAUTHORIZED_CONTINUE_URI"), /email return link/);
  assert.match(authErrorMessage("WEAK_PASSWORD: internal password detail"), /stronger/);
  assert.match(authErrorMessage("auth/multi-factor-auth-required"), /additional verification/);
  assert.match(authErrorMessage("auth/user-token-expired"), /Sign in again/);
  assert.doesNotMatch(authErrorMessage("PASSWORD_DOES_NOT_MEET_REQUIREMENTS : internal policy detail"), /internal policy/);
});
