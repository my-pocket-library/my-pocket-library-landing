# My Pocket Library — landing site

The marketing site for the My Pocket Library iOS app, served at
[www.mypocketlibrary.app](https://www.mypocketlibrary.app). It also hosts the
app's **privacy policy** (`/privacy`) and **terms of use** (`/terms`): the app
links to both, so those two URLs must keep working.

Built with Next.js (App Router, static pages), Tailwind CSS v4, MDX for copy,
and React Three Fiber for the 3D book carousel in the hero.

## Develop

```bash
pnpm install
pnpm dev        # http://localhost:3000 — a Tweakpane panel tunes the 3D scene
pnpm lint
pnpm build && pnpm start
```

## Where things live

| What | Where |
| --- | --- |
| Site URL, contact email, App Store link | `src/lib/site.ts` |
| FAQ, support copy, privacy policy, terms | `src/content/*.mdx` (see `src/content/README.md`) |
| Policy effective dates | `src/app/privacy/page.tsx`, `src/app/terms/page.tsx` |
| Sitemap dates | `src/app/sitemap.ts` |
| 3D hero (books + phone) | `src/components/book-scene.tsx`, `book.tsx`, `phone.tsx`, tuning in `src/lib/scene-params.ts` |
| Book cover images (768px tall) | `public/images/` |
| Link-preview image (1200×630) | `public/og.jpg` |

## When the app goes live

Set `APP_STORE_URL` in `src/lib/site.ts` to the App Store listing
(`https://apps.apple.com/app/id…`). That turns the "Coming soon" badge into a
download link and adds Safari's Smart App Banner.

## Changing a policy

Edit the MDX text, move the effective date on its page, and bump its
`lastModified` in `src/app/sitemap.ts`. This site is the published source of
truth: the app repository no longer keeps its own copies.
