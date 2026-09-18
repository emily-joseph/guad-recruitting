"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="container py-20"><h1 className="section-title">We couldn’t load this page.</h1><p className="my-6 text-gray-300">Please try again. If the problem continues, contact guadaloop.recruiting@gmail.com.</p><button className="button" onClick={reset}>Try again</button><Link href="/" className="ml-5 text-accent">Return home</Link></main>;
}
