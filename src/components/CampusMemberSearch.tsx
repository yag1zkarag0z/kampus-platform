"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { AuthClientError } from "@/auth/client";
import { useCampusAccount } from "@/components/CampusAccountProvider";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import { useDebouncedValue } from "@/components/useCampusPostQuery";
import { campusFollowMembers } from "@/data/campusFollows";
import {
  searchMembers,
  type FollowMemberDto,
} from "@/social/client";

const SEARCH_MIN_LENGTH = 2;

export default function CampusMemberSearch() {
  const { sessionMode, retrySession } = useCampusAccount();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FollowMemberDto[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestVersionRef = useRef(0);
  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery, 250);
  const isMember = sessionMode === "member";
  const isGuest = sessionMode === "guest";
  const isWaitingForDebounce =
    trimmedQuery.length >= SEARCH_MIN_LENGTH &&
    trimmedQuery !== debouncedQuery;
  const guestResults = useMemo<FollowMemberDto[]>(() => {
    if (!isGuest || debouncedQuery.length < SEARCH_MIN_LENGTH) {
      return [];
    }

    const normalizedQuery = debouncedQuery.toLocaleLowerCase("tr-TR");

    return campusFollowMembers
      .filter((member) =>
        `${member.displayName} ${member.username}`
          .toLocaleLowerCase("tr-TR")
          .includes(normalizedQuery),
      )
      .slice(0, 8)
      .map((member) => ({
        id: member.authorId,
        username: member.username,
        displayName: member.displayName,
        avatarUrl: member.avatarDataUrl ?? null,
      }));
  }, [debouncedQuery, isGuest]);
  const visibleResults = isGuest ? guestResults : results;

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const requestVersion = ++requestVersionRef.current;

    if (!isMember || debouncedQuery.length < SEARCH_MIN_LENGTH) {
      queueMicrotask(() => {
        if (!isCancelled) {
          setResults([]);
          setIsLoading(false);
          setHasFailed(false);
        }
      });

      return () => {
        isCancelled = true;
      };
    }

    queueMicrotask(() => {
      if (!isCancelled) {
        setIsLoading(true);
        setHasFailed(false);
      }
    });

    searchMembers(debouncedQuery)
      .then((members) => {
        if (
          !isCancelled &&
          requestVersion === requestVersionRef.current
        ) {
          setResults(members);
        }
      })
      .catch((error: unknown) => {
        if (
          isCancelled ||
          requestVersion !== requestVersionRef.current
        ) {
          return;
        }

        setResults([]);
        setHasFailed(true);

        if (error instanceof AuthClientError && error.status === 401) {
          void retrySession();
        }
      })
      .finally(() => {
        if (
          !isCancelled &&
          requestVersion === requestVersionRef.current
        ) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [debouncedQuery, isMember, retrySession]);

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setHasFailed(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative z-40">
      <div className="group flex min-h-12 items-center rounded-full border border-white/12 bg-white/[0.045] transition-[border-color,background-color,box-shadow] focus-within:border-brand/55 focus-within:bg-white/[0.065] focus-within:ring-3 focus-within:ring-brand/15 hover:border-white/20">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="ml-4 size-[18px] shrink-0 text-white/48 transition-colors group-focus-within:text-brand"
        >
          <circle
            cx="10.7"
            cy="10.7"
            r="6.2"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="m15.4 15.4 4 4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <label htmlFor="member-search" className="sr-only">
          Kişilerde ara
        </label>
        <input
          ref={inputRef}
          id="member-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsOpen(false);
              inputRef.current?.blur();
            }
          }}
          placeholder="Kişilerde ara"
          autoComplete="off"
          aria-controls="member-search-panel"
          className="min-w-0 flex-1 bg-transparent px-2.5 py-3 text-sm font-medium text-white outline-none placeholder:text-white/42 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            aria-label="Kişi aramasını temizle"
            onClick={clearSearch}
            className="mr-1.5 grid size-9 shrink-0 place-items-center rounded-full text-white/48 outline-none transition-colors hover:bg-white/8 hover:text-white focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="size-4"
            >
              <path
                d="m6 6 8 8m0-8-8 8"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      {isOpen && (
        <div
          id="member-search-panel"
          role="region"
          aria-label="Kişi arama sonuçları"
          className="absolute inset-x-0 top-[calc(100%+8px)] overflow-hidden rounded-2xl border border-white/12 bg-surface-raised shadow-[0_16px_36px_rgba(0,0,0,0.32)]"
        >
          {sessionMode === "signed-out" ? (
            <div className="px-5 py-5">
              <p className="text-sm leading-6 text-white/62">
                Kişileri aramak için giriş yap.
              </p>
              <Link
                href="/giris"
                className="mt-2 inline-flex min-h-8 items-center text-sm font-black text-brand outline-none hover:text-brand-hover focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                Giriş yap →
              </Link>
            </div>
          ) : trimmedQuery.length < SEARCH_MIN_LENGTH ? (
            <p className="min-h-24 px-5 py-5 text-sm leading-6 text-white/62">
              İsim veya kullanıcı adıyla ara.
            </p>
          ) : isWaitingForDebounce || (isMember && isLoading) ? (
            <div
              role="status"
              className="flex min-h-24 items-center gap-3 px-5 py-5 text-sm text-white/58"
            >
              <span className="size-4 animate-spin rounded-full border-2 border-white/15 border-t-brand motion-reduce:animate-none" />
              Kişiler aranıyor
            </div>
          ) : hasFailed ? (
            <p className="min-h-24 px-5 py-5 text-sm leading-6 text-white/62">
              Arama şu anda tamamlanamadı. Tekrar dene.
            </p>
          ) : visibleResults.length === 0 ? (
            <p className="min-h-24 px-5 py-5 text-sm leading-6 text-white/62">
              Bu aramayla eşleşen kişi bulunamadı.
            </p>
          ) : (
            <ul className="py-2">
              {visibleResults.map((member) => (
                <li key={member.id}>
                  <Link
                    href={`/profil/${encodeURIComponent(member.username)}`}
                    onClick={() => setIsOpen(false)}
                    className="flex min-h-16 items-center gap-3 px-4 py-2.5 outline-none transition-colors hover:bg-white/6 focus-visible:bg-white/6"
                  >
                    <CampusAuthorAvatar
                      author={member.displayName}
                      authorId={member.id}
                      avatarUrl={member.avatarUrl}
                      size="md"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black tracking-[-0.02em] text-white">
                        {member.displayName}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-white/48">
                        @{member.username}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="ml-auto text-sm text-white/30"
                    >
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
