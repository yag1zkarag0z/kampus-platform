"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

function HomepageBentoPlaceholder() {
  return (
    <section
      aria-label="KAMPÜS özellikleri yükleniyor"
      aria-busy="true"
      className="bg-canvas text-white"
      data-testid="homepage-bento-placeholder"
    >
      <div className="mx-auto w-full max-w-[1180px] px-5 pb-10 sm:px-8 sm:pb-12 lg:px-10 lg:pb-14">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 sm:gap-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              aria-hidden="true"
              className="h-[20rem] rounded-[1.25rem] border border-white/8 bg-surface motion-safe:animate-pulse"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

const LazyHomepageBento = dynamic(() => import("./HomepageBento"), {
  ssr: false,
  loading: HomepageBentoPlaceholder,
});

export default function HomepageBentoLazy() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const Observer = globalThis.IntersectionObserver;

    if (typeof Observer !== "function") {
      const fallbackTimer = globalThis.setTimeout(
        () => setShouldLoad(true),
        0,
      );
      return () => globalThis.clearTimeout(fallbackTimer);
    }

    const observer = new Observer(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    const safetyTimer = window.setTimeout(() => setShouldLoad(true), 2_000);

    observer.observe(container);

    return () => {
      observer.disconnect();
      window.clearTimeout(safetyTimer);
    };
  }, []);

  return (
    <div ref={containerRef}>
      {shouldLoad ? <LazyHomepageBento /> : <HomepageBentoPlaceholder />}
    </div>
  );
}
