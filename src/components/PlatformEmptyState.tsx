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
    <section className="flex min-h-[calc(100svh-4rem)] flex-col bg-[#f8f4ed]/62 dark:bg-[#141619] md:min-h-svh">
      <header className="sticky top-16 z-20 flex min-h-16 items-center border-b border-[#1c2821]/10 bg-[#eee9e1]/88 px-4 backdrop-blur-xl dark:border-white/9 dark:bg-[#111315]/88 sm:px-5 md:top-0">
        <p className="text-base font-black tracking-[-0.035em]">{title}</p>
      </header>

      <div className="grid flex-1 place-items-center px-5 py-16 text-center sm:px-8">
        <div className="max-w-md">
          <span
            aria-hidden="true"
            className="mx-auto grid size-14 place-items-center rounded-full border border-[#1c2821]/14 bg-[#e1d5ca] text-2xl text-[#7d3c2d] dark:border-white/12 dark:bg-[#30231f] dark:text-[#d09272]"
          >
            ◇
          </span>
          <p className="mt-6 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#7d3c2d] dark:text-[#c7896d]">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.055em] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#1c2821]/60 dark:text-white/56">
            {description}
          </p>
        </div>
      </div>
    </section>
  );
}
