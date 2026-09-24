import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import PolicyContent from "@/content/privacy-policy.mdx";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "What My Pocket Library collects, why, where it is stored, how long it is kept, and the rights you have over your data.",
  path: "/privacy",
});

export default function PolicyPage() {
  return (
    <LegalPage title="Privacy Policy" effectiveDate="September 24, 2026">
      <PolicyContent />
    </LegalPage>
  );
}
