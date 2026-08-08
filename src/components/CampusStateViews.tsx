import { campusButton } from "@/components/campusButtonStyles";

/**
 * Yükleniyor ve hata durumları için ortak görünümler.
 *
 * Sayfaların kimi spinner, kimi iskelet, kimi de hiçbir şey gösteriyordu;
 * hata durumunda bazıları sessizce boş kalıyordu. Kural burada toplandı.
 */

export function CampusLoadingState({
  label = "Yükleniyor…",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`grid min-h-80 place-items-center px-4 py-14 text-center sm:px-6 ${className}`}
    >
      <div>
        <span
          aria-hidden="true"
          className="mx-auto block size-7 animate-spin rounded-full border-2 border-white/14 border-t-[#ff6b3d] motion-reduce:animate-none"
        />
        <p className="mt-4 text-sm font-bold text-white/60">{label}</p>
      </div>
    </div>
  );
}

export function CampusErrorState({
  title = "İçerik yüklenemedi",
  description = "Bağlantı kurulamadı. Birazdan yeniden dene.",
  onRetry,
  className = "",
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`grid min-h-80 place-items-center px-4 py-14 text-center sm:px-6 ${className}`}
    >
      <div className="max-w-md">
        <span
          aria-hidden="true"
          className="mx-auto grid size-12 place-items-center rounded-full border border-danger/30 text-xl text-danger"
        >
          !
        </span>
        <h2 className="mt-5 text-lg font-black tracking-[-0.03em]">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-white/55">{description}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={`mt-6 ${campusButton.primary}`}
          >
            Yeniden dene
          </button>
        )}
      </div>
    </div>
  );
}
