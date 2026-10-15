# Policy sources

`privacy-policy.mdx` and `terms-and-license.mdx` are the published privacy
policy and terms for My Pocket Library, and this site is their source of
truth: the iOS app links to `/privacy` and `/terms` (`LegalLinks.swift` in the
pocket-library repo), and the app repository removed its own `legal/` copies
on September 23, 2026.

Only the title and effective date are rendered separately, by each route's
`LegalPage` wrapper (`src/app/privacy/page.tsx`, `src/app/terms/page.tsx`).
When a policy changes, edit the text here and move its effective date.

History: both files were imported from the app repository's `legal/` folder
on September 19, 2026. The privacy policy was brought up to its last app
version on September 24, 2026 (cover photos, books added to the catalogue,
report visibility, "Your requests"), with the likes wording corrected to match
the September 23 change that lets anyone who can see an activity like it.
On September 29, 2026 it gained what blocking now does: the blocker keeps the
conversation, the blocked reader keeps only their own messages and is told
they are blocked. On October 14, 2026 both documents gained the App Review
moderation work: book clubs can be reported and blocked in, shared text is
filtered before it posts, new photos are screened by Cloud Vision, operators
can remove reported content and suspend an account, and ISBNdb is named; the
Terms' description of blocking was corrected to match the privacy policy.

FAQ and support copy (`faq.mdx`, `support.mdx`) is based on these documents.
