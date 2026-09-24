import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import PolicyContent from "@/content/terms-and-license.mdx";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Use",
  description:
    "The terms for using My Pocket Library: your account, your content, Pocket Library Pro subscriptions, and messaging conduct.",
  path: "/terms",
});

export default function PolicyPage() {
  return (
    <LegalPage title="Terms of Use" effectiveDate="September 19, 2026">
      <PolicyContent />
    </LegalPage>
  );
}
