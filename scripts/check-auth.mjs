import nextEnv from "@next/env";
import { inspectFirebaseConfiguration } from "../lib/server/firebase-config.ts";

nextEnv.loadEnvConfig(process.cwd(), true);
const { issues } = inspectFirebaseConfiguration();
if (process.env.APPLICATION_TEST_MODE === "true") issues.push("APPLICATION_TEST_MODE=true enables role previews. Set it to false for real Firebase login.");
if (issues.length) {
  console.error("Firebase authentication setup needs attention:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log("Local Firebase configuration is valid. Provider settings, key permissions, email delivery, and live sign-in still require a Firebase connection.");
}
