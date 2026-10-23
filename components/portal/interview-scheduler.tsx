"use client";
import { useState, type FormEvent } from "react";
type Slot = { id: string; starts_at: string; ends_at: string; booked_by: string | null; location: string; preparation: string; attire: string; invitation_sent_at: string | null; applicant: { name?: string; email?: string } | null };
export function InterviewScheduler({ initialBooked }: { initialBooked: Slot[] }) {
	const [slots, setSlots] = useState([{ start: "", end: "" }]);
	const [booked, setBooked] = useState(initialBooked);
	const [message, setMessage] = useState("");
	const [busy, setBusy] = useState(false);
	async function load() { const response = await fetch("/api/interviews"); const data = await response.json(); if (response.ok) setBooked(data.booked ?? []); else setMessage(data.error); }
	async function publish(event: FormEvent<HTMLFormElement>) {
		event.preventDefault(); setBusy(true); setMessage("");
		try {
			const values = slots.filter(slot => slot.start && slot.end).map(slot => ({ startsAt: new Date(slot.start).toISOString(), endsAt: new Date(slot.end).toISOString() }));
			const response = await fetch("/api/interviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish", slots: values }) });
			const data = await response.json(); if (!response.ok) throw new Error(data.error);
			setMessage(data.emailConfigured ? `Published ${data.slots.length} times and emailed ${data.notified} of ${data.eligible} eligible applicants.` : `Published ${data.slots.length} times. Email delivery is not configured, so applicants can see them after signing in.`);
			setSlots([{ start: "", end: "" }]); await load();
		} catch (error) { setMessage(error instanceof Error ? error.message : "Could not publish times."); }
		finally { setBusy(false); }
	}
	async function invite(event: FormEvent<HTMLFormElement>, slot: Slot) {
		event.preventDefault(); setBusy(true); setMessage(""); const form = new FormData(event.currentTarget);
		try {
			const response = await fetch("/api/interviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "invite", slotId: slot.id, location: form.get("location"), preparation: form.get("preparation"), attire: form.get("attire") }) });
			const data = await response.json(); if (!response.ok) throw new Error(data.error);
			setMessage(data.message); await load();
		} catch (error) { setMessage(error instanceof Error ? error.message : "Could not send invitation."); }
		finally { setBusy(false); }
	}
	return <div className="space-y-8">
		<section className="portal-card"><h2 className="text-2xl font-bold">Publish interview times</h2><p className="mt-3 text-sm text-gray-400">Passed applicants can each reserve one open time. Times use your device timezone.</p><form onSubmit={event => void publish(event)} className="mt-6 space-y-5"><div className="space-y-4">{slots.map((slot, index) => <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" key={index}><label className="form-field">Start<input type="datetime-local" required value={slot.start} onChange={event => setSlots(current => current.map((item, i) => i === index ? { ...item, start: event.target.value } : item))} /></label><label className="form-field">End<input type="datetime-local" required value={slot.end} onChange={event => setSlots(current => current.map((item, i) => i === index ? { ...item, end: event.target.value } : item))} /></label><button className="button button-secondary self-end" type="button" aria-label="Remove time" disabled={slots.length === 1} onClick={() => setSlots(current => current.filter((_, i) => i !== index))}>Remove</button></div>)}</div><div className="flex flex-wrap gap-3"><button type="button" className="button button-secondary" onClick={() => setSlots(current => [...current, { start: "", end: "" }])}>Add time</button><button className="button" disabled={busy}>{busy ? "Publishing…" : "Publish availability"}</button></div></form></section>
		<section className="portal-card"><h2 className="text-2xl font-bold">Booked interviews</h2><div className="mt-5 space-y-5">{booked.map(slot => <article className="border-t border-white/10 pt-5" key={slot.id}><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">{slot.applicant?.name ?? "Applicant"}</h3><p className="text-sm text-gray-400">{slot.applicant?.email} · {new Date(slot.starts_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p></div><span className="text-xs text-gray-400">{slot.invitation_sent_at ? "Invitation sent" : "Invitation pending"}</span></div>{!slot.invitation_sent_at && <form onSubmit={event => void invite(event, slot)} className="mt-4 grid gap-4 sm:grid-cols-2"><label className="form-field sm:col-span-2">Location<input name="location" defaultValue={slot.location} required maxLength={300} /></label><label className="form-field">What to prepare<textarea name="preparation" defaultValue={slot.preparation} required rows={3} maxLength={2000} /></label><label className="form-field">What to wear<textarea name="attire" defaultValue={slot.attire} required rows={3} maxLength={500} /></label><button className="button sm:col-span-2" disabled={busy}>Send formal invitation</button></form>}{slot.invitation_sent_at && <p className="mt-3 text-sm text-gray-400">{slot.location} · {slot.preparation} · {slot.attire}</p>}</article>)}{booked.length === 0 && <p className="text-sm text-gray-400">No applicants have reserved a time yet.</p>}</div></section>
		{message && <p role="status" className="rounded border border-white/15 p-3 text-sm">{message}</p>}
	</div>;
}
