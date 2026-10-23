"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { applicationSchema, blankApplication, classifications, essayQuestions, referralOptions, teams, wordCount, type ApplicationFields } from "@/lib/application-schema";
import type { ApplicationRecord } from "@/lib/server/store";
import { CYCLE_TITLE, formatAustinDate } from "@/lib/recruitment-window";

const fieldLabels: Record<keyof ApplicationFields, string> = { name: "Name", email: "Email address", eid: "UT EID", classification: "Classification", major: "Major", referral: "How did you hear about Texas Guadaloop?", referralOther: "How did you hear about us?", team1: "Team preference #1", team2: "Team preference #2", infoSession: "Have you attended an info session?", resumeUrl: "Resume Google Drive link", portfolioUrl: "Portfolio website (optional)", leadership: "Leadership", setback: "Setbacks", motivation: "Why Guadaloop", song: "Favorite song as of now?", movie: "Favorite movie as of now?" };
function Field({ name, children, error, optional = false }: { name: keyof ApplicationFields; children: ReactNode; error?: string; optional?: boolean }) {
  return <div className="form-field"><label htmlFor={name}>{fieldLabels[name]} {!optional && <span aria-hidden="true" className="text-accent">*</span>}</label>{children}{error && <p id={`${name}-error`} className="text-sm text-red-300">{error}</p>}</div>;
}
export function ApplicationForm({ email, initial, accepting, test }: { email: string; initial: ApplicationRecord | null; accepting: boolean; test: boolean }) {
  const [answers, setAnswers] = useState<ApplicationFields>(initial?.answers ?? blankApplication(email));
  const [record, setRecord] = useState(initial);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [emailSent, setEmailSent] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [reviewing, setReviewing] = useState(false);
  const locked = !accepting || Boolean(record?.submitted_at);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function update(name: keyof ApplicationFields, value: string) { setAnswers(previous => ({ ...previous, [name]: value })); setDirty(true); setMessage(""); setReviewing(false); }
  function input(name: keyof ApplicationFields, options: { readOnly?: boolean; type?: string; optional?: boolean } = {}) {
    const { optional, ...inputOptions } = options;
    return <Field name={name} error={errors[name]} optional={optional}><input id={name} name={name} value={answers[name]} onChange={event => update(name, event.target.value)} required={!optional} maxLength={name === "resumeUrl" || name === "portfolioUrl" ? 2048 : 300} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined} autoComplete={name === "name" ? "name" : name === "email" ? "email" : "off"} {...inputOptions} /></Field>;
  }
  function select(name: keyof ApplicationFields, options: readonly string[]) {
    return <Field name={name} error={errors[name]}><select id={name} name={name} value={answers[name]} onChange={event => update(name, event.target.value)} required aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined}><option value="">Select an option</option>{options.map(value => <option value={value} key={value}>{value}</option>)}</select></Field>;
  }
  function changeStep(value: number) { setStep(value); setTimeout(() => heading.current?.focus(), 0); }
  function review() {
    const result = applicationSchema.safeParse(answers);
    const nextErrors: Record<string, string> = result.success ? {} : Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]), issue.message]));
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("Please complete the required fields and check the highlighted answers.");
      const firstSection = ["name", "email", "eid", "classification", "major", "referral", "referralOther", "team1", "team2"];
      changeStep(Object.keys(nextErrors).some(key => firstSection.includes(key)) ? 1 : 2);
    } else { setReviewing(true); setMessage(""); }
  }
  async function save(intent: "draft" | "submit") {
    setBusy(true); setErrors({}); setMessage("");
    try {
      const response = await fetch("/api/application", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, intent }) });
      const result = await response.json();
      if (!response.ok) { setErrors(result.errors ?? {}); throw new Error(result.error); }
      setRecord(result.record); setDirty(false); setReviewing(false); if (intent === "submit") setEmailSent(Boolean(result.emailSent));
      setMessage(result.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save. Your answers are still on this page; please try again."); }
    finally { setBusy(false); }
  }
  if (record?.submitted_at) return <div className="space-y-6"><div className="portal-card border-green-500/30"><p className="text-sm text-green-300">{test ? "Test submission complete" : "Application submitted"}</p><h2 className="mt-3 text-3xl font-bold">Thank you, {record.answers.name}.</h2><p className="mt-4 text-gray-300">Your {CYCLE_TITLE} application was received {formatAustinDate(record.submitted_at)}.</p>{!test && <p className="mt-3 text-sm text-gray-400">{emailSent ? `A confirmation email was sent to ${email}.` : "This page is your submission receipt. A confirmation email could not be sent automatically."}</p>}<p className="mt-3 text-sm text-gray-400">Your submission is now read-only. Questions? Contact <a className="text-accent" href="mailto:guadaloop.recruiting@gmail.com">guadaloop.recruiting@gmail.com</a>.</p></div><ApplicationReview answers={record.answers} /></div>;
  return <>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 text-sm"><span className="text-gray-400">{record ? `Last saved ${formatAustinDate(record.updated_at)}` : "No saved draft yet"}{dirty ? " · Unsaved changes" : ""}</span><span className="rounded-full border border-white/15 px-3 py-1">Draft</span></div>
    <div className="mb-8 grid grid-cols-2 gap-3">{["About you", "Application questions"].map((label, index) => <button key={label} type="button" aria-current={step === index + 1 ? "step" : undefined} onClick={() => changeStep(index + 1)} className={`rounded-lg border px-4 py-4 text-left text-sm ${step === index + 1 ? "border-accent bg-accent/10" : "border-white/15 text-gray-400"}`}>{index + 1}. {label}</button>)}</div>
    <form onSubmit={event => { event.preventDefault(); review(); }} noValidate className="portal-card">
      <h2 ref={heading} tabIndex={-1} className="mb-2 text-2xl font-bold">{step === 1 ? "About you" : "Application questions"}</h2><p className="mb-8 text-sm text-gray-400">{step === 1 ? "Tell us a little about yourself and where you want to contribute." : "Help us get to know you and understand how you collaborate in a team."} All fields are required unless marked optional.</p>
      <fieldset disabled={locked || busy} className="min-w-0 disabled:opacity-70">
        <div hidden={step !== 1} className="space-y-6"><div className="grid gap-6 sm:grid-cols-2">{input("name")}{input("email", { type: "email", readOnly: true })}{input("eid")}{select("classification", classifications)}</div>{input("major")}{select("referral", referralOptions)}{answers.referral === "Other" && input("referralOther")}{select("team1", teams)}{select("team2", teams)}<p className="field-hint">Choose two different teams, in order of preference.</p></div>
        <div hidden={step !== 2} className="space-y-9">
          <div>{select("infoSession", ["Yes", "No"])}<p className="mt-3 text-sm leading-6 text-gray-400">You should attend an info session before applying. Spring session dates will be announced. If you cannot attend, reach out to <a className="text-accent" href="mailto:guadaloop.recruiting@gmail.com">guadaloop.recruiting@gmail.com</a>.</p></div>
          <div className="grid gap-6 sm:grid-cols-2">{input("resumeUrl", { type: "url" })}{input("portfolioUrl", { type: "url", optional: true })}</div><p className="field-hint">Make sure recruiting volunteers can open your resume. Set its Google Drive sharing to “Anyone with the link” or share it with the recruiting team. Portfolio links may point to any website.</p>
          {essayQuestions.map(question => <div className="form-field" key={question.key}><label htmlFor={question.key} className="text-lg font-semibold">{question.title} <span className="text-accent">*</span></label><p id={`${question.key}-prompt`} className="text-sm font-normal leading-7 text-gray-300">{question.prompt}</p><textarea id={question.key} value={answers[question.key]} onChange={event => update(question.key, event.target.value)} rows={7} required maxLength={15000} aria-invalid={Boolean(errors[question.key]) || wordCount(answers[question.key]) > 250} aria-describedby={`${question.key}-prompt ${question.key}-count`} /><div className="flex justify-between gap-3 text-xs"><span className="text-red-300">{errors[question.key]}</span><span id={`${question.key}-count`} className={wordCount(answers[question.key]) > 250 ? "text-red-300" : "text-gray-400"}>{wordCount(answers[question.key])} / 250 words</span></div></div>)}
          <div className="border-t border-white/10 pt-8"><h3 className="mb-6 text-xl font-bold">And two just for fun.</h3><div className="grid gap-6 sm:grid-cols-2">{input("song")}{input("movie")}</div></div>
        </div>
      </fieldset>
      {message && <p role="status" className="mt-6 rounded-md border border-white/20 p-4 text-sm">{message}</p>}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6"><button type="button" className="button button-secondary" disabled={locked || busy} onClick={() => void save("draft")}>{busy ? "Saving…" : "Save draft"}</button>{step === 1 ? <button type="button" className="button" onClick={() => changeStep(2)}>Continue to questions →</button> : <div className="flex flex-wrap gap-3"><button type="button" className="button button-secondary" onClick={() => changeStep(1)}>Back</button><button type="submit" className="button" disabled={locked || busy}>Review application</button></div>}</div>
    </form>
    {reviewing && <section className="mt-8 space-y-6" aria-label="Review before submitting"><h2 className="text-2xl font-bold">Review your application</h2><ApplicationReview answers={answers} /><div className="portal-card"><p className="mb-5 text-sm leading-7 text-gray-300">Make sure your answers and links are ready. You cannot edit your application after submitting.</p><button type="button" disabled={busy || locked} onClick={() => void save("submit")} className="button">{busy ? "Submitting…" : test ? "Submit test application" : "Submit application"}</button></div></section>}
  </>;
}
function ApplicationReview({ answers }: { answers: ApplicationFields; resume?: string; portfolio?: string; saved?: boolean }) {
  return <div className="portal-card"><dl className="space-y-5">{Object.entries(answers).filter(([key]) => key !== "referralOther" || answers.referral === "Other").map(([key, value]) => <div key={key}><dt className="text-sm text-accent">{fieldLabels[key as keyof ApplicationFields]}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-7 text-gray-300">{key === "resumeUrl" || key === "portfolioUrl" ? value ? <a className="text-accent underline" href={value} target="_blank" rel="noreferrer">{key === "resumeUrl" ? "Open resume in Google Drive" : "Open portfolio website"}</a> : "Not provided" : value}</dd></div>)}</dl></div>;
}
