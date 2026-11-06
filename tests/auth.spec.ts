import { test, expect } from "@playwright/test";

// The fixture server uses an ephemeral key for a nonexistent Firebase project.
// Browser tests mock auth HTTP responses; API validation tests reject inputs
// before making provider calls. No remote accounts are created.
test("email signup, resend and password recovery remain usable after failures", async ({ page }) => {
  const requests: { action: string; body: Record<string, string> }[] = [];
  await page.route("**/api/auth/*", async route => {
    const action = route.request().url().split("/").pop()!;
    requests.push({ action, body: route.request().postDataJSON() });
    await route.fulfill({ status: action === "login" ? 403 : 200, json: action === "login" ? { error: "Verify your email address before signing in." } : { message: action === "signup" ? "Check your email to verify your account." : action === "resend" ? "Verification email sent." : "If an account exists, a reset link is on its way.", ...(action === "signup" ? { nextMode: "login" } : {}) } });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByLabel("UT Austin email address").fill("student@utexas.edu");
  await page.getByLabel("Password", { exact: false }).fill("a strong password");
  await page.getByRole("button", { name: "Create account", exact: true }).last().click();
  await expect(page.getByRole("status")).toContainText("verify");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("UT Austin email address")).toHaveValue("student@utexas.edu");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("a strong password");
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await expect(page.locator("p[role=alert]")).toContainText("Verify");
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect(page.getByRole("status")).toContainText("Verification email sent");
  await page.getByRole("button", { name: "Forgot your password?" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("reset link");
  expect(requests.map(request => request.action)).toEqual(["signup", "login", "resend", "forgot"]);
  expect(requests[0].body.email).toBe("student@utexas.edu");
});

test("in-flight signup disables editing and switching modes", async ({ page }) => {
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  await page.route("**/api/auth/signup", async route => { await pending; await route.fulfill({ json: { message: "Check your email." } }); });
  await page.goto("/login");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByLabel("UT Austin email address").fill("student@utexas.edu");
  await page.getByLabel("Password", { exact: false }).fill("a strong password");
  await page.getByRole("button", { name: "Create account", exact: true }).last().click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeDisabled();
  await expect(page.getByLabel("UT Austin email address")).toBeDisabled();
  finish();
  await expect(page.getByRole("status")).toHaveText("Check your email.");
});

test("reset links and completion messages", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page).toHaveURL(/recovery=expired/);
  await page.goto("/login?verified=1");
  await expect(page.getByRole("status")).toContainText("email is verified");
  await page.goto("/login?password=updated");
  await expect(page.getByRole("status")).toContainText("password was updated");
  await page.route("**/api/auth/reset", route => route.fulfill({ status: 400, json: { error: "This email link is invalid or expired. Request a new link." } }));
  await page.goto("/reset-password?oobCode=expired-code");
  await page.getByLabel("Password", { exact: false }).fill("a strong password");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("expired");
  await page.getByRole("button", { name: "Request a new reset link" }).click();
  await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
});

test("school email guidance explains account creation and the portal password", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("New here? Choose Create account", { exact: false })).toContainText("not your UT EID password");
  await expect(page.getByText("Select a Google account with your UT email.", { exact: false })).toContainText("does not have a Google account");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByText("Create a portal account with your UT email", { exact: false })).toContainText("verify your email");
});

test("signup failures after account creation allow verification retry without re-entering credentials", async ({ page }) => {
  await page.route("**/api/auth/signup", route => route.fulfill({ json: { message: "Your account was created, but verification could not be sent. Resend verification.", nextMode: "login" } }));
  await page.route("**/api/auth/resend", route => route.fulfill({ json: { message: "Verification email sent." } }));
  await page.goto("/login");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByLabel("UT Austin email address").fill("student@my.utexas.edu");
  await page.getByLabel("Password", { exact: false }).fill("my portal password");
  await page.getByRole("button", { name: "Create account", exact: true }).last().click();
  await expect(page.getByRole("status")).toContainText("account was created");
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect(page.getByRole("status")).toHaveText("Verification email sent.");
});

