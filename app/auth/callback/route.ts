import { NextResponse } from "next/server";
import { authClient } from "@/lib/server/supabase";
import { backendReady, testMode } from "@/lib/server/config";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  const origin = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (code && backendReady() && !testMode()) {
    const { error } = await (await authClient()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/reset-password`);
  }
  return NextResponse.redirect(`${origin}/login?recovery=expired`);
}
