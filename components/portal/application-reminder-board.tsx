"use client";
import { useState } from "react";
import type { DraftApplicant } from "@/lib/server/store";

export function ApplicationReminderBoard({ initial }: { initial: DraftApplicant[] }) {
  const [applicants, setApplicants] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  async function send(userId: string) {
    setBusy(userId); setMessage("");
    try {
      const response = await fetch("/api/application-reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setApplicants(current => current.map(applicant => applicant.user_id === userId ? { ...applicant, reminder_sent_at: new Date().toISOString() } : applicant));
      setMessage(result.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not send the reminder."); }
    finally { setBusy(null); }
  }
  return <section className="portal-card mb-8"><h2 className="text-2xl font-bold">Unfinished applications</h2><p className="mt-2 text-sm text-gray-400">Send a one-time email reminder to an applicant with a saved draft. Email delivery must be configured.</p>{message && <p role="status" className="mt-4 text-sm">{message}</p>}<ul className="mt-5 divide-y divide-white/10">{applicants.map(applicant => <li className="flex flex-wrap items-center justify-between gap-3 py-4" key={applicant.user_id}><div><p className="font-semibold">{applicant.name}</p><p className="text-sm text-gray-400">{applicant.email} · Last saved {new Date(applicant.updated_at).toLocaleString()}</p></div>{applicant.reminder_sent_at ? <span className="text-sm text-gray-400">Reminder sent</span> : <button type="button" className="button button-secondary" disabled={busy !== null} onClick={() => void send(applicant.user_id)}>{busy === applicant.user_id ? "Sending…" : "Email reminder"}</button>}</li>)}{applicants.length === 0 && <li className="pt-4 text-sm text-gray-400">No unfinished applications.</li>}</ul></section>;
}