for (const [name, body] of [
  ["null", null], ["empty", {}], ["invalid message", { message: {} }],
  ["external redirect", { redirect: "https://example.com/" }],
  ["protocol-relative redirect", { redirect: "//example.com/" }],
] as const) {
  test(`a ${name} response leaves login retryable`, async ({ page }) => {
    let attempts = 0;
    await page.route("**/api/auth/login", route => {
      attempts++;
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(attempts === 1 ? body : { error: "Verify your email address before signing in." }), status: attempts === 1 ? 200 : 403 });
    });
    await page.goto("/login");
    await page.getByLabel("UT Austin email address").fill("student@my.utexas.edu");
    await page.getByLabel("Password", { exact: true }).fill("my portal password");
    await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
    await expect(page.locator("p[role=alert]")).toContainText("unexpected response");
    await expect(page.getByLabel("Password", { exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
    await expect(page.locator("p[role=alert]")).toContainText("Verify your email");
    expect(attempts).toBe(2);
  });
}

test("non-JSON server failures and lost connections show useful messages and allow retries", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/auth/login", route => {
    attempts++;
    if (attempts === 1) return route.fulfill({ status: 502, contentType: "text/html", body: "<h1>Bad gateway</h1>" });
    if (attempts === 2) return route.abort("failed");
    return route.fulfill({ status: 403, json: { error: "Verify your email address before signing in." } });
  });
  await page.goto("/login");
  await page.getByLabel("UT Austin email address").fill("student@my.utexas.edu");
  await page.getByLabel("Password", { exact: true }).fill("my portal password");
  const submit = page.getByRole("button", { name: "Sign in", exact: true }).last();
  await submit.click();
  await expect(page.locator("p[role=alert]")).toContainText("temporarily unavailable");
  await submit.click();
  await expect(page.locator("p[role=alert]")).toContainText("Check your connection");
  await submit.click();
  await expect(page.locator("p[role=alert]")).toContainText("Verify your email");
});

test("rapid duplicate form submissions create only one account request", async ({ page }) => {
  let attempts = 0;
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  await page.route("**/api/auth/signup", async route => { attempts++; await pending; await route.fulfill({ json: { message: "Check your email.", nextMode: "login" } }); });
  await page.goto("/login");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByLabel("UT Austin email address").fill("student@my.utexas.edu");
  await page.getByLabel("Password", { exact: false }).fill("my portal password");
  await page.locator("form").evaluate(form => { (form as HTMLFormElement).requestSubmit(); (form as HTMLFormElement).requestSubmit(); });
  await expect(page.getByLabel("UT Austin email address")).toBeDisabled();
  finish();
  await expect(page.getByRole("status")).toHaveText("Check your email.");
  expect(attempts).toBe(1);
});

test("a successful login navigates to the application", async ({ page }) => {
  await page.route("**/api/auth/login", route => route.fulfill({ json: { redirect: "/apply" } }));
  await page.route("**/apply", route => route.fulfill({ contentType: "text/html", body: "<h1>Application</h1>" }));
  await page.goto("/login");
  await page.getByLabel("UT Austin email address").fill("student@my.utexas.edu");
  await page.getByLabel("Password", { exact: true }).fill("older-pass");
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await expect(page).toHaveURL(/\/apply$/);
});

test("a stalled request times out and leaves the form usable", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/auth/login", async route => { await pending; await route.abort().catch(() => undefined); });
  await page.goto("/login");
  await page.clock.install();
  await page.getByLabel("UT Austin email address").fill("student@my.utexas.edu");
  await page.getByLabel("Password", { exact: true }).fill("my portal password");
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await expect(page.getByLabel("Password", { exact: true })).toBeDisabled();
  try {
    await page.clock.fastForward(30_001);
    await expect(page.locator("p[role=alert]")).toContainText("taking too long");
    await expect(page.getByLabel("Password", { exact: true })).toBeEnabled();
  } finally { release(); }
});

test("API rejects invalid origins and inputs before contacting Firebase", async ({ request, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const credentials = { email: "student@my.utexas.edu", password: "my portal password" };
  const missingOrigin = await request.post("/api/auth/login", { data: credentials });
  expect(missingOrigin.status()).toBe(403);
  const crossOrigin = await request.post("/api/auth/login", { headers: { Origin: "https://unrelated.example" }, data: credentials });
  expect(crossOrigin.status()).toBe(403);
  const headers = { Origin: origin, "Content-Type": "application/json" };
  const malformed = await request.post("/api/auth/login", { headers, data: Buffer.from("{") });
  expect(malformed.status()).toBe(400);
  expect((await malformed.json()).error).toContain("could not be read");
  const unsupported = await request.post("/api/auth/unsupported", { headers, data: {} });
  expect(unsupported.status()).toBe(404);
  const oversized = await request.post("/api/auth/login", { headers, data: { email: "x".repeat(5000) } });
  expect(oversized.status()).toBe(413);
  const nonUt = await request.post("/api/auth/login", { headers, data: { ...credentials, email: "student@gmail.com" } });
  expect(nonUt.status()).toBe(400);
  expect((await nonUt.json()).error).toContain("UT Austin");
  const invalidGoogle = await request.post("/api/auth/google", { headers, data: { idToken: "" } });
  expect(invalidGoogle.status()).toBe(400);
});

