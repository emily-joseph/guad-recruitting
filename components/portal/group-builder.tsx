"use client";
import { useState, type FormEvent } from "react";
import type { GroupInterviewRun } from "@/lib/server/store";
export function GroupBuilder({ initialRuns }: { initialRuns: GroupInterviewRun[] }) {
  const [runs, setRuns] = useState(initialRuns);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const volunteers = String(form.get("volunteers")).split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    try {
      const response = await fetch("/api/group-interviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ day: form.get("day"), volunteers }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRuns(current => [data.run, ...current]); setMessage(`Saved ${data.groups.length} groups for ${data.run.interview_day}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create groups."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-8">
    <section className="portal-card"><h2 className="text-2xl font-bold">Build group interviews</h2><p className="mt-3 text-sm text-gray-400">Candidates in the group-interview stage are divided into groups of up to six. One volunteer is assigned per group, or two when there are more volunteers than groups.</p><form onSubmit={submit} className="mt-6 space-y-5"><label className="form-field">Interview day<input type="date" name="day" required /></label><label className="form-field">Volunteers, one per line<textarea name="volunteers" rows={6} required /></label><button className="button" disabled={busy}>{busy ? "Saving…" : "Create groups"}</button></form>{message && <p role="status" className="mt-4 text-sm">{message}</p>}</section>
    <section className="space-y-5"><h2 className="text-2xl font-bold">Saved interview days</h2>{runs.map(run => <article className="portal-card" key={run.id}><h3 className="text-lg font-semibold">{new Date(`${run.interview_day}T12:00:00`).toLocaleDateString("en-US", { dateStyle: "full" })}</h3><p className="mt-1 text-xs text-gray-400">Created {new Date(run.created_at).toLocaleString()}</p><div className="mt-4 grid gap-4 sm:grid-cols-2">{run.groups.map(group => <div className="rounded border border-white/15 p-4 text-sm" key={group.number}><strong>Group {group.number}</strong><p className="mt-1 text-gray-400">Interviewers: {group.volunteers.join(", ")}</p><ul className="mt-2 list-inside list-disc">{group.applicants.map(applicant => <li key={applicant.id}>{applicant.name}</li>)}</ul></div>)}</div></article>)}{runs.length === 0 && <div className="portal-card text-sm text-gray-400">No group interview days have been saved.</div>}</section>
  </div>;
}
