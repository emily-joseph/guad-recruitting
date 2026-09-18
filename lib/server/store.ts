import "server-only";
import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ApplicationFields } from "../application-schema";
import { CYCLE, closedWindow, type RecruitmentWindow } from "../recruitment-window";
import { backendReady, testMode } from "./config";
import { database } from "./supabase";
import type { Applicant } from "./session";

export type Attachment = { path: string; name: string; size: number };
export type ApplicationRecord = {
  user_id: string; cycle: string; answers: ApplicationFields;
  resume: Attachment | null; portfolio: Attachment | null;
  submitted_at: string | null; updated_at: string;
};
const root = path.join(process.cwd(), ".local-recruitment");
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
  const { data, error } = await database().from("recruitment_windows").select("mode, opens_at, closes_at").eq("cycle", CYCLE).maybeSingle();
  if (error) throw new Error("Recruitment settings are temporarily unavailable.");
  return data ? { mode: data.mode, opensAt: data.opens_at, closesAt: data.closes_at } : closedWindow;
}
export async function saveWindow(value: RecruitmentWindow) {
  if (testMode()) return localWrite("window.json", value);
  const { error } = await database().from("recruitment_windows").upsert({ cycle: CYCLE, mode: value.mode, opens_at: value.opensAt, closes_at: value.closesAt });
  if (error) throw new Error("Could not save recruitment settings.");
}
export async function getApplication(user: Applicant): Promise<ApplicationRecord | null> {
  if (user.test) return localRead(`application-${user.id}.json`, null);
  const { data, error } = await database().from("applications").select("*").eq("user_id", user.id).eq("cycle", CYCLE).maybeSingle();
  if (error) throw new Error("Could not load your application. Please try again.");
  return data as ApplicationRecord | null;
}
export async function saveApplication(user: Applicant, record: ApplicationRecord) {
  if (user.test) return localWrite(`application-${user.id}.json`, record);
  const { error } = await database().from("applications").upsert(record, { onConflict: "user_id,cycle" });
  if (error) throw new Error("Your application could not be saved. The deadline may have passed, or this application was already submitted. Refresh to check its status.");
}
export async function saveAttachment(user: Applicant, file: File, bytes: Uint8Array): Promise<Attachment> {
  const key = `${user.id}/${CYCLE}/${randomUUID()}.pdf`;
  if (user.test) {
    const target = path.join(root, "uploads", key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { mode: 0o600 });
  } else {
    const { error } = await database().storage.from("application-files").upload(key, bytes, { contentType: "application/pdf", upsert: false });
    if (error) throw new Error("Could not upload your PDF. Please try again.");
  }
  return { path: key, name: file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(-150), size: bytes.length };
}
export async function removeAttachment(user: Applicant, attachment: Attachment) {
  if (!attachment.path.startsWith(`${user.id}/${CYCLE}/`)) throw new Error("Invalid attachment owner.");
  if (user.test) await unlink(path.join(root, "uploads", attachment.path));
  else {
    const { error } = await database().storage.from("application-files").remove([attachment.path]);
    if (error) throw new Error("Could not remove the old attachment.");
  }
}
export async function readAttachment(user: Applicant, attachment: Attachment): Promise<Uint8Array> {
  if (!attachment.path.startsWith(`${user.id}/${CYCLE}/`)) throw new Error("Invalid attachment owner.");
  if (user.test) return readFile(path.join(root, "uploads", attachment.path));
  const { data, error } = await database().storage.from("application-files").download(attachment.path);
  if (error) throw new Error("Could not download this file.");
  return new Uint8Array(await data.arrayBuffer());
}
