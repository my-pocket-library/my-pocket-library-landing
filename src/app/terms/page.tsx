import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Use — My Pocket Library",
  description: "The terms that govern your use of My Pocket Library.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" effectiveDate="May 17, 2026">
      <p>
        These Terms of Use apply to My Pocket Library, a personal book library
        app for iOS.
      </p>

      <section>
        <h2>Use of the App</h2>
        <p>
          You may use My Pocket Library to scan ISBN barcodes, add books to
          your personal library, organize books by location, track reading
          status, add notes, manage profile information, and use friend-related
          features where available.
        </p>
        <p>
          You agree not to misuse the app, interfere with its operation,
          attempt unauthorized access to other users&rsquo; data, or use the
          app for unlawful purposes.
        </p>
      </section>

      <section>
        <h2>Account</h2>
        <p>
          Some features may require signing in with Apple or Google. You are
          responsible for maintaining access to your account and for activity
          that occurs under your account.
        </p>
      </section>

      <section>
        <h2>User Content</h2>
        <p>
          You are responsible for the information you add to the app,
          including notes, profile information, shelf/location names, and
          library entries. You should not add content that is unlawful,
          harmful, or infringes another person&rsquo;s rights.
        </p>
      </section>

      <section>
        <h2>Book Metadata</h2>
        <p>
          The app may retrieve book metadata from third-party services such as
          Google Books and Open Library. Book metadata may be incomplete,
          unavailable, or incorrect. You are responsible for reviewing and
          editing your library entries as needed.
        </p>
      </section>

      <section>
        <h2>Privacy</h2>
        <p>
          Your use of the app is also governed by the{" "}
          <Link
            href="/privacy"
            className="underline decoration-black/30 underline-offset-4 hover:decoration-black"
          >
            Privacy Policy for My Pocket Library
          </Link>
          .
        </p>
      </section>

      <section>
        <h2>No Warranty</h2>
        <p>
          The app is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo;
          We do not guarantee that the app will always be available,
          error-free, secure, or that book metadata will always be accurate.
        </p>
      </section>

      <section>
        <h2>Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, we are not liable for
          indirect, incidental, special, consequential, or punitive damages
          arising from your use of the app.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          We may update these Terms from time to time. Updates will be
          reflected by changing the effective date above.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          If you have questions about these Terms, contact{" "}
          <a
            href="mailto:hasanaharman33@gmail.com"
            className="underline decoration-black/30 underline-offset-4 hover:decoration-black"
          >
            hasanaharman33@gmail.com
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
