import type { CampusPostDocument as CampusPostDocumentData } from "@/data/campusPosts";

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-brand/40";

function formatFileSize(bytes: number) {
  const megabytes = bytes / (1024 * 1024);

  return megabytes >= 0.1
    ? `${megabytes.toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
}

export default function CampusPostDocument({
  document,
  variant = "default",
}: {
  document: CampusPostDocumentData;
  variant?: "default" | "detail";
}) {
  return (
    <a
      href={document.src}
      download={document.name}
      className={`flex items-center gap-3 border border-white/12 bg-white/3 p-3 transition-colors hover:border-brand/35 hover:bg-brand/5 ${focusRing} ${
        variant === "detail" ? "mt-5" : "mt-3"
      }`}
    >
      <span
        aria-hidden="true"
        className="grid size-11 shrink-0 place-items-center border border-white/12 bg-white/6 text-[10px] font-black uppercase tracking-[0.06em] text-brand"
      >
        PDF
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{document.name}</p>
        <p className="mt-0.5 text-[11px] text-white/55">
          {formatFileSize(document.sizeBytes)} · İndirmek için dokun
        </p>
      </div>
    </a>
  );
}
