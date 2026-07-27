import Link from "next/link";
import type { ReactNode } from "react";

import {
  CAMPUS_OFFICIAL_AUTHOR_ID,
  isAnonymousCampusAuthor,
  LOCAL_ACCOUNT_OWNER_ID,
  type CampusAuthorReference,
} from "@/data/campusPosts";

type CampusAuthorProfileLinkProps = CampusAuthorReference & {
  children: ReactNode;
  className?: string;
  linkClassName?: string;
  ariaLabel?: string;
};

export function normalizeCampusProfileUsername(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/^@/, "")
    .toLocaleLowerCase("tr-TR");
}

export function getCampusAuthorProfileHref(
  author: CampusAuthorReference,
) {
  if (isAnonymousCampusAuthor(author)) {
    return null;
  }

  if (
    author.authorId === LOCAL_ACCOUNT_OWNER_ID ||
    normalizeCampusProfileUsername(author.author) === "sen"
  ) {
    return "/profil";
  }

  if (
    author.authorId === CAMPUS_OFFICIAL_AUTHOR_ID ||
    normalizeCampusProfileUsername(author.author) === "kampüs" ||
    normalizeCampusProfileUsername(author.author) === "kampus"
  ) {
    return "/profil/kampus";
  }

  const username = normalizeCampusProfileUsername(author.author);

  if (!/^[a-z0-9]+(?:[._][a-z0-9]+)*$/.test(username)) {
    return null;
  }

  return `/profil/${encodeURIComponent(username)}`;
}

export default function CampusAuthorProfileLink({
  author,
  authorId,
  isAnonymous,
  children,
  className = "",
  linkClassName = "",
  ariaLabel,
}: CampusAuthorProfileLinkProps) {
  const href = getCampusAuthorProfileHref({
    author,
    authorId,
    isAnonymous,
  });

  if (!href) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={`${className} ${linkClassName}`}
    >
      {children}
    </Link>
  );
}
