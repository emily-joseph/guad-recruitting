import { notFound, redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { TransferAdmin } from "@/components/portal/transfer-admin";
import { getApplicant } from "@/lib/server/session";
import { getInternalTransfers, getInternalTransferWindow } from "@/lib/server/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Internal transfers | Texas Guadaloop" };

export default async function InternalTransfersPage() {
  const user = await getApplicant();
  if (!user) redirect("/login");
  if (!user.admin) notFound();
  const [window, transfers] = await Promise.all([getInternalTransferWindow(), getInternalTransfers()]);
  return <PortalShell user={user} test={user.test}><p className="eyebrow">Recruiting administration</p><h1 className="section-title">Internal transfers</h1><p className="mb-8 mt-4 text-gray-400">Manage the separate transfer deadline and review submitted requests.</p><TransferAdmin initialWindow={window} initialTransfers={transfers} /></PortalShell>;
}
