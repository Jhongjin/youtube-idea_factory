import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ProviderSettingsForm } from "@/app/components/provider-settings-form";
import { getSafeProviderSettings } from "@/lib/provider-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSafeProviderSettings();

  return (
    <main className="settings-page">
      <div className="settings-topbar">
        <Link className="text-button" href="/">
          <ArrowLeft size={15} />
          Dashboard
        </Link>
        <div className="settings-security-note">
          <ShieldCheck size={15} />
          Local-only provider settings
        </div>
      </div>
      <ProviderSettingsForm initialSettings={settings} />
    </main>
  );
}
