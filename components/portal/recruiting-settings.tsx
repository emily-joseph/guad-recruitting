"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { fromAustinInput, toAustinInput, windowMessage, type RecruitmentWindow } from "@/lib/recruitment-window";

export function RecruitingSettings({ initial }: { initial: RecruitmentWindow }) {
  const [mode, setMode] = useState(initial.mode);
  const [opens, setOpens] = useState(toAustinInput(initial.opensAt));
  const [closes, setCloses] = useState(toAustinInput(initial.closesAt));
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const value: RecruitmentWindow = { mode, opensAt: mode === "scheduled" ? fromAustinInput(opens) : null, closesAt: mode === "scheduled" ? fromAustinInput(closes) : null };
      const response = await fetch("/api/recruitment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSaved(value); setMessage(result.message); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save settings."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="portal-card space-y-7"><div className="rounded-lg border border-white/15 p-4 text-sm"><span className="text-gray-400">Saved setting: </span>{windowMessage(saved)}</div><fieldset disabled={busy} className="space-y-4"><legend className="mb-4 text-lg font-semibold">Accepting applications</legend>{([
    ["closed", "Closed", "Stop accepting applications now. Existing submissions and drafts remain saved."],
    ["scheduled", "Scheduled", "Automatically open and close at the times below."],
    ["open", "Open now", "Accept applications immediately until you change this setting. There is no automatic deadline in this mode."],
  ] as const).map(([value, label, description]) => <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${mode === value ? "border-accent" : "border-white/15"}`}><input className="mt-1 accent-[#bf5700]" type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} /><span><span className="block font-semibold">{label}</span><span className="mt-1 block text-sm leading-6 text-gray-400">{description}</span></span></label>)}</fieldset>
    {mode === "scheduled" && <div><p className="mb-4 text-sm text-gray-300">All times are Austin time (America/Chicago), including daylight saving changes. The closing time is exclusive: submissions must finish before it.</p><div className="grid gap-6 sm:grid-cols-2"><label className="form-field">Opens at<input type="datetime-local" value={opens} onChange={event => setOpens(event.target.value)} required /></label><label className="form-field">Closes at<input type="datetime-local" value={closes} onChange={event => setCloses(event.target.value)} required /></label></div></div>}
    <button className="button" disabled={busy}>{busy ? "Saving…" : "Save recruiting settings"}</button>{message && <p role="status" className="text-sm text-gray-300">{message}</p>}
  </form>;
}
