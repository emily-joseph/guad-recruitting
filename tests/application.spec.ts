import { test, expect } from "@playwright/test";

test("applicant can save, resume, upload, review and submit; recruiting stays closed afterward", async ({ page, context, baseURL }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Start local test session" })).toBeVisible();
  await page.getByRole("button", { name: "Start local test session" }).click();
  await expect(page).toHaveURL(/\/apply$/);
  const originalResponse = await context.request.get("/api/recruitment");
  const original = await originalResponse.json();
  try {
    await page.getByRole("link", { name: "Recruiting settings", exact: true }).click();
    await page.getByRole("radio", { name: /^Open now/ }).check();
    await page.getByRole("button", { name: "Save recruiting settings" }).click();
    await expect(page.getByRole("status")).toHaveText("Recruitment settings saved.");
    await page.getByRole("link", { name: "My application" }).click();
    await page.locator("#name").fill("Browser Test Student");
    await page.locator("#eid").fill("bt1234");
    await page.locator("#classification").selectOption("Junior");
    await page.locator("#major").fill("Mechanical Engineering");
    await page.locator("#referral").selectOption("Other");
    await page.locator("#referralOther").fill("A friend at a student fair");
    await page.locator("#team1").selectOption("Engineering - Track");
    await page.locator("#team2").selectOption("Business - Media");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Draft saved.");
    await page.reload();
    await expect(page.locator("#name")).toHaveValue("Browser Test Student");
    await page.getByRole("button", { name: /Continue to questions/ }).click();
    await page.locator("#infoSession").selectOption("No");
    await page.locator("#resume").setInputFiles({ name: "sample-resume.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nBrowser test fixture\n%%EOF") });
    await page.locator("#leadership").fill("I helped our team compare different designs and agree on a direction.");
    await page.locator("#setback").fill("A prototype failed. I asked for feedback and tested a revised design.");
    await page.locator("#motivation").fill("I want to contribute to the track team and learn from other students.");
    await page.locator("#song").fill("Sample song");
    await page.locator("#movie").fill("Sample movie");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: "test-results/application-mobile.png", fullPage: true });
    await page.getByRole("button", { name: "Review application", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Review your application" })).toBeVisible();
    await page.getByRole("button", { name: "Submit test application", exact: true }).click();
    await expect(page.getByText("Test submission complete", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Thank you, Browser Test Student." })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Test submission complete", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    const response = await context.request.post("/api/recruitment", { data: original, headers: { origin: baseURL! } });
    expect(response.status()).toBe(200);
  }
});
