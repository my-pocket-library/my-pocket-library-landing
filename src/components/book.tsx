"use client";

import { type RefObject, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import { requestFrame } from "@/lib/scene-frame";
import { PARAMS } from "@/lib/scene-params";

export type BookCover = {
  title: string;
  author?: string;
  baseColor: string;
  accent: string;
  ink: string;
  pattern: "ornate" | "swirl" | "plain" | "stripe" | "emblem" | "stars";
  /** Optional URL to a real cover image. When set, a flat baseColor fill
   *  stands in while the image loads, and the image is then drawn over it,
   *  asynchronously, with `texture.needsUpdate = true` to refresh the GPU
   *  upload. Without one, the procedural cover artwork is painted. */
  image?: string;
};

export type BookProps = {
  cover: BookCover;
  /** Stable book index — drives per-book wear and color variation, and
   *  picks this book's entry in `opacitiesRef`. */
  index?: number;
  /** Per-book opacities in [0, 1], indexed like the carousel's COVERS and
   *  written by the parent scene each frame. Used to fade books in/out as
   *  they rotate through the carousel so only the front N are visible.
   *  Read inside this component's useFrame so the fade stays in lockstep
   *  with position updates (no React-state lag). */
  opacitiesRef?: RefObject<number[]>;
};

// ---------------------------------------------------------------------------
// Per-book deterministic helpers
// ---------------------------------------------------------------------------

// Wear in [0.35, 1.0]. Stable per index.
function getWearAmount(i: number): number {
  return 0.35 + (Math.sin(i * 1.7) * 0.5 + 0.5) * 0.65;
}

export function paintCover(
  canvas: HTMLCanvasElement,
  cover: BookCover,
  wear = 1,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = cover.baseColor;
  ctx.fillRect(0, 0, W, H);

  // Ink density blotches — subtle uneven pigment, like real printed card stock.
  const blotchCount = Math.max(4, Math.floor(22 * wear));
  for (let i = 0; i < blotchCount; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const radius = 60 + Math.random() * 130;
    const isDark = Math.random() > 0.5;
    const tone = isDark ? "0, 0, 0" : "255, 255, 255";
    const alpha = 0.025 + Math.random() * 0.04;
    const grad2 = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad2.addColorStop(0, `rgba(${tone}, ${alpha})`);
    grad2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad2;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  // Subtle vignette
  const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Pattern
  ctx.save();
  ctx.strokeStyle = cover.accent;
  ctx.fillStyle = cover.accent;
  ctx.globalAlpha = 0.6;
  if (cover.pattern === "ornate") {
    ctx.lineWidth = 6;
    ctx.strokeRect(36, 36, W - 72, H - 72);
    ctx.lineWidth = 2;
    ctx.strokeRect(56, 56, W - 112, H - 112);
    // corner flourishes
    for (const [cx, cy] of [
      [80, 80],
      [W - 80, 80],
      [80, H - 80],
      [W - 80, H - 80],
    ]) {
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (cover.pattern === "swirl") {
    ctx.lineWidth = 3;
    for (let r = 40; r < W; r += 60) {
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.6, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (cover.pattern === "stripe") {
    ctx.globalAlpha = 0.25;
    for (let y = 0; y < H; y += 32) {
      ctx.fillRect(0, y, W, 12);
    }
  } else if (cover.pattern === "emblem") {
    ctx.lineWidth = 4;
    const cx = W / 2;
    const cy = H * 0.55;
    ctx.beginPath();
    ctx.ellipse(cx, cy, W * 0.28, H * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, W * 0.22, H * 0.14, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (cover.pattern === "stars") {
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 24; i++) {
      const x = (i * 137.5) % W;
      const y = (i * 211.3) % H;
      ctx.beginPath();
      ctx.arc(x, y, 3 + (i % 4), 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.lineWidth = 4;
    ctx.strokeRect(48, 48, W - 96, H - 96);
  }
  ctx.restore();

  // Title
  ctx.fillStyle = cover.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const words = cover.title.toUpperCase().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (test.length > 12) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);

  const fontSize = Math.min(72, 520 / Math.max(...lines.map((l) => l.length)));
  ctx.font = `700 ${fontSize}px "Times New Roman", serif`;
  const totalH = lines.length * fontSize * 1.05;
  const startY = H * 0.42 - totalH / 2;
  lines.forEach((line, i) => {
    const yPos = startY + i * fontSize * 1.05;
    // Ink misregistration: a faint shadow ghost behind the main glyphs.
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.fillText(line, W / 2 + 0.8, yPos + 0.8);
    ctx.fillStyle = cover.ink;
    ctx.fillText(line, W / 2, yPos);
  });

  // Author
  if (cover.author) {
    ctx.font = `italic 28px "Times New Roman", serif`;
    ctx.fillStyle = cover.ink;
    ctx.globalAlpha = 0.85;
    ctx.fillText(cover.author, W / 2, H * 0.82);
    ctx.globalAlpha = 1;
  }

  // --- Imperfection overlays applied after artwork so they sit on top ---

  // Dust speckles — mostly dark, a few light, sub-pixel-ish dots.
  const dustCount = Math.max(10, Math.floor(70 * wear));
  for (let i = 0; i < dustCount; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 0.3 + Math.random() * 1.4;
    const isDark = Math.random() > 0.45;
    ctx.fillStyle = isDark
      ? `rgba(0, 0, 0, ${0.1 + Math.random() * 0.15})`
      : `rgba(255, 255, 255, ${0.08 + Math.random() * 0.12})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Faint paper-fiber grain overlay — high-freq monochrome noise at very
  // low alpha. Drawn via an offscreen canvas for speed.
  const noiseCanvas = document.createElement("canvas");
  noiseCanvas.width = W;
  noiseCanvas.height = H;
  const noiseCtx = noiseCanvas.getContext("2d");
  if (noiseCtx) {
    const img = noiseCtx.createImageData(W, H);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(Math.random() * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = Math.floor(Math.random() * 14);
    }
    noiseCtx.putImageData(img, 0, 0);
    ctx.drawImage(noiseCanvas, 0, 0);
  }

  // Edge wear — a handful of tiny dark scratches radiating in from each corner.
  const scratchCount = Math.max(1, Math.floor(5 * wear));
  const drawCornerWear = (cx: number, cy: number, dirX: number, dirY: number) => {
    for (let i = 0; i < scratchCount; i++) {
      const len = 8 + Math.random() * 28;
      const angle = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * 0.9;
      const ex = cx + Math.cos(angle) * len;
      const ey = cy + Math.sin(angle) * len;
      ctx.strokeStyle = `rgba(0, 0, 0, ${0.12 + Math.random() * 0.18})`;
      ctx.lineWidth = 0.4 + Math.random() * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
  };
  drawCornerWear(0, 0, 1, 1);
  drawCornerWear(W, 0, -1, 1);
  drawCornerWear(0, H, 1, -1);
  drawCornerWear(W, H, -1, -1);
}

/**
 * The same serif font stack the page's HTML headings render in. The h1/h2
 * elements use Tailwind's `font-serif` utility, which resolves to this
 * stack — so the spine title visually matches the headline typeface.
 */
const HEADING_FONT_FAMILY =
  'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';

/**
 * Minimal modern spine: flat baseColor + vertical title in `ink` colour.
 * No edge vignette, no accent bands, no hinge creases, no wear scratches —
 * the visual goal is clean and contemporary rather than aged-hardcover.
 */
function paintSpine(canvas: HTMLCanvasElement, cover: BookCover) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  // Flat colour fill — no gradient.
  ctx.fillStyle = cover.baseColor;
  ctx.fillRect(0, 0, W, H);

  // Vertical title — serif, matching the page's HTML headings (`font-serif`
  // class on h1/h2). Medium weight reads naturally on a real serif at this
  // size. Font size scales with canvas width so the title stays consistent
  // across book-size tweaks.
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = cover.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fontSize = Math.min(32, 380 / cover.title.length) * (W / 128);
  ctx.font = `500 ${fontSize}px ${HEADING_FONT_FAMILY}`;
  // Title case as stored in COVERS — no .toUpperCase() so it renders
  // exactly as written ("The Hobbit", "Sapiens", "Atomic Habits", etc.).
  ctx.fillText(cover.title, 0, 0);
  ctx.restore();
}

function paintPages(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  // Base cream — slightly warmer than before.
  ctx.fillStyle = "#f3e8d3";
  ctx.fillRect(0, 0, W, H);

  // Subtle horizontal density bands (groups of "pages" with slightly different
  // tones) — adds the impression of dozens of paper signatures stacked together.
  for (let band = 0; band < 9; band++) {
    const y0 = (band / 9) * H;
    const y1 = ((band + 1) / 9) * H;
    const tone = 200 + Math.floor((Math.random() - 0.5) * 24);
    ctx.fillStyle = `rgba(${tone}, ${tone - 14}, ${tone - 40}, 0.22)`;
    ctx.fillRect(0, y0, W, y1 - y0);
  }

  // Dense individual page lines — one per pixel-row, with per-line darkness
  // jitter so the eye reads it as hundreds of separate paper sheets.
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 1) {
    const v = Math.random();
    const alpha = 0.04 + v * 0.16;
    const tone = 110 + Math.floor((Math.random() - 0.5) * 26);
    ctx.strokeStyle = `rgba(${tone}, ${tone - 18}, ${tone - 52}, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
    ctx.stroke();
  }

  // A handful of darker "signature" breaks — where chapters or signatures meet
  // in a real bound book, you get a sharper darker line.
  for (let i = 0; i < 10; i++) {
    const y = Math.floor(Math.random() * H);
    ctx.strokeStyle = "rgba(85, 60, 28, 0.55)";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Edge AO — darken the outer 10% on every side so the corners read as
  // recessed (the cover would shadow them in real life).
  const aoColor = "rgba(60, 42, 22, 0.45)";
  const aoFraction = 0.1;
  const drawEdgeAO = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    gradX0: number,
    gradY0: number,
    gradX1: number,
    gradY1: number,
  ) => {
    const grad = ctx.createLinearGradient(gradX0, gradY0, gradX1, gradY1);
    grad.addColorStop(0, aoColor);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  };
  drawEdgeAO(0, 0, W, H * aoFraction, 0, 0, 0, H * aoFraction);
  drawEdgeAO(
    0,
    H * (1 - aoFraction),
    W,
    H,
    0,
    H,
    0,
    H * (1 - aoFraction),
  );
  drawEdgeAO(0, 0, W * aoFraction, H, 0, 0, W * aoFraction, 0);
  drawEdgeAO(
    W * (1 - aoFraction),
    0,
    W,
    H,
    W,
    0,
    W * (1 - aoFraction),
    0,
  );
}

// ---------------------------------------------------------------------------
// Shared textures
//
// The carousel lists every book twice (the duplicates are the same cover
// objects) and every book uses the same page-edge texture, so textures are
// built once per cover and shared by all meshes that show it. Materials stay
// per instance, because each book fades in and out independently.
// ---------------------------------------------------------------------------

const imageCache = new Map<string, Promise<HTMLImageElement>>();

/** Load and decode a cover image once; the books and the phone share it. */
export function loadCoverImage(src: string): Promise<HTMLImageElement> {
  let image = imageCache.get(src);
  if (!image) {
    image = new Promise((resolve, reject) => {
      const img = new window.Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Could not load ${src}`));
      img.src = src;
    });
    imageCache.set(src, image);
  }
  return image;
}

function canvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

type CoverTextures = { cover: THREE.CanvasTexture; spine: THREE.CanvasTexture };

const coverTextureCache = new WeakMap<BookCover, CoverTextures>();

function getCoverTextures(cover: BookCover, wear: number): CoverTextures {
  const cached = coverTextureCache.get(cover);
  if (cached) return cached;

  // Cover — the real cover image when there is one, over a flat baseColor
  // fill while it loads; otherwise (or if it fails) the procedural artwork.
  const coverCanvas = document.createElement("canvas");
  coverCanvas.width = 512;
  coverCanvas.height = 768;
  const coverTex = canvasTexture(coverCanvas);
  if (cover.image) {
    const ctx = coverCanvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = cover.baseColor;
      ctx.fillRect(0, 0, coverCanvas.width, coverCanvas.height);
    }
    loadCoverImage(cover.image).then(
      (img) => {
        ctx?.drawImage(img, 0, 0, coverCanvas.width, coverCanvas.height);
        coverTex.needsUpdate = true;
        requestFrame();
      },
      () => {
        paintCover(coverCanvas, cover, wear);
        coverTex.needsUpdate = true;
        requestFrame();
      },
    );
  } else {
    paintCover(coverCanvas, cover, wear);
  }

  // Spine texture — flat baseColor + vertical title in the same serif
  // stack the page's HTML headings use. We still hook
  // `document.fonts.ready` and re-paint once fonts settle, in case a
  // future custom serif is added to the loader — system serifs
  // (Georgia / ui-serif) are present on first paint so this is a
  // free safety net.
  const spineCanvas = document.createElement("canvas");
  spineCanvas.width = 128;
  spineCanvas.height = 768;
  paintSpine(spineCanvas, cover);
  const spineTex = canvasTexture(spineCanvas);
  document.fonts?.ready.then(() => {
    paintSpine(spineCanvas, cover);
    spineTex.needsUpdate = true;
    requestFrame();
  });

  const textures = { cover: coverTex, spine: spineTex };
  coverTextureCache.set(cover, textures);
  return textures;
}

let pageTextures: { pages: THREE.CanvasTexture; edge: THREE.CanvasTexture } | null =
  null;

/**
 * Pages texture — horizontal stripes representing dense page edges.
 * Painted ONCE, with TWO textures over the same canvas: the upright one for
 * the top/bottom faces (where horizontal stripes read as page edges running
 * spine→open-edge), and a rotated copy for the open-edge face (where stripes
 * need to appear VERTICAL because each page is a vertical sheet, so its
 * visible edge is vertical too).
 */
function getPageTextures() {
  if (!pageTextures) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    paintPages(canvas);
    const pages = canvasTexture(canvas);
    const edge = canvasTexture(canvas);
    edge.center.set(0.5, 0.5);
    edge.rotation = Math.PI / 2;
    pageTextures = { pages, edge };
  }
  return pageTextures;
}

// Depth pre-pass for fading books. A book mid-fade is transparent, and a
// transparent book shows its own insides (page block, back board) through
// its cover, so it reads as glass. Drawing the book's depth first, with no
// colour, lets only its outermost surfaces through the depth test — it
// fades as one solid object. The pre-pass meshes draw in the transparent
// pass (renderOrder 0) just before the fading books themselves (1).
const DEPTH_PREPASS = new THREE.MeshBasicMaterial({
  colorWrite: false,
  transparent: true,
});

function applyOpacity(material: THREE.Material, opacity: number) {
  const transparent = opacity < 0.999;
  if (material.transparent !== transparent) {
    material.transparent = transparent;
    material.needsUpdate = true;
  }
  material.opacity = opacity;
}

// ---------------------------------------------------------------------------
// Book geometry — hardcover model.
//
// Real bound books aren't solid bricks: the front cover, back cover, and spine
// are three separate boards that together *overhang* a smaller page block
// recessed inside them. To model that, we don't use a single closed box for
// the cover — we use three separate pieces (front, back, spine) whose top,
// bottom, and open-edge faces are AIR, not cover material. That's what lets
// the recessed page block be visible from those angles.
//
//   Top-down cross-section (cover closed, looking from +Y):
//
//        spine ↓        ← open edge (+X) →
//      ┌──┬─────────────────────┐  ← front board (+Z face = cover art)
//      │  │                     │
//      │  │   ┌───────────────┐ │
//      │  │   │  page block   │ │  ← pages are smaller on every axis
//      │  │   └───────────────┘ │     so the boards overhang them
//      │  │                     │
//      └──┴─────────────────────┘  ← back board (-Z face = back cover)
//        ↑
//      spine (-X, occupies the binding edge, height = full H,
//             depth = the gap between the two boards)
//
// The page block is offset toward +X (away from the spine) just enough that
// its -X edge sits flush against the spine's +X face — no gap there. On +X,
// ±Y, and ±Z the cover boards extend past the page block by an "overhang"
// fraction, giving the recessed look.
// ---------------------------------------------------------------------------

// Fractions of the book's outer dimensions.
const COVER_BOARD_T_FRAC = 0.08;        // front/back board thickness (of D)
const SPINE_T_FRAC = 0.05;              // spine board thickness (of W)
const PAPER_TB_OVERHANG_FRAC = 0.025;   // cover overhang at top + bottom (of H)
const PAPER_OPEN_OVERHANG_FRAC = 0.025; // cover overhang at open edge   (of W)
const PAPER_Z_GAP_FRAC = 0.02;          // tiny gap between paper and boards (of D)
const COVER_BOW_FRAC = 0.04;            // outer face of front/back board swells outward

type BookPiece = {
  w: number;
  h: number;
  d: number;
  x: number;
  y: number;
  z: number;
};

type BookLayout = {
  frontBoard: BookPiece;
  backBoard: BookPiece;
  spine: BookPiece;
  paper: BookPiece;
  boardT: number;
  spineT: number;
};

/**
 * Given the outer book dimensions, compute size + center position for each
 * of the four meshes (front board, back board, spine, paper block). The page
 * block ends up smaller than the cover on every axis with the boards
 * overhanging it on +X / ±Y / ±Z.
 */
function bookLayout(w: number, h: number, d: number): BookLayout {
  const boardT = d * COVER_BOARD_T_FRAC;
  const spineT = w * SPINE_T_FRAC;
  const tbOverhang = h * PAPER_TB_OVERHANG_FRAC;
  const openOverhang = w * PAPER_OPEN_OVERHANG_FRAC;
  const zGap = d * PAPER_Z_GAP_FRAC;

  // Front + back boards: full outer (w × h), with the spine sitting alongside
  // them on -X and *between* their inner faces on Z. Boards therefore span
  // the entire front/back face of the book at thin depth boardT each.
  const frontBoard: BookPiece = {
    w,
    h,
    d: boardT,
    x: 0,
    y: 0,
    z: d / 2 - boardT / 2,
  };
  const backBoard: BookPiece = {
    w,
    h,
    d: boardT,
    x: 0,
    y: 0,
    z: -(d / 2 - boardT / 2),
  };

  // Spine: occupies the -X edge between the two boards' inner faces. Height
  // is the full book height; depth = the gap between front and back boards.
  const spine: BookPiece = {
    w: spineT,
    h,
    d: d - 2 * boardT,
    x: -w / 2 + spineT / 2,
    y: 0,
    z: 0,
  };

  // Paper block: recessed from every cover surface.
  //   -X edge: flush against spine's +X face   → x = -w/2 + spineT
  //   +X edge: cover overhang of openOverhang  → x =  w/2 - openOverhang
  //   ±Y edges: cover overhang of tbOverhang
  //   ±Z edges: pages sit between boards, with a tiny zGap on each side
  const paperW = w - spineT - openOverhang;
  const paperH = h - 2 * tbOverhang;
  const paperD = d - 2 * boardT - 2 * zGap;
  const paperCenterX = (spineT - openOverhang) / 2;
  const paper: BookPiece = {
    w: paperW,
    h: paperH,
    d: paperD,
    x: paperCenterX,
    y: 0,
    z: 0,
  };

  return { frontBoard, backBoard, spine, paper, boardT, spineT };
}

/**
 * Push the outer Z face vertices outward so the cover reads as a soft pillow.
 * Falloff is (1-u²)(1-v²) so the bow vanishes at the edges.
 *
 * `side`:
 *   "front" → only bow the +Z face (use on the front cover board)
 *   "back"  → only bow the -Z face (use on the back cover board)
 *   "both"  → bow both ±Z faces (legacy behaviour, for a single closed cover)
 *
 * Bowing only the outer face matters because the boards are thin: bowing
 * BOTH faces would push the inner face deeper into the recessed page block.
 */
function bowCoverGeometry(
  geom: THREE.BufferGeometry,
  bowAmount: number,
  side: "front" | "back" | "both" = "both",
) {
  const positions = geom.attributes.position as THREE.BufferAttribute;
  const normals = geom.attributes.normal as THREE.BufferAttribute;
  const box = new THREE.Box3().setFromBufferAttribute(positions);
  const halfW = (box.max.x - box.min.x) / 2;
  const halfH = (box.max.y - box.min.y) / 2;
  if (halfW <= 0 || halfH <= 0) return;
  for (let i = 0; i < positions.count; i++) {
    const nz = normals.getZ(i);
    if (Math.abs(nz) > 0.85) {
      if (side === "front" && nz < 0) continue;
      if (side === "back" && nz > 0) continue;
      const x = positions.getX(i);
      const y = positions.getY(i);
      const u = Math.min(1, Math.abs(x) / halfW);
      const v = Math.min(1, Math.abs(y) / halfH);
      const factor = (1 - u * u) * (1 - v * v);
      const sign = nz > 0 ? 1 : -1;
      positions.setZ(i, positions.getZ(i) + sign * bowAmount * factor);
    }
  }
  positions.needsUpdate = true;
  geom.computeVertexNormals();
}

// ---------------------------------------------------------------------------
// Draw-call budget
//
// Each piece's six faces used to be six material groups — 24 draw calls per
// book. The front board, back board and spine are merged into one "shell"
// geometry grouped by material instead (5 draws), and the page block's faces
// are regrouped into its two materials (2 draws).
// ---------------------------------------------------------------------------

/** Shell material slots. */
const SHELL = { edge: 0, inner: 1, front: 2, back: 3, spine: 4 } as const;
const SHELL_MATERIALS = 5;

// Per-face shell material for each piece, in BoxGeometry face order
// (+X, -X, +Y, -Y, +Z, -Z — RoundedBoxGeometry keeps it):
//   front board at +Z: +Z = cover art, -Z = inner (faces the paper)
//   back board  at -Z: -Z = back cover, +Z = inner (faces the paper)
//   spine       at -X: -X = spine art, +X and ±Z = inner, ±Y = edge
// Everything else is the binding-cloth edge strip.
const FRONT_FACES = [SHELL.edge, SHELL.edge, SHELL.edge, SHELL.edge, SHELL.front, SHELL.inner];
const BACK_FACES = [SHELL.edge, SHELL.edge, SHELL.edge, SHELL.edge, SHELL.inner, SHELL.back];
const SPINE_FACES = [SHELL.inner, SHELL.spine, SHELL.edge, SHELL.edge, SHELL.inner, SHELL.inner];

/** Merge geometries into one, with one group per target material. Works
 *  for indexed and non-indexed inputs (RoundedBoxGeometry is non-indexed:
 *  its groups then count vertices rather than indices). */
function mergeByMaterial(
  parts: { geometry: THREE.BufferGeometry; faceMaterials: readonly number[] }[],
  materialCount: number,
): THREE.BufferGeometry {
  const vertexCount = parts.reduce((n, p) => n + p.geometry.attributes.position.count, 0);
  const position = new Float32Array(vertexCount * 3);
  const normal = new Float32Array(vertexCount * 3);
  const uv = new Float32Array(vertexCount * 2);
  const byMaterial: number[][] = Array.from({ length: materialCount }, () => []);

  let offset = 0;
  for (const { geometry, faceMaterials } of parts) {
    const a = geometry.attributes;
    position.set(a.position.array as Float32Array, offset * 3);
    normal.set(a.normal.array as Float32Array, offset * 3);
    uv.set(a.uv.array as Float32Array, offset * 2);
    const index = geometry.index?.array;
    for (const group of geometry.groups) {
      const target = byMaterial[faceMaterials[group.materialIndex ?? 0]];
      for (let i = group.start; i < group.start + group.count; i++) {
        target.push((index ? index[i] : i) + offset);
      }
    }
    offset += a.position.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(position, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  merged.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  const index: number[] = [];
  byMaterial.forEach((triangles, material) => {
    merged.addGroup(index.length, triangles.length, material);
    for (const i of triangles) index.push(i);
  });
  merged.setIndex(index);
  return merged;
}

// ---------------------------------------------------------------------------
// Contact shadow
//
// A soft dark footprint on the ground under each book, so the books stand on
// something instead of floating over the page. One textured quad per book —
// far cheaper than a real shadow pass — that fades with its book.
// ---------------------------------------------------------------------------

/** How far the shadow spreads past the book's footprint, in world units. */
const SHADOW_SPREAD = 0.28;

let shadowTexture: THREE.CanvasTexture | null = null;

/** Soft rounded-rectangle falloff, sized in world units to the book. */
function getShadowTexture(w: number, d: number) {
  if (shadowTexture) return shadowTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const halfW = w / 2 + SHADOW_SPREAD;
    const halfD = d / 2 + SHADOW_SPREAD;
    // Distance outside the footprint, eased to zero over SHADOW_SPREAD.
    const falloff = (distance: number) => {
      const t = Math.min(1, Math.max(0, distance / SHADOW_SPREAD));
      return 1 - t * t * (3 - 2 * t);
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = Math.abs(((x + 0.5) / size) * 2 - 1) * halfW - w / 2;
        const dz = Math.abs(((y + 0.5) / size) * 2 - 1) * halfD - d / 2;
        const outside = Math.hypot(Math.max(0, dx), Math.max(0, dz));
        const alpha = falloff(outside);
        img.data[(y * size + x) * 4 + 3] = Math.round(alpha * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  shadowTexture = new THREE.CanvasTexture(canvas);
  return shadowTexture;
}

export function Book({ cover, index = 0, opacitiesRef }: BookProps) {
  // The hardcover model: front board, back board and spine (merged into one
  // "shell" mesh) around a smaller paper block. The boards' top, bottom and
  // open-edge faces are thin strips, so the recessed page block is genuinely
  // visible around them.
  const shellRef = useRef<THREE.Mesh>(null);
  const paperRef = useRef<THREE.Mesh>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const prepassRefs = useRef<(THREE.Mesh | null)[]>([]);
  const sizeRef = useRef<[number, number, number]>([0, 0, 0]);

  const materials = useMemo(() => {
    const { cover: coverTex, spine: spineTex } = getCoverTextures(
      cover,
      getWearAmount(index),
    );
    const { pages: pagesTex, edge: pagesEdgeTex } = getPageTextures();

    // Flat colour/texture only — no normal maps. Covers and spines get a
    // little gloss (laminated jackets), so the studio environment slides a
    // soft highlight across them as the carousel turns; paper stays matte.
    const front = new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.52 });
    const back = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cover.baseColor).multiplyScalar(0.42),
      roughness: 0.6,
    });
    const spine = new THREE.MeshStandardMaterial({ map: spineTex, roughness: 0.55 });
    // The binding cloth wrapping round the boards' thin sides — a little
    // darker than the cover so it reads as a fold.
    const edge = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cover.baseColor).multiplyScalar(0.75),
      roughness: 0.7,
    });
    // Inner faces facing the page block, mostly hidden — dark, so any
    // peek-through reads as the binding's shadowed lining.
    const inner = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cover.baseColor).multiplyScalar(0.3),
      roughness: 0.95,
    });
    // Paper: the open edge (±X) uses the rotated texture so page lines run
    // vertically; top/bottom (and the hidden ±Z) use the upright one.
    const pagesEdge = new THREE.MeshStandardMaterial({ map: pagesEdgeTex, roughness: 0.95 });
    const pages = new THREE.MeshStandardMaterial({ map: pagesTex, roughness: 0.95 });

    const shadow = new THREE.MeshBasicMaterial({
      map: getShadowTexture(PARAMS.bookWidth, PARAMS.bookDepth),
      color: 0x000000,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });

    const shell: THREE.Material[] = [];
    shell[SHELL.edge] = edge;
    shell[SHELL.inner] = inner;
    shell[SHELL.front] = front;
    shell[SHELL.back] = back;
    shell[SHELL.spine] = spine;
    return { shell, paper: [pagesEdge, pages], shadow };
  }, [cover, index]);

  // Materials are per instance (textures are shared and cached above).
  useEffect(() => {
    return () => {
      for (const material of [...materials.shell, ...materials.paper, materials.shadow]) {
        material.dispose();
      }
    };
  }, [materials]);

  // Geometry is rebuilt imperatively when the book size changes (tweakpane),
  // instead of through React re-renders, which flickered the carousel.
  useFrame(() => {
    const shell = shellRef.current;
    const paper = paperRef.current;
    const shadow = shadowRef.current;
    if (!shell || !paper || !shadow) return;

    const [lw, lh, ld] = sizeRef.current;
    if (lw !== PARAMS.bookWidth || lh !== PARAMS.bookHeight || ld !== PARAMS.bookDepth) {
      const w = PARAMS.bookWidth;
      const h = PARAMS.bookHeight;
      const d = PARAMS.bookDepth;
      const layout = bookLayout(w, h, d);

      // Boards get a small chamfer; the spine a rounder one; the paper block
      // a tighter radius so its corners read as crisp paper edges.
      const coverRadius = Math.min(w, h, d) * 0.06;
      const spineRadius = Math.min(layout.spine.d, layout.spine.w) * 0.2;
      const paperRadius = Math.min(layout.paper.w, layout.paper.h, layout.paper.d) * 0.025;

      // Front and back boards bow outward on their outer face only, so the
      // cover swells without punching into the page block. Spines are flat.
      const frontGeom = new RoundedBoxGeometry(layout.frontBoard.w, layout.frontBoard.h, layout.frontBoard.d, 3, coverRadius);
      bowCoverGeometry(frontGeom, d * COVER_BOW_FRAC, "front");
      frontGeom.translate(layout.frontBoard.x, layout.frontBoard.y, layout.frontBoard.z);
      const backGeom = new RoundedBoxGeometry(layout.backBoard.w, layout.backBoard.h, layout.backBoard.d, 3, coverRadius);
      bowCoverGeometry(backGeom, d * COVER_BOW_FRAC, "back");
      backGeom.translate(layout.backBoard.x, layout.backBoard.y, layout.backBoard.z);
      const spineGeom = new RoundedBoxGeometry(layout.spine.w, layout.spine.h, layout.spine.d, 3, spineRadius);
      spineGeom.translate(layout.spine.x, layout.spine.y, layout.spine.z);

      shell.geometry.dispose();
      shell.geometry = mergeByMaterial(
        [
          { geometry: frontGeom, faceMaterials: FRONT_FACES },
          { geometry: backGeom, faceMaterials: BACK_FACES },
          { geometry: spineGeom, faceMaterials: SPINE_FACES },
        ],
        SHELL_MATERIALS,
      );
      frontGeom.dispose();
      backGeom.dispose();
      spineGeom.dispose();

      // Page block: faces 0–1 (±X) are the open edge, 2–5 the rest — each
      // run is contiguous in the index, so two groups cover it.
      const paperGeom = new RoundedBoxGeometry(layout.paper.w, layout.paper.h, layout.paper.d, 2, paperRadius);
      const [px, nx] = paperGeom.groups;
      const edgeCount = px.count + nx.count;
      const total = paperGeom.index?.count ?? paperGeom.attributes.position.count;
      paperGeom.clearGroups();
      paperGeom.addGroup(0, edgeCount, 0);
      paperGeom.addGroup(edgeCount, total - edgeCount, 1);
      paper.geometry.dispose();
      paper.geometry = paperGeom;
      paper.position.set(layout.paper.x, layout.paper.y, layout.paper.z);

      // Shadow quad on the ground under the book (the plane is 1×1).
      shadow.scale.set(w + SHADOW_SPREAD * 2, d + SHADOW_SPREAD * 2, 1);
      shadow.position.set(0, -h / 2 + 0.002, 0);

      sizeRef.current = [w, h, d];
    }

    // Optional inner page block (off = hollow shells), with per-axis scale
    // on top of the layout size, so the tweakpane knobs need no rebuild.
    paper.visible = PARAMS.bookPagesEnabled;
    paper.scale.set(PARAMS.bookPagesScaleX, PARAMS.bookPagesScaleY, PARAMS.bookPagesScaleZ);

    // Per-book fade: every material, the shadow, and the depth pre-pass
    // that keeps a fading book solid.
    const op = opacitiesRef?.current?.[index] ?? 1;
    const fading = op < 0.999;
    [shell, paper].forEach((mesh, i) => {
      for (const material of mesh.material as THREE.Material[]) {
        applyOpacity(material, op);
      }
      const prepass = prepassRefs.current[i];
      if (!prepass) return;
      prepass.visible = fading && mesh.visible;
      if (!prepass.visible) return;
      prepass.geometry = mesh.geometry;
      prepass.position.copy(mesh.position);
      prepass.scale.copy(mesh.scale);
    });
    (shadow.material as THREE.MeshBasicMaterial).opacity = PARAMS.shadowOpacity * op;
  });

  // R3F only disposes the placeholder geometries it created; the ones
  // swapped in above are ours. The meshes live as long as this component,
  // so capture them now and dispose whatever geometry each holds at unmount.
  useEffect(() => {
    const meshes = [shellRef.current, paperRef.current];
    return () => {
      for (const mesh of meshes) mesh?.geometry.dispose();
    };
  }, []);

  // Placeholder geometries — useFrame replaces them with the proper
  // bookLayout()-sized ones on the first tick. The pre-pass meshes borrow
  // those geometries (dispose={null}: the book meshes own them).
  return (
    <group>
      <mesh ref={shellRef} material={materials.shell} renderOrder={1}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh ref={paperRef} material={materials.paper} renderOrder={1}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh ref={shadowRef} material={materials.shadow} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      {[0, 1].map((i) => (
        <mesh
          key={i}
          ref={(el: THREE.Mesh | null) => {
            prepassRefs.current[i] = el;
          }}
          material={DEPTH_PREPASS}
          renderOrder={0}
          visible={false}
          dispose={null}
        />
      ))}
    </group>
  );
}
