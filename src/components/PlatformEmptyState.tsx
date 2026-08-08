type PlatformEmptyStateProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export default function PlatformEmptyState({
  eyebrow,
  title,
  description,
}: PlatformEmptyStateProps) {
  return (
    <section className="flex min-h-[calc(100svh-4rem)] flex-col bg-canvas md:min-h-svh">
      <header className="sticky top-0 z-20 flex min-h-16 items-center justify-center border-b border-white/10 bg-canvas/88 px-4 text-center backdrop-blur-xl sm:px-5">
        <p className="text-base font-black tracking-[-0.035em] text-white">{title}</p>
      </header>

      <div className="grid flex-1 place-items-center px-5 py-16 text-center sm:px-8">
        <div className="max-w-md">
          <span
            aria-hidden="true"
            className="mx-auto grid size-14 place-items-center rounded-full border border-white/12 bg-surface-raised text-2xl text-brand"
          >
            ◇
          </span>
          <p className="mt-6 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-brand">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.055em] text-white sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/55">
            {description}
          </p>
        </div>
      </div>
    </section>
  );
}
