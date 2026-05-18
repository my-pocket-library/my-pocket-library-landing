import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — My Pocket Library",
  description:
    "How My Pocket Library collects, uses, and protects your information.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" effectiveDate="May 17, 2026">
      <p>
        My Pocket Library is a personal book library app for scanning ISBN
        barcodes, organizing books, tracking reading status, adding notes,
        managing shelf locations, and optionally sharing limited profile and
        book information with friends.
      </p>

      <section>
        <h2>Information We Collect</h2>
        <p>
          When you use the app, we may collect account information such as your
          email address, display name, username, and authentication identifier
          when you sign in with Apple or Google. We may also collect library
          information you choose to add, such as book titles, authors, ISBNs,
          reading status, notes, shelf/location names, book format, and borrow
          tracking information.
        </p>
        <p>
          Optional profile information may include a profile photo, display
          name, and username. Friend and sharing features may use friend
          requests, friend records, and books you choose to make visible
          through public profile features.
        </p>
        <p>
          Camera access is used only to scan ISBN barcodes. The app does not
          use the camera for any other purpose.
        </p>
      </section>

      <section>
        <h2>How We Use Information</h2>
        <p>
          We use this information to create and manage your account, save and
          sync your personal library, look up book metadata from ISBNs, show
          your books and app features, and improve app reliability.
        </p>
      </section>

      <section>
        <h2>Third-Party Services</h2>
        <p>
          My Pocket Library uses Firebase Authentication, Firebase Firestore,
          Google Sign-In, Google Books, and Open Library to provide core app
          features. These services may process information according to their
          own privacy policies.
        </p>
      </section>

      <section>
        <h2>Data Sharing</h2>
        <p>
          We do not sell your personal information. We do not share your
          personal library data with advertisers. Some information may be
          shared only when needed to operate the app, such as with Firebase
          for authentication and data storage, or with book metadata services
          when looking up ISBN information.
        </p>
        <p>
          If you use friend or public profile features, limited profile and
          book information may be visible to users you connect with or choose
          to share with.
        </p>
      </section>

      <section>
        <h2>Data Retention and Deletion</h2>
        <p>
          We keep your information for as long as your account is active or as
          needed to provide the app. You may delete your account in the app,
          which removes your profile and account-related app data from our
          active database where technically possible.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          My Pocket Library is not intended for children under 13. We do not
          knowingly collect personal information from children under 13.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          We use reasonable technical measures, including Firebase security
          rules and platform authentication, to protect app data. No method of
          electronic storage or transmission is completely secure.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          If you have questions about this Privacy Policy, contact{" "}
          <a
            href="mailto:hasanaharman33@gmail.com"
            className="underline decoration-black/30 underline-offset-4 hover:decoration-black"
          >
            hasanaharman33@gmail.com
          </a>
          .
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          We may update this Privacy Policy from time to time. Updates will be
          reflected by changing the effective date above.
        </p>
      </section>
    </LegalPage>
  );
}
