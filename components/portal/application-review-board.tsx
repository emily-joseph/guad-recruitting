"use client";
import { useState } from "react";
import { teams, type ApplicationFields } from "@/lib/application-schema";
import { applicantStatuses, applicantStatusLabels, type ApplicantStatus } from "@/lib/applicant-status";
import type { ReviewApplication, ReviewDecision } from "@/lib/server/store";

const decisions: { value: ReviewDecision; label: string }[] = [
  { value: "pending", label: "Keep pending" },
  { value: "pass_to_one_on_one", label: "Pass to one-on-ones" },
  { value: "recommend_team_2", label: "Recommend team #2" },
  { value: "refer_team", label: "Refer to another team" },
  { value: "shared_pool", label: "Release to shared pool" },
  { value: "reject", label: "Reject" },
];

function currentApplicantStatus(application: ReviewApplication): ApplicantStatus {
  if (application.review?.applicant_status) return application.review.applicant_status;
  if (application.review?.decision === "reject") return "rejected";
  if (application.review?.decision === "pass_to_one_on_one") return "accepted_one_on_one";
  return "in_review";
}

export function ApplicationReviewBoard({ initial, canEdit }: { initial: ReviewApplication[]; canEdit: boolean }) {
  const [applications, setApplications] = useState(initial);
  const [message, setMessage] = useState("");

  async function save(application: ReviewApplication, form: HTMLFormElement, kind?: "referral" | "steal") {
    const values = new FormData(form);
    setMessage("Saving…");
    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationUserId: application.user_id,
          stage: values.get("stage"),
          owningTeam: values.get("owningTeam") || null,
          sourceTeam: values.get("sourceTeam") || null,
          decision: kind === "steal" ? "refer_team" : values.get("decision"),
          applicantStatus: values.get("applicantStatus"),
          notes: values.get("notes"),
          notificationKind: kind,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save review.");
      setApplications(current => current.map(item => item.user_id === application.user_id ? { ...item, review: result.review } : item));
      setMessage(kind ? "Team notified and review saved." : "Review and applicant status saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save review.");
    }
  }

  return <div className="space-y-6">
    {message && <p role="status" className="rounded border border-white/15 p-3 text-sm">{message}</p>}
    {applications.map(application => {
      const status = currentApplicantStatus(application);
      return <article className="portal-card" key={application.user_id}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-xl font-bold">{application.answers.name}</h2><p className="mt-1 text-sm text-gray-400">{application.answers.major} · Preferences: {application.answers.team1} → {application.answers.team2}</p></div>
          <span className="rounded-full border border-white/15 px-3 py-1 text-xs">Applicant status: {applicantStatusLabels[status]}</span>
        </div>
        <details className="mt-5"><summary className="cursor-pointer text-sm text-accent">View application and links</summary><ApplicantDetails answers={application.answers} /></details>
        <form className="mt-6 space-y-4" onSubmit={event => { event.preventDefault(); void save(application, event.currentTarget); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="form-field">Status shown to applicant<select name="applicantStatus" defaultValue={status} disabled={!canEdit}>{applicantStatuses.map(value => <option value={value} key={value}>{applicantStatusLabels[value]}</option>)}</select><span className="field-hint">Private routing decisions and notes are not shown to applicants.</span></label>
            <label className="form-field">Internal routing decision<select name="decision" defaultValue={application.review?.decision ?? "pending"} disabled={!canEdit}>{decisions.map(decision => <option value={decision.value} key={decision.value}>{decision.label}</option>)}</select></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="form-field">Internal stage<select name="stage" defaultValue={application.review?.stage ?? "group_interview"} disabled={!canEdit}><option value="group_interview">Group interview</option><option value="one_on_one">One-on-one</option><option value="shared_pool">Shared pool</option><option value="closed">Closed</option></select></label>
            <TeamSelect label="Receiving team" name="owningTeam" initial={application.review?.owning_team ?? ""} disabled={!canEdit} />
            <TeamSelect label="Source team" name="sourceTeam" initial="" disabled={!canEdit} />
          </div>
          <label className="form-field">Private group interview notes<textarea name="notes" rows={5} defaultValue={application.review?.notes ?? ""} disabled={!canEdit} maxLength={10000} /></label>
          {canEdit && <div className="flex flex-wrap gap-3"><button className="button">Save review</button><button type="button" className="button button-secondary" onClick={event => { if (event.currentTarget.form) void save(application, event.currentTarget.form, "referral"); }}>Refer + notify team</button>{["shared_pool", "reject"].includes(application.review?.decision ?? "") && <button type="button" className="button button-secondary" onClick={event => { if (event.currentTarget.form) void save(application, event.currentTarget.form, "steal"); }}>Claim released applicant</button>}</div>}
          {application.notifications.length > 0 && <ul className="mt-4 space-y-1 text-sm text-gray-400">{application.notifications.slice(0, 3).map(notification => <li key={notification.id}>• {notification.message}</li>)}</ul>}
          {!canEdit && <p className="text-sm text-gray-400">View-only access.</p>}
        </form>
      </article>;
    })}
    {applications.length === 0 && <div className="portal-card text-gray-400">No submitted applications yet.</div>}
  </div>;
}

function TeamSelect({ label, name, initial, disabled }: { label: string; name: string; initial: string; disabled: boolean }) {
  return <label className="form-field">{label}<select name={name} defaultValue={initial} disabled={disabled}><option value="">None</option>{teams.map(team => <option value={team} key={team}>{team}</option>)}</select></label>;
}

function ApplicantDetails({ answers }: { answers: ApplicationFields }) {
  return <dl className="mt-4 grid gap-3 text-sm text-gray-300">{Object.entries(answers).map(([key, value]) => <div key={key}><dt className="text-accent">{key}</dt><dd className="whitespace-pre-wrap">{key === "resumeUrl" || key === "portfolioUrl" ? value ? <a href={value} target="_blank" rel="noreferrer" className="underline">{key === "resumeUrl" ? "Open resume link" : "Open portfolio website"}</a> : "Not provided" : value}</dd></div>)}</dl>;
}
