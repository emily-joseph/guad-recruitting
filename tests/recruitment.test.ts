import test from "node:test";
import assert from "node:assert/strict";
import { applicationSchema, blankApplication, draftSchema, teams, wordCount, validatePdf, MAX_FILE_SIZE } from "../lib/application-schema";
import { closedWindow, isAccepting, fromAustinInput, toAustinInput, windowSchema } from "../lib/recruitment-window";

test("applications default closed; scheduled opening inclusive and closing exclusive", () => {
  assert.equal(isAccepting(closedWindow), false);
  const window = { mode: "scheduled" as const, opensAt: "2027-01-20T18:00:00Z", closesAt: "2027-02-01T05:59:00Z" };
  const start = Date.parse(window.opensAt), end = Date.parse(window.closesAt);
  assert.equal(isAccepting(window, start - 1), false);
  assert.equal(isAccepting(window, start), true);
  assert.equal(isAccepting(window, end - 1), true);
  assert.equal(isAccepting(window, end), false);
  assert.equal(isAccepting({ ...window, opensAt: null }), false);
  assert.equal(windowSchema.safeParse({ ...window, closesAt: window.opensAt }).success, false);
});
test("Austin schedule uses CST/CDT independent of browser timezone and rejects DST ambiguity", () => {
  assert.equal(fromAustinInput("2027-01-20T18:00"), "2027-01-21T00:00:00.000Z");
  assert.equal(fromAustinInput("2027-08-20T18:00"), "2027-08-20T23:00:00.000Z");
  assert.equal(toAustinInput("2027-01-21T00:00:00Z"), "2027-01-20T18:00");
  assert.throws(() => fromAustinInput("2027-03-14T02:30"));
  assert.throws(() => fromAustinInput("2027-11-07T01:30"));
});
const valid = { ...blankApplication("student@example.com"), name: "Test Student", eid: "ts1234", classification: "Sophomore", major: "Mechanical Engineering", referral: "Word of Mouth", team1: teams[0], team2: teams[1], infoSession: "Yes", leadership: "I helped our team find a direction.", setback: "I learned to ask for help.", motivation: "I want to build transportation systems.", song: "Sample song", movie: "Sample movie" };
test("drafts allow incomplete answers, but final applications require every required answer", () => {
  assert.equal(draftSchema.safeParse(blankApplication("student@example.com")).success, true);
  assert.equal(applicationSchema.safeParse(valid).success, true);
  for (const field of ["name", "email", "eid", "classification", "major", "referral", "team1", "team2", "infoSession", "leadership", "setback", "motivation", "song", "movie"]) {
    assert.equal(applicationSchema.safeParse({ ...valid, [field]: "" }).success, false, field);
  }
});
test("team choices and conditional referral validation cannot be bypassed", () => {
  assert.equal(teams.length, 16);
  assert.equal(applicationSchema.safeParse({ ...valid, team2: valid.team1 }).success, false);
  assert.equal(applicationSchema.safeParse({ ...valid, team2: "Fake team" }).success, false);
  assert.equal(applicationSchema.safeParse({ ...valid, referral: "Other" }).success, false);
  assert.equal(applicationSchema.safeParse({ ...valid, referral: "Other", referralOther: "Student fair" }).success, true);
  assert.equal(applicationSchema.safeParse({ ...valid, infoSession: "No" }).success, true);
});
test("all three essays enforce 250 words with whitespace-aware counting", () => {
  assert.equal(wordCount("  one\n two\tthree  "), 3);
  assert.equal(wordCount("  "), 0);
  for (const key of ["leadership", "setback", "motivation"]) {
    assert.equal(applicationSchema.safeParse({ ...valid, [key]: "word ".repeat(250) }).success, true);
    assert.equal(applicationSchema.safeParse({ ...valid, [key]: "word ".repeat(251) }).success, false);
  }
});
test("uploads enforce PDF signature, extension, and maximum size", () => {
  const pdf = new TextEncoder().encode("%PDF-1.7 sample");
  assert.equal(validatePdf("resume.PDF", pdf), null);
  assert.ok(validatePdf("resume.exe", pdf));
  assert.ok(validatePdf("resume.pdf", new TextEncoder().encode("not a pdf")));
  assert.ok(validatePdf("resume.pdf", new Uint8Array(MAX_FILE_SIZE + 1)));
});
