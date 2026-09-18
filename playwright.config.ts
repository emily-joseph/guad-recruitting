import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "application.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  use: { baseURL: process.env.TEST_ORIGIN || "http://localhost:3000", channel: "msedge", headless: true, trace: "retain-on-failure" },
});
