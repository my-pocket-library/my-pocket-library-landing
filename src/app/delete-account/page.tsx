import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import DeleteAccountContent from "@/content/delete-account.mdx";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Delete Your Account",
  description:
    "How to delete your My Pocket Library account in the app or by email, what is deleted, and what is kept.",
  path: "/delete-account",
});

export default function DeleteAccountPage() {
  return (
    <LegalPage title="Delete Your Account" effectiveDate="November 13, 2026">
      <DeleteAccountContent />
    </LegalPage>
  );
}
