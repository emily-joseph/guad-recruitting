import { z } from "zod";

export const classifications = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate Student"] as const;
export const referralOptions = ["Word of Mouth", "Social Media", "School Sponsored Event", "Texas Guadaloop Website", "Other"] as const;
export const teams = [
  "Engineering - Power Electronics", "Engineering - Embedded Systems", "Engineering - RF Communications",
  "Engineering - Dynamics/Structures", "Engineering - Fluids", "Engineering - Track",
  "Engineering - Propulsion", "Engineering - Levitation", "Business - Analytics/Software Engineering",
  "Business - Internal Development", "Business - Fundraising", "Business - Procurement", "Business - Media",
  "Research - Policy", "Research - A*", "Research - Depressurization",
] as const;
export const essayQuestions = [
  { key: "leadership", title: "Leadership can take many forms.", prompt: "Tell us about a time you shaped a team's direction or outcome, whether you were in a formal leadership role or influencing things without one. What approach did you take, what leadership qualities did you rely on or want to develop, and what did you learn?" },
  { key: "setback", title: "Setbacks are often turning points for growth.", prompt: "Describe a time you faced a significant setback or disappointment, in a project, a team, or on your own. How did you respond in the moment, how did you work through it, and what did you take away from it that still shapes how you work today?" },
  { key: "motivation", title: "Texas Guadaloop is both a technical and personal commitment.", prompt: "What draws you to Texas Guadaloop specifically, and how does it connect to your own interests and goals as an engineer? What do you hope to get out of your involvement, and what do you hope to contribute?" },
] as const;
export function wordCount(value: string) { return value.trim().split(/\s+/u).filter(Boolean).length; }
const short = z.string().trim().max(300, "Use 300 characters or fewer.");
const essay = z.string().trim().max(15000, "This answer is too long.");
export const draftSchema = z.object({
  name: short, email: short, eid: short, classification: short, major: short,
  referral: short, referralOther: short, team1: short, team2: short, infoSession: short,
  resumeUrl: z.string().trim().max(2048, "Use a shorter Google Drive link."),
  portfolioUrl: z.string().trim().max(2048, "Use a shorter website link."),
  leadership: essay, setback: essay, motivation: essay, song: short, movie: short,
});
export type ApplicationFields = z.infer<typeof draftSchema>;
const required = short.min(1, "This field is required.");
const googleDriveUrl = z.string().url("Enter a valid Google Drive link.").refine(value => {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "docs.google.com" || host === "drive.google.com" || host.endsWith(".drive.google.com");
  }
  catch { return false; }
}, "Use a Google Drive or Google Docs link.");
const websiteUrl = z.string().url("Enter a valid website link.").refine(value => {
  try { const protocol = new URL(value).protocol; return protocol === "http:" || protocol === "https:"; }
  catch { return false; }
}, "Use a website link that starts with http:// or https://.");
const finalEssay = essay.min(1, "This answer is required.").refine(value => wordCount(value) <= 250, "Use 250 words or fewer.");
export const applicationSchema = draftSchema.extend({
  name: required, email: z.email("Enter a valid email address."),
  eid: required.regex(/^[a-zA-Z0-9]{2,32}$/, "Enter a valid UT EID (letters and numbers only)."),
  classification: z.enum(classifications), major: required, referral: z.enum(referralOptions),
  team1: z.enum(teams), team2: z.enum(teams), infoSession: z.enum(["Yes", "No"]),
  resumeUrl: googleDriveUrl, portfolioUrl: z.union([websiteUrl, z.literal("")]),
  leadership: finalEssay, setback: finalEssay, motivation: finalEssay, song: required, movie: required,
}).superRefine((value, ctx) => {
  if (value.team1 === value.team2) ctx.addIssue({ code: "custom", path: ["team2"], message: "Choose a different second preference." });
  if (value.referral === "Other" && !value.referralOther) ctx.addIssue({ code: "custom", path: ["referralOther"], message: "Tell us how you heard about Guadaloop." });
});
export function blankApplication(email: string): ApplicationFields {
  return { name: "", email, eid: "", classification: "", major: "", referral: "", referralOther: "", team1: "", team2: "", infoSession: "", resumeUrl: "", portfolioUrl: "", leadership: "", setback: "", motivation: "", song: "", movie: "" };
}
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export function validatePdf(name: string, bytes: Uint8Array): string | null {
  if (!name.toLowerCase().endsWith(".pdf")) return "Please upload a PDF.";
  if (bytes.length > MAX_FILE_SIZE) return "Each PDF must be 5 MB or smaller.";
  if (bytes.length < 5 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return "This file is not a valid PDF.";
  return null;
}
