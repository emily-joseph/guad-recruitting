import Link from "next/link";
import { Brand, ButtonLink, Eyebrow } from "./ui";
import Image from "next/image";
import podGraphic from "@/public/guadaloop-pod.png";

export function Navbar() {
  return <header className="site-header"><a href="#main-content" className="skip-link">Skip to content</a><div className="container flex flex-wrap items-center justify-between gap-6 py-6"><Brand /><nav aria-label="Main navigation" className="flex w-full items-center justify-between gap-5 text-sm sm:w-auto sm:gap-9"><Link className="nav-link" href="/#teams">Teams</Link><Link className="nav-link" href="/#faq">FAQ</Link><Link className="nav-link" href="/login">Login</Link><ButtonLink href="/apply" secondary>Apply</ButtonLink></nav></div></header>;
}
export function Hero() {
  return (
    <section className="container pt-16 text-center sm:pt-24">
      <p className="mb-5 text-sm text-[#B66A3D]">Join Texas Guadaloop</p>
      <h1 className="text-5xl font-bold leading-tight tracking-tight sm:text-7xl">Build what’s next.</h1>
      <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-gray-300 sm:text-lg">
        Help shape the future of transportation. Join a team of students at UT Austin bringing hyperloop technology to life.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <ButtonLink href="/apply">Join Us</ButtonLink>
        <ButtonLink href="/#teams" secondary>Explore Our Teams</ButtonLink>
      </div>
      <div className="mx-auto mt-12 max-w-5xl overflow-hidden rounded-lg">
        <Image src={podGraphic} alt="Guadaloop hyperloop pod diagram showing the shell, internal systems, and track" sizes="(max-width: 1100px) 100vw, 1024px" preload className="h-auto w-full opacity-75" />
      </div>
    </section>
  );
}
export function WhyGuadaloop() {
  return <section className="container section-space grid gap-10 md:grid-cols-2"><div><Eyebrow>Why Guadaloop</Eyebrow><h2 className="section-title">Big ideas.<br />Real-world impact.</h2></div><div><p className="max-w-xl text-lg leading-8 text-gray-300">Some things you can’t learn in a lecture hall. Work alongside curious minds to design, build, and champion the next generation of transportation.</p><div className="mt-8 grid grid-cols-3 gap-5 border-t border-white/15 pt-6">{[['Build', 'Turn theory into hardware.'], ['Collaborate', 'Go further together.'], ['Grow', 'Take on something new.']].map(([title, description]) => <div key={title}><h3 className="mb-2 text-sm font-semibold">{title}</h3><p className="text-xs leading-5 text-gray-400">{description}</p></div>)}</div></div></section>;
}
function TeamCard({ name, description, tags, href }: { name: string; description: string; tags: string[]; href: string }) {
  return <a href={href} className="team-card group relative flex min-h-80 flex-col overflow-hidden rounded-lg border border-white/15 bg-[#111] p-7 transition-colors hover:border-accent sm:p-10"><div className="mb-12 flex items-start justify-between"><span className="text-sm text-gray-400">Texas Guadaloop</span><span aria-hidden="true" className="text-3xl text-accent transition-transform group-hover:translate-x-1">↗</span></div><h3 className="text-3xl font-bold tracking-tight text-accent">{name}</h3><p className="relative mt-4 max-w-sm text-sm leading-6 text-gray-300">{description}</p><div className="mt-8 flex flex-wrap gap-2">{tags.map(tag => <span key={tag} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400">{tag}</span>)}</div></a>;
}
export function Teams() {
  return <section id="teams" className="border-y border-white/10 bg-black"><div className="container section-space"><Eyebrow>Find your team</Eyebrow><div className="mb-12 flex flex-col items-center gap-5 text-center"><h2 className="section-title">Explore Our Teams</h2><p className="max-w-xl text-base leading-7 text-gray-400">Different disciplines. One shared mission.<br />There’s more than one way to move us forward.</p></div><div className="grid gap-5 md:grid-cols-2"><TeamCard name="Engineering" description="From the first CAD model to the next test run. Design and build the systems that bring our pod to life." tags={['Design', 'Build', 'Test']} href="https://www.txguadaloop.org/Engineering" /><TeamCard name="Business" description="Build the momentum behind the machine. Shape our story, create partnerships, and make ambitious work possible." tags={['Strategy', 'Partnerships', 'Outreach']} href="https://www.txguadaloop.org/Business" /></div><div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-6 text-sm"><p className="text-gray-400">Driven by the questions no one has answered yet?</p><a className="text-accent hover:text-white" href="https://www.txguadaloop.org/Research">Explore Research ↗</a></div></div></section>;
}
export function FAQ() {
  return <section id="faq" className="container section-space grid gap-10 md:grid-cols-[1fr_1.25fr]"><div><Eyebrow>Frequently Asked Questions</Eyebrow><h2 className="section-title">Good questions.<br />Great beginnings.</h2></div><div>{[
    ['What does Guadaloop work on?', 'Texas Guadaloop is a student-led team at UT Austin exploring hyperloop technology. Engineering, business, and research come together to move the project forward.'],
    ['Where can I learn about each team?', 'Explore the Engineering and Business cards above, or follow the Research link. Each leads to the team’s page on the official Guadaloop website.'],
    ['How can I apply?', 'Visit the spring application portal to check the application window. When applications open, sign in, complete the form, upload your resume, and submit before the deadline.'],
  ].map(([question, answer]) => <details key={question} className="faq-item border-b border-white/15 py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-sm font-medium">{question}<span aria-hidden="true" className="faq-plus text-xl font-light text-accent">+</span></summary><p className="mt-4 max-w-lg text-sm leading-7 text-gray-300">{answer}</p></details>)}</div></section>;
}
export function Apply() {
  return <section id="apply" className="apply-section relative overflow-hidden border-t border-white/10"><div className="container relative py-20 text-center sm:py-24"><p className="mb-6 text-sm text-accent">Your next challenge starts here</p><h2 className="text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">The future needs builders.<br /><span className="text-gray-400">Let’s get to work.</span></h2><p className="mx-auto mb-8 mt-6 max-w-md text-sm leading-6 text-gray-300">Bring your curiosity. Find your team. Build something that moves us all forward.</p><ButtonLink href="/apply">Spring application portal</ButtonLink><p className="mt-5 text-xs text-gray-400">View recruitment dates, sign in, and manage your application.</p><a href="https://www.txguadaloop.org/" className="mt-5 inline-block text-sm text-accent hover:text-white">Discover Guadaloop ↗</a></div></section>;
}
export function Footer() {
  return <footer className="border-t border-white/10"><div className="container flex flex-col justify-between gap-8 py-10 md:flex-row md:items-center"><Brand /><p className="text-xs text-gray-400">Built in Austin. Moving the world forward.</p><a className="nav-link text-xs" href="https://www.txguadaloop.org/">Visit our main website ↗</a></div><div className="container border-t border-white/10 py-5 text-xs text-gray-400">© {new Date().getFullYear()} TEXAS GUADALOOP</div></footer>;
}

