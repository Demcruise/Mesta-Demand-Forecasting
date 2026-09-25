import { redirect } from "next/navigation";

export default function SettingsIndex() {
  redirect("/administration/settings/personal");
}
