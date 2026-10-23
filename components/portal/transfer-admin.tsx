"use client";
import { useState, type FormEvent } from "react";
import { formatAustinDate, fromAustinInput, toAustinInput, type RecruitmentWindow } from "@/lib/recruitment-window";
import type { InternalTransfer } from "@/lib/server/store";

export function TransferAdmin({ initialWindow, initialTransfers }: { initialWindow: RecruitmentWindow; initialTransfers: InternalTransfer[] }) {
  const [window, setWindow] = useState(initialWindow);
  const [transfers, setTransfers] = useState(initialTransfers);
  const [mode, setMode] = useState(initialWindow.mode);
  const [opens, setOpens] = useState(toAustinInput(initialWindow.opensAt));
  const [closes, setCloses] = useState(toAustinInput(initialWindow.closesAt));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveWindow(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const value: RecruitmentWindow = { mode, opensAt: mode === "scheduled" ? fromAustinInput(opens) : null, closesAt: mode === "scheduled" ? fromAustinInput(closes) : null };
      const response = await fetch("/api/internal-transfer-admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...value, action: "window" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setWindow(value); setMessage(result.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save the transfer window."); }
    finally { setBusy(false); }
  }

  async function saveReview(event: FormEvent<HTMLFormElement>, transfer: InternalTransfer) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/internal-transfer-admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "review", userId: transfer.user_id, decision: form.get("decision"), notes: form.get("notes") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setTransfers(current => current.map(item => item.user_id === transfer.user_id ? { ...item, decision: String(form.get("decision")) as InternalTransfer["decision"], notes: String(form.get("notes")) } : item));
      setMessage(result.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save the transfer review."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-8">
    <form onSubmit={saveWindow} className="portal-card space-y-6">
      <div><h2 className="text-2xl font-bold">Internal transfer window</h2><p className="mt-2 text-sm text-gray-400">This schedule is separate from general recruiting. Times use Austin time.</p><p className="mt-3 text-sm text-accent">{window.mode === "open" ? "Internal transfer requests are open." : window.mode === "scheduled" && window.opensAt && window.closesAt ? `Scheduled to open ${formatAustinDate(window.opensAt)} and close ${formatAustinDate(window.closesAt)}.` : "Internal transfer requests are closed."}</p></div>
      <label className="form-field">Window status<select value={mode} onChange={event => setMode(event.target.value as RecruitmentWindow["mode"])}><option value="closed">Closed</option><option value="scheduled">Scheduled</option><option value="open">Open now</option></select></label>
      {mode === "scheduled" && <div className="grid gap-5 sm:grid-cols-2"><label className="form-field">Opens at<input type="datetime-local" value={opens} onChange={event => setOpens(event.target.value)} required /></label><label className="form-field">Closes at<input type="datetime-local" value={closes} onChange={event => setCloses(event.target.value)} required /></label></div>}
      <button className="button" disabled={busy}>{busy ? "Saving…" : "Save transfer window"}</button>
    </form>
    <section className="space-y-5"><div><h2 className="text-2xl font-bold">Transfer requests</h2><p className="mt-2 text-sm text-gray-400">{transfers.length} request{transfers.length === 1 ? "" : "s"}</p></div>
      {transfers.map(transfer => <article className="portal-card space-y-5" key={transfer.user_id}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{transfer.answers.email ?? "Applicant"}</h3><p className="mt-1 text-xs text-gray-400">Submitted {transfer.submitted_at ? new Date(transfer.submitted_at).toLocaleString() : "—"} · {transfer.user_id}</p></div><span className="rounded-full border border-white/15 px-3 py-1 text-xs">{transfer.decision}</span></div>
        <dl className="grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-gray-400">Current team</dt><dd>{transfer.answers.currentTeam}</dd></div><div><dt className="text-gray-400">First choice</dt><dd>{transfer.answers.team1}</dd></div><div><dt className="text-gray-400">Second choice</dt><dd>{transfer.answers.team2}</dd></div></dl>
        <div><h4 className="text-sm text-gray-400">Reason</h4><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{transfer.answers.reason}</p></div>
        <form onSubmit={event => void saveReview(event, transfer)} className="grid gap-4 sm:grid-cols-[1fr_2fr_auto]"><label className="form-field">Decision<select name="decision" defaultValue={transfer.decision}><option value="pending">Pending</option><option value="approved">Approved</option><option value="declined">Declined</option></select></label><label className="form-field">Lead notes<textarea name="notes" defaultValue={transfer.notes} rows={2} maxLength={5000} /></label><button className="button self-end" disabled={busy}>{busy ? "Saving…" : "Save review"}</button></form>
      </article>)}
      {transfers.length === 0 && <div className="portal-card text-sm text-gray-400">No internal transfer requests have been submitted.</div>}
    </section>
    {message && <p role="status" className="rounded border border-white/15 p-3 text-sm">{message}</p>}
  </div>;
}
