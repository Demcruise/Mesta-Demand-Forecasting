import type { Metadata } from "next";
import { BacktestingView } from "@/features/models/backtesting-view";

export const metadata: Metadata = { title: "Uji Model" };

export default function Page() {
  return <BacktestingView />;
}
