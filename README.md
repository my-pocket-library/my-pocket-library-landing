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
| Hero posters (the scene's opening frame) | `public/hero/scene-{sm,md,lg}.webp` |
| Link-preview image (1200×630) | `public/og.jpg` |

## Hero posters

The 3D hero is fronted by a still of its opening frame. It shows until the
scene has drawn, and stays for visitors without WebGL 2, with reduced motion
on, or if the 3D chunk fails to load. The still is shown centred and
unscaled, so it has to be a pixel-exact render of the canvas. **Re-capture it
whenever the scene's look or framing changes.**

One file per canvas height, each at 2× with a transparent background:
`sm` is 767×360, `md` is 1023×460 and `lg` is 1600×520 (CSS px). To capture
one, run the production build and open the page at that width with a
device scale factor of 2. Hide the page background, the icon pattern and the
`<picture>`, and turn off the canvas wrapper's fade. Pin the hero text block
to a whole-pixel height (for example 400px) so the canvas starts on an exact
pixel. Then screenshot the `<canvas>` with a transparent background as soon
as it fades in: the scene holds its opening frame for 700 ms after that.
Encode with `cwebp -q 78 -alpha_q 90 -m 6 -sharp_yuv`.

## When the app goes live

Set `APP_STORE_URL` in `src/lib/site.ts` to the App Store listing
(`https://apps.apple.com/app/id…`). That turns the "Coming soon" badge into a
download link and adds Safari's Smart App Banner.

## Changing a policy

Edit the MDX text, move the effective date on its page, and bump its
`lastModified` in `src/app/sitemap.ts`. This site is the published source of
truth: the app repository no longer keeps its own copies.
