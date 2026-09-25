import type { Metadata } from "next";
import { BacktestingView } from "@/features/models/backtesting-view";

export const metadata: Metadata = { title: "Backtesting" };

export default function Page() {
  return <BacktestingView />;
}
