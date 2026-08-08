/**
 * Otomatik gizlenen gönderi yalnızca yazarına görünmeye devam eder. Sessizce
 * kaybolmuş gibi durmaması için durumu açıkça yazıyoruz.
 */
export default function CampusHiddenNotice({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <p
      role="status"
      className={`mt-3 flex items-start gap-2 border-l-2 border-brand/45 bg-brand/6 py-2 pl-3 pr-2 font-semibold text-white/72 ${
        compact ? "text-[11px] leading-4" : "text-xs leading-5"
      }`}
    >
      <span aria-hidden="true" className="mt-px shrink-0 text-brand">
        ⏸
      </span>
      <span>
        Bu gönderi şikâyet edildiği için inceleme altında. Şu anda yalnızca
        sen görüyorsun; inceleme sonuçlanınca yeniden yayına girebilir.
      </span>
    </p>
  );
}
