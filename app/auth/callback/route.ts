import { NextResponse } from "next/server";
import { firebaseIdentityRequest } from "@/lib/server/firebase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  const oobCode = url.searchParams.get("oobCode");
  const origin = process.env.APP_ORIGIN || url.origin;
  if (!oobCode) return NextResponse.redirect(`${origin}/login?recovery=expired`);
  try {
    if (mode === "resetPassword") return NextResponse.redirect(`${origin}/reset-password?oobCode=${encodeURIComponent(oobCode)}`);
    if (mode === "verifyEmail") {
      await firebaseIdentityRequest("accounts:update", { oobCode });
      return NextResponse.redirect(`${origin}/login?verified=1`);
    }
  } catch { /* Expired or invalid action code. */ }
  return NextResponse.redirect(`${origin}/login?recovery=expired`);
}
