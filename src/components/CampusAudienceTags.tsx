import { calendarAudienceStyles } from "@/components/CampusCalendarStyles";
import type { AcademicAudience } from "@/data/academicCalendar";

/**
 * Bir takvim kaydının hangi öğrenci grubunu bağladığını gösterir.
 *
 * Takvimin en kritik bilgisi bu: yanlış gruba ait bir sınav tarihini kendine
 * ait sanan öğrenci sınavı kaçırır. Bu yüzden etiketler hem tam sayfada hem
 * sağ sütundaki kartta, hiçbir görünümde gizlenmeden gösterilir.
 */
export default function CampusAudienceTags({
  audiences,
  size = "md",
  className = "",
}: {
  audiences: AcademicAudience[];
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <ul
      aria-label="Bu tarih hangi öğrencileri kapsıyor"
      className={`flex flex-wrap gap-1 ${className}`}
    >
      {audiences.map((item) => (
        <li key={item}>
          <span
            className={`inline-flex items-center border whitespace-nowrap ${
              size === "sm"
                ? "px-1 py-px text-[9px] font-bold"
                : "px-1.5 py-0.5 text-[10px] font-bold"
            } ${calendarAudienceStyles[item].badge}`}
          >
            {calendarAudienceStyles[item].short}
          </span>
        </li>
      ))}
    </ul>
  );
}
