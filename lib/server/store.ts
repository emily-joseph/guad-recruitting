import "server-only";
import { mkdir, readFile, writeFile, rename, readdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ApplicationFields } from "../application-schema";
import type { ApplicantStatus } from "../applicant-status";
import { CYCLE, closedWindow, type RecruitmentWindow } from "../recruitment-window";
import { backendReady, testMode } from "./config";
import { firestore } from "./firebase";
import { recruitingTeamEmail, sendRecruitingEmail } from "./email";
import type { Applicant, RecruitingRole } from "./session";

export type ApplicationRecord = {
  user_id: string; cycle: string; answers: ApplicationFields;
  submitted_at: string | null; updated_at: string; reminder_sent_at?: string | null;
};
export type DraftApplicant = { user_id: string; name: string; email: string; updated_at: string; reminder_sent_at: string | null };
export type ReviewDecision = "pending" | "pass_to_one_on_one" | "recommend_team_2" | "refer_team" | "shared_pool" | "reject";
export type ApplicationReview = { application_user_id: string; cycle: string; stage: string; owning_team: string | null; decision: ReviewDecision; applicant_status: ApplicantStatus; notes: string; updated_at: string };
export type RecruitingNotification = { id: string; application_user_id: string; recipient_team: string; source_team: string | null; kind: "referral" | "steal"; message: string; created_at: string };
export type MemberAccess = { email: string; role: RecruitingRole; granted_at: string };
export type InterviewOffering = { id: string; cycle: string; starts_at: string; ends_at: string; booked_by: string | null; booked_at: string | null; location: string; preparation: string; attire: string; google_calendar_event_url: string | null; invitation_sent_at: string | null; created_by: string | null; created_at: string };
export type ApplicationMetrics = { started: number; submitted: number; teams: { team: string; first: number; second: number; total: number }[] };
export type ReviewApplication = ApplicationRecord & { review: ApplicationReview | null; notifications: RecruitingNotification[] };
export type ApplicantApplicationProgress = { hasApplication: boolean; submittedAt: string | null; status: ApplicantStatus | null; team: string | null; updatedAt: string | null };
export type InternalTransferWindow = RecruitmentWindow;
export type InternalTransfer = { user_id: string; cycle: string; answers: { currentTeam: string; team1: string; team2: string; reason: string; email?: string }; submitted_at: string | null; updated_at: string; decision: "pending" | "approved" | "declined"; notes: string };
export type GroupInterviewRun = { id: string; interview_day: string; groups: { number: number; volunteers: string[]; applicants: { id: string; name: string }[] }[]; created_at: string };
const TRANSFER_CYCLE = "spring-2027-transfer";
const root = path.join(process.cwd(), ".local-recruitment");
const db = () => firestore();
const appDoc = (userId: string) => db().collection("applications").doc(`${CYCLE}_${userId}`);
const reviewDoc = (userId: string) => db().collection("application_reviews").doc(`${CYCLE}_${userId}`);
const slotCollection = () => db().collection("interview_slot_offerings");
async function listRecords<T>(collection: string, predicate: (value: Record<string, unknown>) => boolean = () => true): Promise<T[]> {
  const snapshot = await db().collection(collection).get();
  return snapshot.docs.map(doc => doc.data()).filter(predicate) as T[];
}
async function localRead<T>(name: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(path.join(root, name), "utf8")) as T; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback; throw error; }
}
async function localWrite(name: string, data: unknown) {
  await mkdir(root, { recursive: true });
  const target = path.join(root, name);
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(data), { mode: 0o600 });
  await rename(temporary, target);
}
// Serialize local writes, including schedule changes and final submissions.
const state = globalThis as typeof globalThis & { guadWrites?: Promise<unknown> };
export async function withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  if (!testMode()) return operation();
  const pending = (state.guadWrites ?? Promise.resolve()).then(operation, operation);
  state.guadWrites = pending.catch(() => undefined);
  return pending;
}
export async function getWindow(): Promise<RecruitmentWindow> {
  if (testMode()) return localRead("window.json", closedWindow);
  if (!backendReady()) return closedWindow;
  const doc = await db().collection("recruitment_windows").doc(CYCLE).get();
  const data = doc.data();
  return data ? { mode: data.mode, opensAt: data.opens_at, closesAt: data.closes_at } : closedWindow;
}
export async function saveWindow(value: RecruitmentWindow) {
  if (testMode()) return localWrite("window.json", value);
  await db().collection("recruitment_windows").doc(CYCLE).set({ cycle: CYCLE, mode: value.mode, opens_at: value.opensAt, closes_at: value.closesAt });
}
export async function getInternalTransferWindow(): Promise<InternalTransferWindow> {
  if (testMode()) return localRead("transfer-window.json", closedWindow);
  const data = (await db().collection("internal_transfer_windows").doc(TRANSFER_CYCLE).get()).data();
  return data ? { mode: data.mode, opensAt: data.opens_at, closesAt: data.closes_at } : closedWindow;
}
export async function saveInternalTransferWindow(value: InternalTransferWindow) {
  if (testMode()) return localWrite("transfer-window.json", value);
  await db().collection("internal_transfer_windows").doc(TRANSFER_CYCLE).set({ cycle: TRANSFER_CYCLE, mode: value.mode, opens_at: value.opensAt, closes_at: value.closesAt });
}
export async function getGroupInterviewRuns(): Promise<GroupInterviewRun[]> {
  if (testMode()) return localRead<GroupInterviewRun[]>("group-interview-runs.json", []);
  return (await listRecords<GroupInterviewRun & { cycle: string }>("group_interview_runs", row => row.cycle === CYCLE)).sort((a,b) => b.interview_day.localeCompare(a.interview_day) || b.created_at.localeCompare(a.created_at));
}
export async function saveGroupInterviewRun(user: Applicant, day: string, groups: GroupInterviewRun["groups"]): Promise<GroupInterviewRun> {
  const run: GroupInterviewRun = { id: randomUUID(), interview_day: day, groups, created_at: new Date().toISOString() };
  if (testMode()) {
    await localWrite("group-interview-runs.json", [run, ...(await getGroupInterviewRuns())]);
    return run;
  }
  await db().collection("group_interview_runs").doc(run.id).set({ ...run, cycle: CYCLE, created_by: user.id });
  return run;
}
export async function getInternalTransfers(): Promise<InternalTransfer[]> {
  if (testMode()) return localRead<InternalTransfer[]>("internal-transfers.json", []);
  return (await listRecords<InternalTransfer>("internal_transfers", row => row.cycle === TRANSFER_CYCLE)).sort((a,b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""));
}
export async function saveInternalTransfer(userId: string, answers: InternalTransfer["answers"]) {
  const now = new Date().toISOString();
  if (testMode()) {
    const current = await getInternalTransfers();
    const existing = current.find(transfer => transfer.user_id === userId);
    await localWrite("internal-transfers.json", [{ user_id: userId, cycle: TRANSFER_CYCLE, answers, submitted_at: now, updated_at: now, decision: existing?.decision ?? "pending", notes: existing?.notes ?? "" }, ...current.filter(transfer => transfer.user_id !== userId)]);
    return;
  }
  const ref = db().collection("internal_transfers").doc(`${TRANSFER_CYCLE}_${userId}`);
  const existing = (await ref.get()).data();
  await ref.set({ user_id: userId, cycle: TRANSFER_CYCLE, answers, submitted_at: now, updated_at: now, decision: existing?.decision ?? "pending", notes: existing?.notes ?? "" });
}
export async function reviewInternalTransfer(userId: string, decision: InternalTransfer["decision"], notes: string) {
  if (testMode()) {
    const current = await getInternalTransfers();
    const index = current.findIndex(transfer => transfer.user_id === userId);
    if (index < 0) throw new Error("Internal transfer request not found.");
    current[index] = { ...current[index], decision, notes, updated_at: new Date().toISOString() };
    await localWrite("internal-transfers.json", current);
    return;
  }
  await db().collection("internal_transfers").doc(`${TRANSFER_CYCLE}_${userId}`).update({ decision, notes, updated_at: new Date().toISOString() });
}
export async function getApplication(user: Applicant): Promise<ApplicationRecord | null> {
  if (user.test) return localRead(`application-${user.id}.json`, null);
  const data = (await appDoc(user.id).get()).data();
  return (data as ApplicationRecord | undefined) ?? null;
}
export async function getApplicantApplicationProgress(user: Applicant): Promise<ApplicantApplicationProgress> {
  const application = await getApplication(user);
  if (!application) return { hasApplication: false, submittedAt: null, status: null, team: null, updatedAt: null };
  if (!application.submitted_at) return { hasApplication: true, submittedAt: null, status: null, team: null, updatedAt: application.updated_at };
  if (user.test) {
    const review = await localRead<ApplicationReview | null>(`review-${user.id}.json`, null);
    let status = review?.applicant_status ?? legacyApplicantStatus(review?.decision);
    if (status === "accepted_one_on_one" && (await getInterviewOfferings()).some(slot => slot.booked_by === user.id)) status = "waiting_one_on_one";
    return { hasApplication: true, submittedAt: application.submitted_at, status, team: review?.owning_team ?? null, updatedAt: review?.updated_at ?? null };
  }
  const data = (await reviewDoc(user.id).get()).data();
  const decision = data?.decision as ReviewDecision | undefined;
  let status = (data?.applicant_status as ApplicantStatus | undefined) ?? legacyApplicantStatus(decision);
  if (status === "accepted_one_on_one") {
    if ((await getInterviewOfferings()).some(slot => slot.booked_by === user.id)) status = "waiting_one_on_one";
  }
  return { hasApplication: true, submittedAt: application.submitted_at, status, team: (data?.owning_team as string | null | undefined) ?? null, updatedAt: (data?.updated_at as string | undefined) ?? null };
}
function legacyApplicantStatus(decision?: ReviewDecision | null): ApplicantStatus {
  if (decision === "pass_to_one_on_one") return "accepted_one_on_one";
  if (decision === "reject") return "rejected";
  return "in_review";
}
export async function saveApplication(user: Applicant, record: ApplicationRecord) {
  if (user.test) return localWrite(`application-${user.id}.json`, record);
  const ref = appDoc(user.id);
  await db().runTransaction(async transaction => {
    const current = await transaction.get(ref);
    if (current.data()?.submitted_at && !record.submitted_at) throw new Error("This application has already been submitted.");
    transaction.set(ref, record);
  }).catch(() => { throw new Error("Your application could not be saved. The deadline may have passed, or this application was already submitted. Refresh to check its status."); });
}
export async function getDraftApplicants(): Promise<DraftApplicant[]> {
  let records: ApplicationRecord[];
  if (testMode()) {
    try { records = (await Promise.all((await readdir(root)).filter(name => /^application-[a-f0-9]{32}\.json$/.test(name)).map(name => localRead<ApplicationRecord | null>(name, null)))).filter((record): record is ApplicationRecord => Boolean(record && !record.submitted_at)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  } else {
    records = await listRecords<ApplicationRecord>("applications", row => row.cycle === CYCLE && !row.submitted_at);
    records.sort((a,b) => b.updated_at.localeCompare(a.updated_at));
  }
  return records.map(record => ({ user_id: record.user_id, name: record.answers.name || "Applicant", email: record.answers.email, updated_at: record.updated_at, reminder_sent_at: record.reminder_sent_at ?? null }));
}
export async function claimDraftReminder(userId: string): Promise<boolean> {
  if (testMode()) return withWriteLock(async () => {
    const record = await localRead<ApplicationRecord | null>(`application-${userId}.json`, null);
    if (!record || record.submitted_at || record.reminder_sent_at) return false;
    await localWrite(`application-${userId}.json`, { ...record, reminder_sent_at: new Date().toISOString() });
    return true;
  });
  return db().runTransaction(async transaction => {
    const ref = appDoc(userId); const snapshot = await transaction.get(ref); const record = snapshot.data();
    if (!record || record.submitted_at || record.reminder_sent_at) return false;
    transaction.update(ref, { reminder_sent_at: new Date().toISOString() }); return true;
  });
}
export async function releaseDraftReminder(userId: string) {
  if (testMode()) return withWriteLock(async () => {
    const record = await localRead<ApplicationRecord | null>(`application-${userId}.json`, null);
    if (record && !record.submitted_at) await localWrite(`application-${userId}.json`, { ...record, reminder_sent_at: null });
  });
  await appDoc(userId).update({ reminder_sent_at: null });
}
export async function getApplicationMetrics(): Promise<ApplicationMetrics> {
  let records: ApplicationRecord[];
  if (testMode()) {
    try { records = (await Promise.all((await readdir(root)).filter(name => /^application-[a-f0-9]{32}\.json$/.test(name)).map(name => localRead<ApplicationRecord | null>(name, null)))).filter((record): record is ApplicationRecord => Boolean(record)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") records = []; else throw error; }
  } else {
    records = await listRecords<ApplicationRecord>("applications", row => row.cycle === CYCLE);
  }
  const counts = new Map<string, { first: number; second: number }>();
  for (const record of records) {
    const first = record.answers.team1; const second = record.answers.team2;
    if (first) counts.set(first, { first: (counts.get(first)?.first ?? 0) + 1, second: counts.get(first)?.second ?? 0 });
    if (second) counts.set(second, { first: counts.get(second)?.first ?? 0, second: (counts.get(second)?.second ?? 0) + 1 });
  }
  return { started: records.length, submitted: records.filter(record => Boolean(record.submitted_at)).length, teams: [...counts.entries()].map(([team, count]) => ({ team, ...count, total: count.first + count.second })).sort((a, b) => b.total - a.total || a.team.localeCompare(b.team)) };
}
export async function getMemberAccess(): Promise<MemberAccess[]> {
  if (testMode()) return localRead<MemberAccess[]>("member-access.json", []);
  return (await listRecords<MemberAccess>("recruiting_member_access")).sort((a,b) => a.email.localeCompare(b.email));
}
export async function updateMemberAccess(user: Applicant, email: string, action: "grant" | "revoke", role: RecruitingRole = "viewer") {
  if (testMode()) {
    const current = await getMemberAccess();
    const next = action === "grant" ? [{ email, role, granted_at: new Date().toISOString() }, ...current.filter(member => member.email !== email)] : current.filter(member => member.email !== email);
    await localWrite("member-access.json", next);
    return;
  }
  const ref = db().collection("recruiting_member_access").doc(email.toLowerCase());
  if (action === "grant") await ref.set({ email: email.toLowerCase(), role, granted_by: user.id, granted_at: new Date().toISOString() });
  else await ref.delete();
}
export async function getReviewApplications(): Promise<ReviewApplication[]> {
  if (testMode()) {
    try {
      const records = await Promise.all((await readdir(root)).filter(name => /^application-[a-f0-9]{32}\.json$/.test(name)).map(name => localRead<ApplicationRecord | null>(name, null)));
      return Promise.all(records.filter((record): record is ApplicationRecord => Boolean(record?.submitted_at)).map(async record => ({ ...record, review: await localRead<ApplicationReview | null>(`review-${record.user_id}.json`, null), notifications: await localRead<RecruitingNotification[]>(`notifications-${record.user_id}.json`, []) })));
    } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  }
  const data = await listRecords<ApplicationRecord>("applications", row => row.cycle === CYCLE && Boolean(row.submitted_at));
  data.sort((a,b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""));
  const reviews = await listRecords<ApplicationReview>("application_reviews", row => row.cycle === CYCLE);
  const byApplicant = new Map(reviews.map(review => [review.application_user_id, review]));
  const notifications = await listRecords<RecruitingNotification & { cycle: string }>("recruiting_notifications", row => row.cycle === CYCLE);
  notifications.sort((a,b) => b.created_at.localeCompare(a.created_at));
  const notificationsByApplicant = new Map<string, RecruitingNotification[]>();
  for (const notification of notifications) notificationsByApplicant.set(notification.application_user_id, [...(notificationsByApplicant.get(notification.application_user_id) ?? []), notification]);
  return data.map(record => ({ ...record, review: byApplicant.get(record.user_id) ?? null, notifications: notificationsByApplicant.get(record.user_id) ?? [] }));
}
export async function saveReview(user: Applicant, applicationUserId: string, value: Omit<ApplicationReview, "application_user_id" | "cycle" | "updated_at">) {
  const review: ApplicationReview = { application_user_id: applicationUserId, cycle: CYCLE, ...value, updated_at: new Date().toISOString() };
  if (testMode()) { await localWrite(`review-${applicationUserId}.json`, review); return review; }
  await reviewDoc(applicationUserId).set({ ...review, updated_by: user.id });
  return review;
}
export async function createTeamNotification(applicationUserId: string, recipientTeam: string, sourceTeam: string | null, kind: "referral" | "steal") {
  const message = kind === "steal" ? `${sourceTeam ?? "Another team"} released this applicant; ${recipientTeam} claimed them.` : `${sourceTeam ?? "Recruiting"} referred this applicant to ${recipientTeam}.`;
  const notification: RecruitingNotification = { id: randomUUID(), application_user_id: applicationUserId, recipient_team: recipientTeam, source_team: sourceTeam, kind, message, created_at: new Date().toISOString() };
  if (testMode()) { const current = await localRead<RecruitingNotification[]>(`notifications-${applicationUserId}.json`, []); await localWrite(`notifications-${applicationUserId}.json`, [notification, ...current]); return notification; }
  await db().collection("recruiting_notifications").doc(notification.id).set({ ...notification, cycle: CYCLE });
  const data = (await appDoc(applicationUserId).get()).data();
  const recipient = recruitingTeamEmail(recipientTeam);
  if (recipient && data?.answers?.name) await sendRecruitingEmail({ to: recipient, subject: `Applicant referred to ${recipientTeam}`, text: `${data.answers.name} was ${kind === "steal" ? "claimed" : "referred"} to ${recipientTeam}.${sourceTeam ? ` Source team: ${sourceTeam}.` : ""}\n\nReview the applicant in the recruiting portal.` });
  return notification;
}
export async function getInterviewOfferings(): Promise<InterviewOffering[]> {
  if (testMode()) return localRead<InterviewOffering[]>("interview-offerings.json", []);
  return (await listRecords<InterviewOffering>("interview_slot_offerings", row => row.cycle === CYCLE)).sort((a,b) => a.starts_at.localeCompare(b.starts_at));
}

export async function getOpenInterviewOfferings(applicantId: string): Promise<InterviewOffering[]> {
  return (await getInterviewOfferings()).filter(slot => (!slot.booked_by || slot.booked_by === applicantId) && Date.parse(slot.starts_at) > Date.now());
}

export async function getInterviewAvailability(userId: string): Promise<{ start: string; end: string }[]> {
  if (testMode()) return localRead(`availability-${userId}.json`, []);
  const snapshot = await db().collection("interview_availability").doc(`${CYCLE}_${userId}`).get();
  return (snapshot.data()?.slots ?? []) as { start: string; end: string }[];
}

export async function saveInterviewAvailability(userId: string, slots: { start: string; end: string }[]) {
  if (testMode()) return localWrite(`availability-${userId}.json`, slots);
  await db().collection("interview_availability").doc(`${CYCLE}_${userId}`).set({ application_user_id: userId, cycle: CYCLE, slots, updated_at: new Date().toISOString() });
}

export async function publishInterviewOfferings(user: Applicant, slots: { starts_at: string; ends_at: string }[]) {
  const records = slots.map(slot => ({ ...slot, cycle: CYCLE, created_by: user.id }));
  if (testMode()) {
    const current = await getInterviewOfferings();
    const next = records.map(record => ({ ...record, id: randomUUID(), booked_by: null, booked_at: null, location: "", preparation: "", attire: "", google_calendar_event_url: null, invitation_sent_at: null, created_at: new Date().toISOString() }));
    await localWrite("interview-offerings.json", [...current, ...next]);
    return next;
  }
  const saved = records.map(record => ({ ...record, id: randomUUID(), booked_by: null, booked_at: null, location: "", preparation: "", attire: "", google_calendar_event_url: null, invitation_sent_at: null, created_at: new Date().toISOString() }));
  const batch = db().batch(); saved.forEach(record => batch.set(slotCollection().doc(record.id), record)); await batch.commit();
  return saved;
}

async function markOneOnOneInterviewBooked(userId: string) {
  const now = new Date().toISOString();
  if (testMode()) {
    const review = await localRead<ApplicationReview | null>(`review-${userId}.json`, null);
    if (review) await localWrite(`review-${userId}.json`, { ...review, applicant_status: "waiting_one_on_one", updated_at: now });
    return;
  }
  await reviewDoc(userId).update({ applicant_status: "waiting_one_on_one", updated_at: now });
}

export async function claimInterviewOffering(user: Applicant, id: string): Promise<InterviewOffering | null> {
  if (testMode()) {
    const current = await getInterviewOfferings();
    if (current.some(slot => slot.booked_by === user.id)) return null;
    const index = current.findIndex(slot => slot.id === id && !slot.booked_by && Date.parse(slot.starts_at) > Date.now());
    if (index < 0) return null;
    const claimed = { ...current[index], booked_by: user.id, booked_at: new Date().toISOString() };
    current[index] = claimed;
    await localWrite("interview-offerings.json", current);
    await markOneOnOneInterviewBooked(user.id);
    return claimed;
  }
  const ref = slotCollection().doc(id); const now = new Date().toISOString();
  const data = await db().runTransaction(async transaction => {
    const [target, all] = await Promise.all([transaction.get(ref), transaction.get(slotCollection().where("cycle", "==", CYCLE))]);
    if (all.docs.some(doc => doc.data().booked_by === user.id)) return null;
    const slot = target.data() as InterviewOffering | undefined;
    if (!slot || slot.booked_by || Date.parse(slot.starts_at) <= Date.now()) return null;
    transaction.update(ref, { booked_by: user.id, booked_at: now }); return { ...slot, booked_by: user.id, booked_at: now };
  });
  if (data) await markOneOnOneInterviewBooked(user.id);
  return data;
}

export async function saveInterviewInvitation(user: Applicant, id: string, invitation: Pick<InterviewOffering, "location" | "preparation" | "attire" | "google_calendar_event_url">, sent: boolean): Promise<InterviewOffering | null> {
  const update = { ...invitation, invitation_sent_at: sent ? new Date().toISOString() : null };
  if (testMode()) {
    const current = await getInterviewOfferings();
    const index = current.findIndex(slot => slot.id === id && slot.booked_by);
    if (index < 0) return null;
    current[index] = { ...current[index], ...update };
    await localWrite("interview-offerings.json", current);
    return current[index];
  }
  const ref = slotCollection().doc(id); const snapshot = await ref.get(); const current = snapshot.data() as InterviewOffering | undefined;
  if (!current || current.cycle !== CYCLE || !current.booked_by) return null;
  await ref.update(update); return { ...current, ...update };
}
