"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AuthForm({ test, ready, initialMode = "login" }: { test: boolean; ready: boolean; initialMode?: "login" | "reset" }) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset">(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();
  async function send(action: string, values?: { email: string; password: string }) {
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
    void send(mode, { email: String(form.get("email")), password: String(form.get("password")) });
  }
  return <div className="portal-card mx-auto max-w-lg">
    <h2 className="text-2xl font-bold">{test ? "Try the application" : mode === "login" ? "Welcome back" : mode === "forgot" ? "Reset your password" : mode === "reset" ? "Choose a new password" : "Create your account"}</h2>
    {test ? <><p className="mt-4 text-sm leading-7 text-gray-300">Start an isolated test applicant session. You can fill out the form, upload sample PDFs, submit, and try the recruiting schedule.</p><button className="button mt-6 w-full" disabled={busy} onClick={() => void send("test")}>{busy ? "Starting…" : "Start local test session"}</button></> : ready ? <>
      {mode !== "reset" && <div className="my-6 flex gap-3" aria-label="Account options">{(["login", "signup"] as const).map(value => <button type="button" key={value} aria-pressed={mode === value} className={`rounded-md border px-4 py-2 text-sm ${mode === value ? "border-accent text-accent" : "border-white/15 text-gray-300"}`} onClick={() => { setMode(value); setError(""); setMessage(""); }}>{value === "login" ? "Sign in" : "Create account"}</button>)}</div>}
      <form onSubmit={submit} className="space-y-5">
        {mode !== "reset" && <label className="form-field">Email address<input name="email" type="email" autoComplete="email" required maxLength={300} /></label>}
        {mode !== "forgot" && <label className="form-field">Password<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : 12} maxLength={128} />{mode === "signup" && <span className="field-hint">Use at least 12 characters. You’ll confirm your email before signing in.</span>}</label>}
        <button className="button w-full" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "forgot" ? "Send reset link" : mode === "reset" ? "Update password" : "Create account"}</button>
      </form>
      {mode === "login" && <button type="button" className="mt-5 text-sm text-accent" onClick={() => { setMode("forgot"); setMessage(""); setError(""); }}>Forgot your password?</button>}
    </> : <p className="mt-4 text-sm leading-7 text-gray-300">The spring application portal is being prepared. Sign-in will be available when setup is complete.</p>}
    {error && <p role="alert" className="mt-5 text-sm text-red-300">{error}</p>}{message && <p role="status" className="mt-5 text-sm text-green-300">{message}</p>}
  </div>;
}
