import type { Metadata } from "next";
import { UsersView } from "@/features/governance/users-view";

export const metadata: Metadata = { title: "Pengguna & Akses" };

export default function Page() {
  return <UsersView />;
}
