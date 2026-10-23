import { z } from "zod";
import { applicantStatuses } from "@/lib/applicant-status";
import { getApplicant } from "@/lib/server/session";
import { createTeamNotification, getReviewApplications, saveReview, withWriteLock } from "@/lib/server/store";
import { checkOrigin, fail, limitedBody } from "@/lib/server/http";

const payload = z.object({ applicationUserId: z.string().uuid(), stage: z.enum(["group_interview", "one_on_one", "shared_pool", "closed"]), owningTeam: z.string().max(150).nullable(), sourceTeam: z.string().max(150).nullable().optional(), notificationKind: z.enum(["referral", "steal"]).optional(), decision: z.enum(["pending", "pass_to_one_on_one", "recommend_team_2", "refer_team", "shared_pool", "reject"]), applicantStatus: z.enum(applicantStatuses).default("in_review"), notes: z.string().max(10000) });
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await getApplicant();
    if (!user?.editor) return fail("A recruiting lead must grant you editable access before you can change decisions.", 403);
    const result = payload.safeParse(JSON.parse(new TextDecoder().decode(await limitedBody(request, 12000))));
    if (!result.success) return fail(result.error.issues[0].message);
    const { applicationUserId, owningTeam, sourceTeam, notificationKind, applicantStatus: requestedStatus, ...value } = result.data;
    const current = (await getReviewApplications()).find(application => application.user_id === applicationUserId);
    if (!current) return fail("Application not found.", 404);
    if (notificationKind === "steal" && !["shared_pool", "reject"].includes(current.review?.decision ?? "pending")) return fail("An applicant can only be claimed after the first team releases or rejects them.", 409);
    if (notificationKind && !owningTeam) return fail("Choose the receiving team.");
    if (requestedStatus === "accepted_to_team" && !owningTeam) return fail("Choose the team accepting this applicant.");
    const applicantStatus = notificationKind ? "in_review" : requestedStatus;
    const stage = applicantStatus === "accepted_group_interview" || applicantStatus === "waiting_group_results" ? "group_interview"
      : applicantStatus === "accepted_one_on_one" || applicantStatus === "waiting_one_on_one" ? "one_on_one"
        : applicantStatus === "waitlisted" ? "shared_pool"
          : applicantStatus === "rejected" || applicantStatus === "accepted_to_team" ? "closed" : value.stage;
    const decision = applicantStatus === "accepted_one_on_one" || applicantStatus === "waiting_one_on_one" ? "pass_to_one_on_one"
      : applicantStatus === "waitlisted" ? "shared_pool"
        : applicantStatus === "rejected" ? "reject"
          : applicantStatus === "accepted_to_team" ? "refer_team"
          : notificationKind === "steal" ? "refer_team" : value.decision;
    const review = await withWriteLock(async () => {
      const saved = await saveReview(user, applicationUserId, { ...value, stage, decision, applicant_status: applicantStatus, owning_team: owningTeam });
      if (notificationKind && owningTeam) await createTeamNotification(applicationUserId, owningTeam, sourceTeam ?? current.review?.owning_team ?? null, notificationKind);
      return saved;
    });
    return Response.json({ review });
  } catch (error) { return fail(error instanceof Error ? error.message : "Could not save the reviewer decision."); }
}
