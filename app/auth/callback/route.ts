import { NextResponse } from "next/server";
import { firebaseIdentityRequest } from "@/lib/server/firebase";
import { FirebaseIdentityError } from "@/lib/auth-errors";
import { authActionOrigin } from "@/lib/request-origin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  const oobCode = url.searchParams.get("oobCode");
  const origin = authActionOrigin(request.url, process.env.APP_ORIGIN, process.env.NODE_ENV === "development");
  if (!oobCode) return NextResponse.redirect(`${origin}/login?recovery=expired`);
  try {
    if (mode === "resetPassword") return NextResponse.redirect(`${origin}/reset-password?oobCode=${encodeURIComponent(oobCode)}`);
    if (mode === "verifyEmail") {
      await firebaseIdentityRequest("accounts:update", { oobCode });
      return NextResponse.redirect(`${origin}/login?verified=1`);
    }
  } catch (error) {
    if (!(error instanceof FirebaseIdentityError) || !["EXPIRED_OOB_CODE", "INVALID_OOB_CODE"].includes(error.code)) {
      return NextResponse.redirect(`${origin}/login?verification=unavailable`);
    }
  }
  return NextResponse.redirect(`${origin}/login?recovery=expired`);
}
