import Link from "next/link";
import { Brand } from "@/components/ui";
import { SignOut } from "./sign-out";
import type { Applicant } from "@/lib/server/session";

export function PortalShell({ user, test, children }: { user?: Applicant | null; test: boolean; children: React.ReactNode }) {
  return <>
    <header className="border-b border-white/10"><div className="container flex flex-wrap items-center justify-between gap-5 py-4"><Brand /><nav aria-label="Applicant navigation" className="flex flex-wrap items-center gap-5 text-sm"><Link href="/" className="nav-link">Home</Link>{user && <Link href="/apply" className="nav-link">My application</Link>}{user?.admin && <Link href="/admin/recruitment" className="nav-link">Recruiting settings</Link>}{user && <SignOut />}</nav></div></header>
    {test && <div className="border-b border-amber-500/30 bg-amber-500/10 px-5 py-3 text-center text-sm text-amber-200">Local test mode — use sample information only. Nothing here is a real recruitment submission.</div>}
    <main id="main-content" className="container max-w-4xl py-12 sm:py-16">{children}</main>
  </>;
}
