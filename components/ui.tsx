import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import guadaloopLogo from "@/public/guadaloop-logo.png";

export function ButtonLink({ href, children, secondary = false }: { href: string; children: ReactNode; secondary?: boolean }) {
  return <Link href={href} className={`button ${secondary ? "button-secondary" : ""}`}>{children}<span aria-hidden="true">↗</span></Link>;
}
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow"><span />{children}</p>;
}
export function Brand() {
  return (
    <Link href="/" aria-label="Texas Guadaloop home" className="flex items-center gap-3">
      <Image src={guadaloopLogo} alt="" width={56} height={56} className="h-14 w-14 shrink-0 object-contain" />
</Link>
  );
}
