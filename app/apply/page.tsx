import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { ApplicationForm } from "@/components/portal/application-form";
import { getApplicant } from "@/lib/server/session";
import { testMode } from "@/lib/server/config";
import { getWindow, getApplication } from "@/lib/server/store";
import { CYCLE_TITLE, isAccepting, windowMessage } from "@/lib/recruitment-window";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spring application | Texas Guadaloop" };
export default async function ApplyPage() {
  const user = await getApplicant();
  const window = await getWindow();
  const accepting = isAccepting(window);
  if (!user && accepting) redirect("/login");
  const record = user ? await getApplication(user) : null;
  return <PortalShell user={user} test={testMode()}>
    <div className="mb-10"><p className="eyebrow">{CYCLE_TITLE} recruitment</p><h1 className="section-title">Texas Guadaloop Application</h1><p className="mt-6 text-base leading-8 text-gray-300">At Texas Guadaloop, we’re looking for passionate, creative students who are ready to make an impact. Our team’s success comes from the talent and dedication of every member, and we can’t wait to bring in more great people.</p><p className="mt-4 text-base leading-8 text-gray-300">Whether you’re here to sharpen your engineering skills, dive into business, or step up as a leader, we’ve got the tools and opportunities to help you grow. This isn’t just another school project—it’s a chance to tackle real-world challenges, work with cutting-edge technology, and make something amazing happen.</p><a href="https://www.txguadaloop.org/" className="mt-4 inline-block text-sm text-accent">Learn more on our website ↗</a></div>
    <div className="mb-8 rounded-lg border border-accent/40 bg-accent/10 p-5"><p className="text-sm leading-7">{windowMessage(window)}</p>{user?.test && <p className="mt-2 text-sm text-gray-300">Use <Link className="text-accent underline" href="/admin/recruitment">recruiting settings</Link> to open the local test window or try a schedule.</p>}</div>
    {user ? <ApplicationForm email={user.email} initial={record} accepting={accepting} test={user.test} /> : <div className="portal-card"><h2 className="text-2xl font-bold">Get ready for what’s next.</h2><p className="mt-4 text-sm leading-7 text-gray-300">Applications are not being accepted right now. You can sign in to view an existing application.</p><Link href="/login" className="button mt-6">{testMode() ? "Try the local application" : "Applicant sign-in"}</Link></div>}
  </PortalShell>;
}
