const skeletonRows = [
  { bodyWidth: "w-11/12", media: true },
  { bodyWidth: "w-4/5", media: false },
  { bodyWidth: "w-10/12", media: true },
  { bodyWidth: "w-3/4", media: false },
];

function SkeletonBlock({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-full bg-[#1c2821]/9 motion-reduce:animate-none dark:bg-white/9 ${className}`}
    />
  );
}

export default function PlatformFeedSkeleton() {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="min-h-[calc(100svh-4rem)] bg-[#f8f4ed]/62 dark:bg-[#141619] md:min-h-svh"
    >
      <span className="sr-only">Sayfa yükleniyor</span>

      <div
        aria-hidden="true"
        className="sticky top-16 z-20 flex min-h-16 items-center justify-between border-b border-[#1c2821]/10 bg-[#eee9e1]/88 px-4 backdrop-blur-xl dark:border-white/9 dark:bg-[#111315]/88 sm:px-5 md:top-0"
      >
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="size-9" />
      </div>

      <div aria-hidden="true" className="border-b border-[#1c2821]/10 px-4 py-4 dark:border-white/9 sm:px-5">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="size-10 shrink-0" />
          <SkeletonBlock className="h-4 w-44 max-w-[58vw]" />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-2">
            <SkeletonBlock className="size-8" />
            <SkeletonBlock className="size-8" />
            <SkeletonBlock className="size-8" />
          </div>
          <SkeletonBlock className="h-9 w-20" />
        </div>
      </div>

      <div aria-hidden="true">
        {skeletonRows.map((row, index) => (
          <article
            key={index}
            className="border-b border-[#1c2821]/10 px-4 py-5 dark:border-white/9 sm:px-5"
          >
            <div className="flex gap-3">
              <SkeletonBlock className="size-10 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <SkeletonBlock className="h-3.5 w-24" />
                  <SkeletonBlock className="h-3 w-14" />
                </div>
                <SkeletonBlock className={`mt-4 h-3.5 ${row.bodyWidth}`} />
                <SkeletonBlock className="mt-2 h-3.5 w-3/5" />

                {row.media ? (
                  <span className="mt-4 block aspect-[16/8.5] animate-pulse rounded-2xl bg-[#1c2821]/7 motion-reduce:animate-none dark:bg-white/7" />
                ) : null}

                <div className="mt-5 flex max-w-sm items-center justify-between">
                  <SkeletonBlock className="h-4 w-12" />
                  <SkeletonBlock className="h-4 w-12" />
                  <SkeletonBlock className="h-4 w-12" />
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
