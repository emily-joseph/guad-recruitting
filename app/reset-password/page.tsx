import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { AuthForm } from "@/components/portal/auth-form";

export const dynamic = "force-dynamic";
export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ oobCode?: string }> }) {
  const { oobCode } = await searchParams;
  if (!oobCode) redirect("/login?recovery=expired");
  return <PortalShell test={false}><AuthForm test={false} ready initialMode="reset" oobCode={oobCode} /></PortalShell>;
}
