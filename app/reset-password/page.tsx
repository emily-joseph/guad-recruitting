import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { AuthForm } from "@/components/portal/auth-form";

import { backendReady } from "@/lib/server/config";

export const dynamic = "force-dynamic";
export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ oobCode?: string }> }) {
  const { oobCode } = await searchParams;
  if (!oobCode) redirect("/login?recovery=expired");
  return <PortalShell test={false}><AuthForm test={false} ready={backendReady()} initialMode="reset" oobCode={oobCode} /></PortalShell>;
}
