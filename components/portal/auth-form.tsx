"use client";

import { useRef, useState, type FormEvent } from "react";
import { GoogleAuthProvider, signInWithPopup, signOut, setPersistence, inMemoryPersistence } from "firebase/auth";
import { authErrorMessage } from "@/lib/auth-errors";
import { firebaseClientAuth } from "@/lib/firebase-client";

type LocalRole = "applicant" | "viewer" | "recruiter" | "group_interviewer" | "one_on_one_interviewer" | "lead";
type Mode = "login" | "signup" | "forgot" | "reset";
type AuthResult = { message?: string; redirect?: string; nextMode?: "login" };
const unexpectedResponse = "The sign-in service returned an unexpected response. Please try again.";

async function postAuth(action: string, values: Record<string, string> = {}): Promise<AuthResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`/api/auth/${action}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values), signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);
    const result = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
    if (!response.ok) {
      throw new Error(typeof result?.error === "string" && result.error.trim() ? result.error : "The sign-in service is temporarily unavailable. Please try again.");
    }
    if (!result) throw new Error(unexpectedResponse);
    const message = typeof result.message === "string" && result.message.trim() ? result.message : undefined;
    let redirect: string | undefined;
    if (result.redirect !== undefined) {
      if (typeof result.redirect !== "string" || !result.redirect.startsWith("/") || new URL(result.redirect, window.location.origin).origin !== window.location.origin) {
        throw new Error(unexpectedResponse);
      }
      redirect = result.redirect;
    }
    if (!message && !redirect) throw new Error(unexpectedResponse);
    return { message, redirect, nextMode: result.nextMode === "login" ? "login" : undefined };
  } catch (error) {
    if (controller.signal.aborted) throw new Error("This request is taking too long. Please try again. If you were creating an account, try signing in or resending verification.");
    if (error instanceof TypeError) throw new Error("Unable to connect. Check your connection and try again.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function AuthForm({ test, ready, initialMode = "login", oobCode }: { test: boolean; ready: boolean; initialMode?: "login" | "reset"; oobCode?: string }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const inFlight = useRef(false);
  const busy = pendingAction !== null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [testRole, setTestRole] = useState<LocalRole>("lead");

  function begin(action: string) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setPendingAction(action); setError(""); setMessage("");
    return true;
  }
  function finish() { inFlight.current = false; setPendingAction(null); }
  function changeMode(value: Mode) { setMode(value); setError(""); setMessage(""); }

  async function send(action: string, values?: Record<string, string>) {
    if (!begin(action)) return;
    try {
      const result = await postAuth(action, values);
      if (result.redirect) window.location.assign(result.redirect);
      else {
        if (result.nextMode) setMode(result.nextMode);
        setMessage(result.message ?? "");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to connect. Please try again.");
    } finally { finish(); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(mode, { email: email.trim(), password, ...(mode === "reset" ? { oobCode: oobCode ?? "" } : {}) });
  }
  async function continueWithGoogle() {
    if (!begin("google")) return;
    let auth: ReturnType<typeof firebaseClientAuth> | undefined;
    try {
      auth = firebaseClientAuth();
      await setPersistence(auth, inMemoryPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const payload = await postAuth("google", { idToken: await result.user.getIdToken() });
      if (!payload.redirect) throw new Error(unexpectedResponse);
      await signOut(auth).catch(() => undefined);
      window.location.assign(payload.redirect);
    } catch (error) {
      if (auth) await signOut(auth).catch(() => undefined);
      const code = (error as { code?: string } | null)?.code;
      setError(typeof code === "string" ? authErrorMessage(code) : error instanceof Error ? error.message : "Unable to sign in with Google. Please try again.");
    } finally { finish(); }
  }

  return <div className="portal-card mx-auto max-w-lg" aria-busy={busy}>
    <h2 className="text-2xl font-bold">{test ? "Try the application" : mode === "login" ? "Welcome back" : mode === "forgot" ? "Reset your password" : mode === "reset" ? "Choose a new password" : "Create your account"}</h2>
    {test ? <>
      <p className="mt-4 text-sm leading-7 text-gray-300">Preview the portal as an applicant or recruiting role. These signed local sessions use the same page and API permission checks as the app.</p>
      <label className="form-field mt-5">Preview role<select disabled={busy} value={testRole} onChange={event => setTestRole(event.target.value as LocalRole)}>
        <option value="applicant">Applicant — own application</option><option value="viewer">Guest viewer — read applications</option><option value="group_interviewer">Group interviewer — read applications and view group assignments</option><option value="one_on_one_interviewer">One-on-one interviewer — read applications and manage interview slots</option><option value="recruiter">Recruiter — edit reviews and manage interview workflows</option><option value="lead">Lead — full recruiting administration</option>
      </select></label>
      <button className="button mt-6 w-full" disabled={busy} onClick={() => void send("test", { role: testRole })}>{busy ? "Starting..." : `Preview as ${testRole.replaceAll("_", " ")}`}</button>
    </> : ready ? <>
      {mode !== "reset" && <div className="my-6 flex gap-3" aria-label="Account options">{(["login", "signup"] as const).map(value => <button type="button" key={value} disabled={busy} aria-pressed={mode === value} className={`rounded-md border px-4 py-2 text-sm ${mode === value ? "border-accent text-accent" : "border-white/15 text-gray-300"}`} onClick={() => changeMode(value)}>{value === "login" ? "Sign in" : "Create account"}</button>)}</div>}
      {(mode === "login" || mode === "signup") && <>
        <p className="mb-5 text-sm leading-6 text-gray-300">{mode === "login" ? "New here? Choose Create account to register your UT email. Use the password you created for this portal, not your UT EID password." : "Create a portal account with your UT email and a new password. You will need to verify your email before signing in."}</p>
        <button type="button" className="w-full rounded-md border border-white/20 px-4 py-3 font-semibold text-white hover:border-accent disabled:opacity-60" disabled={busy} onClick={() => void continueWithGoogle()}>{pendingAction === "google" ? "Connecting..." : "Continue with Google"}</button>
        <p className="mt-3 text-sm leading-6 text-gray-400">Select a Google account with your UT email. If your school email does not have a Google account, create a portal account with email and password below.</p>
        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-gray-500"><span className="h-px flex-1 bg-white/10" />or use email and password<span className="h-px flex-1 bg-white/10" /></div>
      </>}
      {mode === "forgot" && <p className="mt-4 text-sm leading-6 text-gray-300">Reset the password for your portal account. This does not change your UT EID password.</p>}
      <form onSubmit={submit} className="space-y-5 mt-5"><fieldset disabled={busy} className="space-y-5">
        {mode !== "reset" && <label className="form-field">UT Austin email address<input name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={300} placeholder="you@my.utexas.edu" value={email} onChange={event => setEmail(event.target.value)} /><span className="field-hint">Use an @utexas.edu or @my.utexas.edu address.</span></label>}
        {mode !== "forgot" && <label className="form-field">Password<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : 12} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} />{(mode === "reset" || mode === "signup") && <span className="field-hint">Use 12–128 characters.</span>}</label>}
        <button className="button w-full" disabled={busy}>{pendingAction === mode ? "Please wait..." : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Update password"}</button>
        {mode === "login" && <button type="button" className="text-sm text-accent" disabled={busy} onClick={event => { if (!event.currentTarget.form?.reportValidity()) return; void send("resend", { email: email.trim(), password }); }}>{pendingAction === "resend" ? "Sending verification..." : "Resend verification email"}</button>}
      </fieldset></form>
      {mode === "login" && <p className="mt-4 text-sm leading-6 text-gray-400">Email accounts must be verified before signing in. To resend verification, enter your email and portal password above.</p>}
      {(mode === "login" || mode === "reset") && <button type="button" className="mt-5 text-sm text-accent" disabled={busy} onClick={() => changeMode("forgot")}>{mode === "reset" ? "Request a new reset link" : "Forgot your password?"}</button>}
    </> : <p className="mt-4 text-sm leading-7 text-gray-300">Sign-in is unavailable while Firebase setup is incomplete.</p>}
    {error && <p role="alert" className="mt-5 text-sm text-red-300">{error}</p>}{message && <p role="status" className="mt-5 text-sm text-green-300">{message}</p>}
  </div>;
}
