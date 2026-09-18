// Run against `npm run dev` with APPLICATION_TEST_MODE=true. Uses only sample data.
import assert from "node:assert/strict";
const origin = process.env.TEST_ORIGIN || "http://localhost:3000";
let cookie = "";
async function request(path, body, options = {}) {
  return fetch(`${origin}${path}`, { method: "POST", headers: { origin, cookie, ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...options.headers }, body: body instanceof FormData ? body : JSON.stringify(body), redirect: "manual" });
}
const login = await request("/api/auth/test", {});
assert.equal(login.status, 200, "Local testing must be enabled; this script never signs in to a production account.");
cookie = login.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
assert.ok(cookie.includes("guad-test="));
const originalWindow = await (await fetch(`${origin}/api/recruitment`)).json();
const fields = { name: "Test Student", email: "ignored@example.com", eid: "ts1234", classification: "Sophomore", major: "Mechanical Engineering", referral: "Word of Mouth", referralOther: "", team1: "Engineering - Power Electronics", team2: "Engineering - Embedded Systems", infoSession: "No", leadership: "I helped a team choose a design.", setback: "I learned to test earlier.", motivation: "I want to build transportation systems.", song: "Sample song", movie: "Sample movie" };
function application(intent, answers = fields, file = false) {
  const form = new FormData(); form.set("intent", intent); form.set("answers", JSON.stringify(answers));
  if (file) form.set("resume", new Blob(["%PDF-1.7\nTest fixture only\n%%EOF"], { type: "application/pdf" }), "sample-resume.pdf");
  return form;
}
try {
  assert.equal((await request("/api/recruitment", { mode: "closed", opensAt: null, closesAt: null }, { headers: { cookie: "" } })).status, 403);
  assert.equal((await request("/api/recruitment", { mode: "open", opensAt: null, closesAt: null }, { headers: { origin: "https://untrusted.example" } })).status, 400);
  assert.equal((await request("/api/recruitment", { mode: "closed", opensAt: null, closesAt: null })).status, 200);
  assert.equal((await request("/api/application", application("draft"))).status, 403);
  assert.equal((await request("/api/recruitment", { mode: "open", opensAt: null, closesAt: null })).status, 200);
  assert.equal((await request("/api/application", application("draft"), { headers: { cookie: "" } })).status, 401);
  assert.equal((await request("/api/application", application("submit"))).status, 400, "resume is required");
  assert.equal((await request("/api/application", application("submit", { ...fields, leadership: "word ".repeat(251) }, true))).status, 400);
  const draftResponse = await request("/api/application", application("draft", fields, true));
  assert.equal(draftResponse.status, 200);
  const draft = (await draftResponse.json()).record;
  assert.equal(draft.answers.email, "tester@example.com", "identity comes from the session");
  assert.equal(draft.submitted_at, null);
  const download = await fetch(`${origin}/api/files/resume`, { headers: { cookie } });
  assert.equal(download.status, 200);
  assert.ok(download.headers.get("content-disposition").startsWith("attachment;"));
  assert.equal((await fetch(`${origin}/api/files/resume`)).status, 401);
  const otherSession = await request("/api/auth/test", {});
  const otherCookie = otherSession.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  assert.equal((await fetch(`${origin}/api/files/resume`, { headers: { cookie: otherCookie } })).status, 404, "other applicant cannot access upload");
  const submit = await request("/api/application", application("submit"));
  assert.equal(submit.status, 200);
  assert.ok((await submit.json()).record.submitted_at);
  assert.equal((await request("/api/application", application("submit"))).status, 409);
  assert.equal((await request("/api/application", application("draft"))).status, 409);
  assert.equal((await request("/api/recruitment", { mode: "scheduled", opensAt: "2027-01-01T00:00:00Z", closesAt: "2026-01-01T00:00:00Z" })).status, 400);
  assert.equal((await request("/api/recruitment", { mode: "scheduled", opensAt: new Date(Date.now() - 120000).toISOString(), closesAt: new Date(Date.now() - 60000).toISOString() })).status, 200);
  assert.equal((await request("/api/application", application("draft"), { headers: { cookie: otherCookie } })).status, 403);
  console.log("PASS: authenticated local flow, closed window, deadline, drafts, required resume, word limits, private downloads, isolated applicants, immutable submission, and CSRF checks.");
} finally {
  assert.equal((await request("/api/recruitment", originalWindow)).status, 200, "restore original recruitment settings");
  await request("/api/auth/signout", {});
}
