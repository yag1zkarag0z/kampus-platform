"use client";

type ThemeToggleProps = {
  showLabel?: boolean;
  className?: string;
};

const STORAGE_KEY = "kampus-theme";

export default function ThemeToggle({
  showLabel = false,
  className = "",
}: ThemeToggleProps) {
  const toggleTheme = () => {
    const root = document.documentElement;
    const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";

    root.dataset.theme = nextTheme;
    root.style.colorScheme = nextTheme;

    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // The visual theme still changes when storage is unavailable.
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Renk temasını değiştir"
      title="Renk temasını değiştir"
      className={`theme-toggle inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#1c2821]/16 bg-[#fffaf4]/58 px-3 text-[#1c2821] shadow-[0_8px_24px_rgba(59,32,40,0.06)] outline-none transition-colors hover:border-[#5a1f32]/35 hover:bg-[#fffaf4]/90 focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 dark:border-white/14 dark:bg-white/6 dark:text-[#ece8e1] dark:shadow-none dark:hover:border-[#c7896d]/45 dark:hover:bg-white/10 ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="theme-icon-moon size-4"
      >
        <path
          d="M15.7 12.6A6.6 6.6 0 0 1 7.4 4.3 6.4 6.4 0 1 0 15.7 12.6Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="theme-icon-sun size-4"
      >
        <circle cx="10" cy="10" r="3.2" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M10 2.4v1.5M10 16.1v1.5M2.4 10h1.5M16.1 10h1.5M4.6 4.6l1.1 1.1M14.3 14.3l1.1 1.1M15.4 4.6l-1.1 1.1M5.7 14.3l-1.1 1.1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {showLabel && <span className="text-xs font-bold">Tema</span>}
    </button>
  );
}
