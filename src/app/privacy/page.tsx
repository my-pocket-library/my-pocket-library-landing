import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import PolicyContent from "@/content/privacy-policy.mdx";

export const metadata: Metadata = {
  title: "Privacy Policy — My Pocket Library",
};

export default function PolicyPage() {
  return (
    <LegalPage title="Privacy Policy" effectiveDate="August 19, 2026">
      <PolicyContent />
    </LegalPage>
  );
}
