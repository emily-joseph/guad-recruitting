import { z } from "zod";

export const CYCLE = "spring-2027";
export const CYCLE_TITLE = "Spring 2027";
export const windowSchema = z.object({
  mode: z.enum(["closed", "open", "scheduled"]),
  opensAt: z.iso.datetime({ offset: true }).nullable(), closesAt: z.iso.datetime({ offset: true }).nullable(),
}).superRefine((value, ctx) => {
  if (value.mode !== "scheduled") return;
  const start = Date.parse(value.opensAt ?? "");
  const end = Date.parse(value.closesAt ?? "");
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    ctx.addIssue({ code: "custom", message: "Choose an opening time and a later closing time." });
  }
});
export type RecruitmentWindow = z.infer<typeof windowSchema>;
export const closedWindow: RecruitmentWindow = { mode: "closed", opensAt: null, closesAt: null };
export function isAccepting(window: RecruitmentWindow, now = Date.now()): boolean {
  if (window.mode === "closed") return false;
  if (window.mode === "open") return true;
  const start = Date.parse(window.opensAt ?? "");
  const end = Date.parse(window.closesAt ?? "");
  return Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end;
}
export function formatAustinDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}
export function windowMessage(window: RecruitmentWindow, now = Date.now()) {
  if (window.mode === "open") return "Applications are open.";
  if (window.mode === "scheduled" && window.opensAt && window.closesAt) {
    if (now < Date.parse(window.opensAt)) return `Applications open ${formatAustinDate(window.opensAt)}.`;
    if (isAccepting(window, now)) return `Apply before ${formatAustinDate(window.closesAt)}.`;
  }
  return "Applications are currently closed. Check back for spring recruitment dates.";
}
export function toAustinInput(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)).replace(" ", "T");
}
// Match possible CST/CDT offsets against the actual IANA zone, rejecting DST gaps and overlaps.
export function fromAustinInput(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Enter a complete date and time.");
  const base = Date.parse(`${value}:00Z`);
  const candidates = [5, 6].map(offset => new Date(base + offset * 3600000).toISOString()).filter(iso => toAustinInput(iso) === value);
  if (candidates.length !== 1) throw new Error("This Austin time is missing or ambiguous due to daylight saving time. Choose a different hour.");
  return candidates[0];
}
