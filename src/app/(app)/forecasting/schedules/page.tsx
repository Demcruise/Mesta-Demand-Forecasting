import type { Metadata } from "next";
import { SchedulesView } from "@/features/schedules/schedules-view";

export const metadata: Metadata = { title: "Jadwal Perkiraan" };

export default function SchedulesPage() {
  return <SchedulesView />;
}
