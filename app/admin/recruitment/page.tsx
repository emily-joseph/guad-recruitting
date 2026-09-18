import { redirect, notFound } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { RecruitingSettings } from "@/components/portal/recruiting-settings";
import { getApplicant } from "@/lib/server/session";
import { getWindow } from "@/lib/server/store";
import { CYCLE_TITLE } from "@/lib/recruitment-window";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recruiting settings | Texas Guadaloop" };
export default async function RecruitmentSettingsPage() {
  const user = await getApplicant();
  if (!user) redirect("/login");
  if (!user.admin) notFound();
  return <PortalShell user={user} test={user.test}><p className="eyebrow">Recruiting administration</p><h1 className="section-title">{CYCLE_TITLE} application window</h1><p className="mb-10 mt-5 text-gray-400">Control when students can save and submit applications. Changes take effect immediately.</p><RecruitingSettings initial={await getWindow()} /></PortalShell>;
}
