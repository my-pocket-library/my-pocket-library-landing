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

FAQ and support copy (`faq.mdx`, `support.mdx`) is based on these documents.
