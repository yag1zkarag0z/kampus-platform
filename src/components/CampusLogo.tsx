type CampusLogoProps = {
  variant?: "mark" | "lockup";
  idPrefix: string;
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
};

type PrismUGlyphProps = {
  idPrefix: string;
  className: string;
};

function PrismUGlyph({ idPrefix, className }: PrismUGlyphProps) {
  const lensGradientId = `${idPrefix}-lens-gradient`;
  const rimGradientId = `${idPrefix}-rim-gradient`;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 30 36"
      className={`shrink-0 overflow-visible ${className}`}
    >
      <defs>
        <linearGradient
          id={lensGradientId}
          x1="7"
          y1="1"
          x2="23"
          y2="11"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--logo-lens-start)" />
          <stop offset="0.48" stopColor="var(--logo-lens-mid)" />
          <stop offset="0.78" stopColor="var(--logo-lens-dark)" />
          <stop offset="1" stopColor="var(--logo-lens-end)" />
        </linearGradient>
        <linearGradient
          id={rimGradientId}
          x1="6"
          y1="1"
          x2="24"
          y2="11"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--logo-rim-start)" />
          <stop offset="0.52" stopColor="var(--logo-rim-mid)" />
          <stop offset="1" stopColor="var(--logo-rim-end)" />
        </linearGradient>
      </defs>

      <path
        d="M5.2 19.5c1.1 8.2 4.7 12.4 9.8 12.4s8.7-4.2 9.8-12.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="5.2"
        strokeLinecap="round"
      />

      <rect
        x="6.6"
        y="2"
        width="6.8"
        height="9.3"
        rx="3.4"
        transform="rotate(-5 10 6.65)"
        fill={`url(#${lensGradientId})`}
        stroke={`url(#${rimGradientId})`}
        strokeWidth="0.85"
      />
      <rect
        x="16.9"
        y="1.5"
        width="6.8"
        height="9.6"
        rx="3.4"
        transform="rotate(5 20.3 6.3)"
        fill={`url(#${lensGradientId})`}
        stroke={`url(#${rimGradientId})`}
        strokeWidth="0.85"
      />

      <path
        d="M8.8 4.25c-.45.7-.62 1.55-.55 2.45M19.1 3.8c-.42.72-.57 1.58-.48 2.48"
        fill="none"
        stroke="#fff8f1"
        strokeWidth="0.85"
        strokeLinecap="round"
        strokeOpacity="0.72"
      />
    </svg>
  );
}

export default function CampusLogo({
  variant = "lockup",
  idPrefix,
  className = "",
  markClassName = "h-8 w-6",
  wordmarkClassName = "text-xl",
}: CampusLogoProps) {
  if (variant === "mark") {
    return (
      <span className={`inline-flex shrink-0 items-center ${className}`}>
        <PrismUGlyph idPrefix={idPrefix} className={markClassName} />
      </span>
    );
  }

  return (
    <span className={`inline-flex shrink-0 items-center ${className}`}>
      <span className="sr-only">KAMPÜS.</span>
      <span
        aria-hidden="true"
        className={`inline-flex items-end font-black leading-none tracking-[-0.05em] ${wordmarkClassName}`}
      >
        <span>KAMP</span>
        <PrismUGlyph
          idPrefix={idPrefix}
          className="h-[1.28em] w-[1.07em] translate-y-[0.05em]"
        />
        <span>
          S<span className="text-[#ff7a45]">.</span>
        </span>
      </span>
    </span>
  );
}
