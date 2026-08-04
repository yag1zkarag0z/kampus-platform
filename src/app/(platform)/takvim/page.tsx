import type { Metadata } from "next";
import CampusCalendar from "@/components/CampusCalendar";
import { ACADEMIC_YEAR_LABEL } from "@/data/academicCalendar";

export const metadata: Metadata = {
  title: "Kampüs takvimi | KAMPÜS.",
  description: `Yaşar Üniversitesi ${ACADEMIC_YEAR_LABEL} akademik takvimi: ders kayıtları, sınavlar, ödemeler ve resmî tatiller.`,
};

export default function CalendarPage() {
  return <CampusCalendar />;
}
