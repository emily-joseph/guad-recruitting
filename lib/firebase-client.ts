"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

export function firebaseClientAuth() {
  if (!projectId || !apiKey || !authDomain || !appId) throw new Error("Firebase sign-in is not configured yet.");
  const app = getApps().length ? getApp() : initializeApp({ projectId, apiKey, authDomain, appId });
  return getAuth(app);
}
