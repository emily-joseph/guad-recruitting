"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { firebaseClientAuth } from "@/lib/firebase-client";

type LocalRole = "applicant" | "viewer" | "recruiter" | "group_interviewer" | "one_on_one_interviewer" | "lead";

export function AuthForm({ test, ready, initialMode = "login", oobCode }: { test: boolean; ready: boolean; initialMode?: "login" | "reset"; oobCode?: string }) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset">(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [testRole, setTestRole] = useState<LocalRole>("lead");
  const router = useRouter();
  async function send(action: string, values?: Record<string, string>) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/auth/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values ?? {}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (result.redirect) { router.push(result.redirect); router.refresh(); }
      else setMessage(result.message);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to connect. Please try again."); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void send(mode, { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? ""), ...(mode === "reset" ? { oobCode: oobCode ?? "" } : {}) });
  }
  async function continueWithGoogle() {
    setBusy(true); setError(""); setMessage("");
    let auth: ReturnType<typeof firebaseClientAuth> | undefined;
    try {
      auth = firebaseClientAuth();
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const response = await fetch("/api/auth/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: await result.user.getIdToken() }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "This Google account cannot access the portal.");
      await signOut(auth);
      router.push(payload.redirect ?? "/apply"); router.refresh();
    } catch (error) {
      if (auth) await signOut(auth).catch(() => undefined);
      const code = (error as { code?: string })?.code;
      setError(code === "auth/popup-closed-by-user" ? "The Google sign-in window was closed before finishing." : error instanceof Error ? error.message : "Unable to sign in with Google. Please try again.");
    } finally { setBusy(false); }
  }
  return <div className="portal-card mx-auto max-w-lg">
    <h2 className="text-2xl font-bold">{test ? "Try the application" : mode === "login" ? "Welcome back" : mode === "forgot" ? "Reset your password" : mode === "reset" ? "Choose a new password" : "Create your account"}</h2>
    {test ? <><p className="mt-4 text-sm leading-7 text-gray-300">Preview the portal as an applicant or recruiting role. These signed local sessions use the same page and API permission checks as the app.</p><label className="form-field mt-5">Preview role<select value={testRole} onChange={event => setTestRole(event.target.value as LocalRole)}><option value="applicant">Applicant — own application</option><option value="viewer">Guest viewer — read applications</option><option value="group_interviewer">Group interviewer — read applications and view group assignments</option><option value="one_on_one_interviewer">One-on-one interviewer — read applications and manage interview slots</option><option value="recruiter">Recruiter — edit reviews and manage interview workflows</option><option value="lead">Lead — full recruiting administration</option></select></label><button className="button mt-6 w-full" disabled={busy} onClick={() => void send("test", { role: testRole })}>{busy ? "Starting…" : `Preview as ${testRole.replaceAll("_", " ")}`}</button></> : ready ? <>
      {mode !== "reset" && <div className="my-6 flex gap-3" aria-label="Account options">{(["login", "signup"] as const).map(value => <button type="button" key={value} aria-pressed={mode === value} className={`rounded-md border px-4 py-2 text-sm ${mode === value ? "border-accent text-accent" : "border-white/15 text-gray-300"}`} onClick={() => { setMode(value); setError(""); setMessage(""); }}>{value === "login" ? "Sign in" : "Create account"}</button>)}</div>}
      {(mode === "login" || mode === "signup") && <>
        <button type="button" className="w-full rounded-md border border-white/20 px-4 py-3 font-semibold text-white hover:border-accent disabled:opacity-60" disabled={busy} onClick={() => void continueWithGoogle()}>{busy ? "Connecting..." : "Continue with Google"}</button>
        {mode === "signup" ? <p className="mt-4 text-sm leading-6 text-gray-300">Create your account with your verified UT Austin Google account. You will not need a separate email verification link.</p> : <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-gray-500"><span className="h-px flex-1 bg-white/10" />or use email and password<span className="h-px flex-1 bg-white/10" /></div>}
      </>}
      {(mode === "login" || mode === "forgot" || mode === "reset") && <form onSubmit={submit} className="space-y-5">
        {mode !== "reset" && <label className="form-field">UT Austin email address<input name="email" type="email" autoComplete="email" required maxLength={300} placeholder="eid@utexas.edu" /><span className="field-hint">Use an @utexas.edu or @my.utexas.edu address.</span></label>}
        {mode !== "forgot" && <label className="form-field">Password<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : 12} maxLength={128} />{mode === "reset" && <span className="field-hint">Use at least 12 characters.</span>}</label>}
        <button className="button w-full" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Update password"}</button>
      </form>}
      {mode === "login" && <p className="mt-4 text-sm leading-6 text-gray-400">Email and password are for existing verified accounts. New accounts should use Google to verify their UT identity.</p>}
      {mode === "login" && <button type="button" className="mt-5 text-sm text-accent" onClick={() => { setMode("forgot"); setMessage(""); setError(""); }}>Forgot your password?</button>}
    </> : <p className="mt-4 text-sm leading-7 text-gray-300">The spring application portal is being prepared. Sign-in will be available when setup is complete.</p>}
    {error && <p role="alert" className="mt-5 text-sm text-red-300">{error}</p>}{message && <p role="status" className="mt-5 text-sm text-green-300">{message}</p>}
  </div>;
}
