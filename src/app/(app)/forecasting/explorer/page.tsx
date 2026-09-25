import type { Metadata } from "next";
import { ExplorerView } from "@/features/forecast-explorer/explorer-view";

export const metadata: Metadata = { title: "Perkiraan Permintaan" };

export default function ExplorerPage() {
  return <ExplorerView />;
}
