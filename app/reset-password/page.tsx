import { redirect } from "next/navigation";
import { getApplicant } from "@/lib/server/session";
import { PortalShell } from "@/components/portal/portal-shell";
import { AuthForm } from "@/components/portal/auth-form";

export const dynamic = "force-dynamic";
export default async function ResetPassword() {
  const user = await getApplicant();
  if (!user || user.test) redirect("/login");
  return <PortalShell user={user} test={false}><AuthForm test={false} ready initialMode="reset" /></PortalShell>;
}
