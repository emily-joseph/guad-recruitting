import Link from "next/link";
import { Brand } from "@/components/ui";
import { SignOut } from "./sign-out";
import type { Applicant } from "@/lib/server/session";

export function PortalShell({ user, test, children }: { user?: Applicant | null; test: boolean; children: React.ReactNode }) {
  return <>
    <header className="border-b border-white/10"><div className="container flex flex-wrap items-center justify-between gap-5 py-4"><Brand /><nav aria-label="Applicant navigation" className="flex flex-wrap items-center gap-5 text-sm"><Link href="/" className="nav-link">Home</Link>{user && <Link href="/application-status" className="nav-link">Application status</Link>}{user && <Link href="/apply" className="nav-link">My application</Link>}{user && <Link href="/interview-availability" className="nav-link">Interview slots</Link>}{user?.member && <Link href="/admin/applications" className="nav-link">Applications</Link>}{user?.groupInterviewer && <Link href="/admin/group-interviews" className="nav-link">Group interviews</Link>}{user?.oneOnOneInterviewer && <Link href="/admin/interviews" className="nav-link">Interviews</Link>}{user?.admin && <Link href="/admin/recruitment" className="nav-link">Recruiting settings</Link>}{user?.admin && <Link href="/admin/transfers" className="nav-link">Internal transfers</Link>}{user && <SignOut />}</nav></div></header>
    {test && <div className="border-b border-amber-500/30 bg-amber-500/10 px-5 py-3 text-center text-sm text-amber-200">Local role preview: {user?.previewRole?.replaceAll("_", " ") ?? "lead"}. Use sample information only; nothing here is a real recruitment record.</div>}
    <main id="main-content" className="container max-w-4xl py-12 sm:py-16">{children}</main>
  </>;
}
