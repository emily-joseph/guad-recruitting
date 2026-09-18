"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/signout", { method: "POST" });
      if (!response.ok) throw new Error();
      router.push("/login"); router.refresh();
    } catch { setError("Sign-out failed. Try again."); setBusy(false); }
  }
  return <span><button type="button" onClick={signOut} disabled={busy} className="nav-link disabled:opacity-50">{busy ? "Signing out…" : "Sign out"}</button>{error && <span role="alert" className="block text-xs text-red-300">{error}</span>}</span>;
}
