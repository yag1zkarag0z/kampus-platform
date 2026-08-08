"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { trackHomepageCta } from "@/analytics/homepageClient";
import type {
  HomepageCtaSource,
  HomepageCtaTarget,
} from "@/analytics/homepageEvents";

type HomepageTrackedLinkProps = {
  href: string;
  source: HomepageCtaSource;
  target: HomepageCtaTarget;
  className?: string;
  children: ReactNode;
};

export default function HomepageTrackedLink({
  href,
  source,
  target,
  className,
  children,
}: HomepageTrackedLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackHomepageCta(source, target)}
    >
      {children}
    </Link>
  );
}
