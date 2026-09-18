import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { AuthForm } from "@/components/portal/auth-form";
import { getApplicant } from "@/lib/server/session";
import { backendReady, testMode } from "@/lib/server/config";
import { CYCLE_TITLE } from "@/lib/recruitment-window";

export const dynamic = "force-dynamic";
export const metadata = { title: "Applicant sign-in | Texas Guadaloop" };
export default async function Login({ searchParams }: { searchParams: Promise<{ recovery?: string }> }) {
  if (await getApplicant()) redirect("/apply");
  return <PortalShell test={testMode()}><div className="mb-10 text-center"><p className="eyebrow">{CYCLE_TITLE} recruitment</p><h1 className="section-title">Your next chapter starts here.</h1><p className="mt-4 text-gray-400">Sign in to save your progress and manage your application.</p></div>{(await searchParams).recovery === "expired" && <p role="alert" className="mb-6 text-center text-sm text-red-300">This reset link expired or was opened in another browser. Request a new link using “Forgot your password?”.</p>}<AuthForm test={testMode()} ready={backendReady()} /></PortalShell>;
}
