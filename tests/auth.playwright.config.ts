import { defineConfig } from "@playwright/test";
import path from "node:path";

export default defineConfig({
  testDir: ".",
  testMatch: "auth.spec.ts",
  workers: 1,
  timeout: 45_000,
  use: { baseURL: process.env.TEST_ORIGIN || "http://localhost:3101", channel: "msedge", headless: true },
  webServer: process.env.TEST_ORIGIN ? undefined : {
    command: "node tests/auth-fixture-server.mjs",
    cwd: path.resolve(__dirname, ".."),
    url: "http://localhost:3101/login",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
