"use client";

import { type RefObject, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import { PARAMS } from "@/lib/scene-params";

export type BookCover = {
  title: string;
  author?: string;
  baseColor: string;
  accent: string;
  ink: string;
  pattern: "ornate" | "swirl" | "plain" | "stripe" | "emblem" | "stars";
  /** Optional URL to a real cover image. When set, the procedural cover
   *  is still painted first (acts as a synchronous fallback while the
   *  image loads), and the image is then drawn on top, asynchronously,
   *  with `texture.needsUpdate = true` to refresh the GPU upload. */
  image?: string;
};

export type BookProps = {
  cover: BookCover;
  /** Stable book index — drives per-book wear, ribbon, and color variation. */
  index?: number;
  /** Per-book opacity in [0, 1], written by the parent scene each frame.
   *  Used to fade books in/out as they rotate through the carousel so only
   *  the front N are visible. Read inside this component's useFrame so the
   *  fade stays in lockstep with position updates (no React-state lag). */
  opacityRef?: RefObject<number>;
};

// ---------------------------------------------------------------------------
// Per-book deterministic helpers
// ---------------------------------------------------------------------------

// Wear in [0.35, 1.0]. Stable per index.
function getWearAmount(i: number): number {
  return 0.35 + (Math.sin(i * 1.7) * 0.5 + 0.5) * 0.65;
}

// Whether this book gets a bookmark ribbon. ~half of books.
function hasBookmarkRibbon(i: number): boolean {
  return ((i * 7 + 3) % 11) % 2 === 0;
}

// Ribbon colors — picked deterministically per index from a small palette.
const RIBBON_PALETTE = ["#8b1d1d", "#1a3a6e", "#3a5e1a", "#724a16", "#3a1a3a"];
function getRibbonColor(i: number): string {
  return RIBBON_PALETTE[i % RIBBON_PALETTE.length];
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

function paintSpine(
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

  // edge shadow
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.5, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // band
  ctx.fillStyle = cover.accent;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(0, H * 0.1, W, 6);
  ctx.fillRect(0, H * 0.9 - 6, W, 6);
  ctx.globalAlpha = 1;

  // Hinge creases — two faint vertical dark lines a small inset from each
  // edge, simulating the joint where the cover folds around the binding.
  const hingeInset = Math.max(2, W * 0.08);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.32)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hingeInset, 0);
  ctx.lineTo(hingeInset, H);
  ctx.moveTo(W - hingeInset, 0);
  ctx.lineTo(W - hingeInset, H);
  ctx.stroke();
  // A second, fainter line just inside each crease, like a printed accent line.
  ctx.strokeStyle = "rgba(0, 0, 0, 0.14)";
  ctx.beginPath();
  ctx.moveTo(hingeInset + 2, 0);
  ctx.lineTo(hingeInset + 2, H);
  ctx.moveTo(W - hingeInset - 2, 0);
  ctx.lineTo(W - hingeInset - 2, H);
  ctx.stroke();

  // vertical title
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = cover.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${Math.min(34, 400 / cover.title.length)}px "Times New Roman", serif`;
  ctx.fillText(cover.title.toUpperCase(), 0, 0);
  ctx.restore();

  // Wear — sparse vertical scratches on the spine for battered books.
  const scratchCount = Math.floor(8 * wear);
  for (let i = 0; i < scratchCount; i++) {
    const x = Math.random() * W;
    const y0 = Math.random() * H * 0.85;
    const len = 20 + Math.random() * 80;
    ctx.strokeStyle = `rgba(0, 0, 0, ${0.08 + Math.random() * 0.12})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x + (Math.random() - 0.5) * 2, y0 + len);
    ctx.stroke();
  }
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

export function Book({ cover, index = 0, opacityRef }: BookProps) {
  // The hardcover model uses four separate meshes — front board, back board,
  // spine, and paper block — instead of the old single-cover + single-paper
  // setup. This is what lets the page block sit visibly recessed inside the
  // cover (the boards' top/bottom/open-edge faces don't exist as cover panels,
  // so the air around the smaller paper block is genuinely visible).
  const frontBoardRef = useRef<THREE.Mesh>(null);
  const backBoardRef = useRef<THREE.Mesh>(null);
  const spineRef = useRef<THREE.Mesh>(null);
  const paperMeshRef = useRef<THREE.Mesh>(null);
  const ribbonRef = useRef<THREE.Mesh>(null);
  const sizeRef = useRef<[number, number, number]>([0, 0, 0]);

  const wear = useMemo(() => getWearAmount(index), [index]);
  const showRibbon = useMemo(() => hasBookmarkRibbon(index), [index]);
  const ribbonColor = useMemo(() => getRibbonColor(index), [index]);

  const { coverTex, spineTex, pagesTex, pagesEdgeTex } = useMemo(() => {
      const make = (
        width: number,
        height: number,
        paint: (c: HTMLCanvasElement) => void,
        opts?: { srgb?: boolean },
      ) => {
        const c = document.createElement("canvas");
        c.width = width;
        c.height = height;
        paint(c);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = opts?.srgb
          ? THREE.SRGBColorSpace
          : THREE.NoColorSpace;
        tex.anisotropy = 8;
        return tex;
      };
      // Cover texture — paint the procedural artwork synchronously as a
      // fallback, then (if this book has a real cover image) load that
      // image and draw it on top once it's ready. `texture.needsUpdate`
      // triggers a re-upload to the GPU. We can't use the `make` helper
      // here because we need a handle to the canvas to overlay onto it.
      const coverCanvas = document.createElement("canvas");
      coverCanvas.width = 512;
      coverCanvas.height = 768;
      paintCover(coverCanvas, cover, wear);
      const coverTex = new THREE.CanvasTexture(coverCanvas);
      coverTex.colorSpace = THREE.SRGBColorSpace;
      coverTex.anisotropy = 8;

      if (cover.image && typeof window !== "undefined") {
        const img = new window.Image();
        img.src = cover.image;
        img.onload = () => {
          const ctx = coverCanvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, coverCanvas.width, coverCanvas.height);
          coverTex.needsUpdate = true;
        };
      }

      const spineTex = make(128, 768, (c) => paintSpine(c, cover, wear), {
        srgb: true,
      });
      // Pages texture — horizontal stripes representing dense page edges.
      // We paint ONCE and create TWO textures over the same canvas: the
      // upright one for the top/bottom faces (where horizontal stripes read
      // as page edges running spine→open-edge), and a rotated copy for the
      // open-edge face (where stripes need to appear VERTICAL because each
      // page is a vertical sheet, so its visible edge is vertical too).
      const pagesCanvas = document.createElement("canvas");
      pagesCanvas.width = 512;
      pagesCanvas.height = 512;
      paintPages(pagesCanvas);

      const pagesTex = new THREE.CanvasTexture(pagesCanvas);
      pagesTex.colorSpace = THREE.SRGBColorSpace;
      pagesTex.anisotropy = 8;

      const pagesEdgeTex = new THREE.CanvasTexture(pagesCanvas);
      pagesEdgeTex.colorSpace = THREE.SRGBColorSpace;
      pagesEdgeTex.anisotropy = 8;
      pagesEdgeTex.center.set(0.5, 0.5);
      pagesEdgeTex.rotation = Math.PI / 2;

      return { coverTex, spineTex, pagesTex, pagesEdgeTex };
    }, [cover, wear]);

  // Materials per face order: +X, -X, +Y, -Y, +Z, -Z.
  //
  // The cover is now THREE separate pieces (front board, back board, spine),
  // each with its own material array. Each piece's *outer* face carries the
  // cover artwork; everything else is either coverEdge (the visible thin
  // strips along the board's edges where the binding cloth wraps around)
  // or innerEdge (interior faces that face the page block and are mostly
  // occluded — kept dark so any peek-through reads as binding lining).
  //
  //   frontBoard at +Z:  +Z = cover art,        -Z = innerEdge (faces paper)
  //   backBoard  at -Z:  -Z = back cover,       +Z = innerEdge (faces paper)
  //   spine      at -X:  -X = spine artwork,    +X = innerEdge (faces paper)
  //                      ±Z = innerEdge (seam where spine meets boards)
  //
  // All board side-strips (+X / ±Y) and the spine's ±Y use coverEdge.
  const standardMaterials = useMemo(() => {
    // All materials are flat colour/texture only — no normal maps. Books
    // render as plain printed objects, not embossed ones.
    const pages = new THREE.MeshStandardMaterial({
      map: pagesTex,
      roughness: 0.95,
    });
    // Same paper material but using the rotated texture, for the open-edge
    // face where page lines need to run vertically.
    const pagesEdge = new THREE.MeshStandardMaterial({
      map: pagesEdgeTex,
      roughness: 0.95,
    });
    const spineMat = new THREE.MeshStandardMaterial({
      map: spineTex,
      roughness: 0.75,
    });
    const front = new THREE.MeshStandardMaterial({
      map: coverTex,
      roughness: 0.78,
    });
    const back = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cover.baseColor).multiplyScalar(0.42),
      roughness: 0.85,
    });
    // Cover edge — the binding cloth/paper wrapping around the thin sides of
    // the boards. Slightly darker than the cover face so it reads as a fold.
    const coverEdge = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cover.baseColor).multiplyScalar(0.75),
      roughness: 0.85,
    });
    // Inner faces — heavily darkened so the recess between cover and pages
    // reads as ambient-occluded shadow even without runtime shadow rendering.
    const innerEdge = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cover.baseColor).multiplyScalar(0.30),
      roughness: 0.95,
    });

    // Face order: +X, -X, +Y, -Y, +Z, -Z
    return {
      // Front board: +Z is the cover. -Z faces the paper block (innerEdge).
      // Sides are all visible thin strips of binding (coverEdge).
      frontBoard: [coverEdge, coverEdge, coverEdge, coverEdge, front, innerEdge],
      // Back board: -Z is the back cover, +Z faces the paper block.
      backBoard:  [coverEdge, coverEdge, coverEdge, coverEdge, innerEdge, back],
      // Spine: -X is the spine artwork, +X faces the paper block. ±Z meet
      // the boards' inner faces in a seam (innerEdge — same colour, no
      // visible z-fighting). ±Y are the visible top/bottom of the spine.
      spine:      [innerEdge, spineMat, coverEdge, coverEdge, innerEdge, innerEdge],
      // Paper — multi-material so the open-edge face gets the rotated
      // texture (vertical page lines), while top/bottom faces use the
      // upright texture (horizontal page lines parallel to the spine).
      // Face order: +X, -X, +Y, -Y, +Z, -Z.
      paper: [pagesEdge, pagesEdge, pages, pages, pages, pages],
    };
  }, [
    coverTex,
    spineTex,
    pagesTex,
    pagesEdgeTex,
    cover.baseColor,
  ]);

  // Imperatively swap geometry size each frame so tweakpane edits to
  // bookWidth/Height/Depth don't require React re-renders (which caused
  // flickering on the carousel).
  useFrame(() => {
    const frontBoard = frontBoardRef.current;
    const backBoard = backBoardRef.current;
    const spineMesh = spineRef.current;
    const paperMesh = paperMeshRef.current;
    if (!frontBoard || !backBoard || !spineMesh || !paperMesh) return;

    const [lw, lh, ld] = sizeRef.current;
    if (
      lw !== PARAMS.bookWidth ||
      lh !== PARAMS.bookHeight ||
      ld !== PARAMS.bookDepth
    ) {
      const w = PARAMS.bookWidth;
      const h = PARAMS.bookHeight;
      const d = PARAMS.bookDepth;
      const layout = bookLayout(w, h, d);

      // Corner radii: the cover boards get a small chamfer matching the old
      // cover's rounding; the paper block gets a *smaller* radius so its
      // corners read as crisp paper edges rather than soft cover-board curves
      // (one of the user-requested differences from cover geometry).
      const coverRadius = Math.min(w, h, d) * 0.06;
      const paperRadius =
        Math.min(layout.paper.w, layout.paper.h, layout.paper.d) * 0.025;
      const spineRadius = Math.min(layout.spine.d, layout.spine.w) * 0.20;

      // Front board: thin rounded slab on +Z. Bow only its outer (+Z) face
      // so the front cover swells outward without punching the inner face
      // back into the recessed page block.
      frontBoard.geometry.dispose();
      const frontGeom = new RoundedBoxGeometry(
        layout.frontBoard.w,
        layout.frontBoard.h,
        layout.frontBoard.d,
        3,
        coverRadius,
      );
      bowCoverGeometry(frontGeom, d * COVER_BOW_FRAC, "front");
      frontBoard.geometry = frontGeom;
      frontBoard.position.set(
        layout.frontBoard.x,
        layout.frontBoard.y,
        layout.frontBoard.z,
      );

      // Back board: mirror of the front. Bow its outer (-Z) face only.
      backBoard.geometry.dispose();
      const backGeom = new RoundedBoxGeometry(
        layout.backBoard.w,
        layout.backBoard.h,
        layout.backBoard.d,
        3,
        coverRadius,
      );
      bowCoverGeometry(backGeom, d * COVER_BOW_FRAC, "back");
      backBoard.geometry = backGeom;
      backBoard.position.set(
        layout.backBoard.x,
        layout.backBoard.y,
        layout.backBoard.z,
      );

      // Spine: thin slab on -X, occupying the binding edge between the two
      // boards' inner faces. No bow — real spines are flat or sewn-flat.
      spineMesh.geometry.dispose();
      spineMesh.geometry = new RoundedBoxGeometry(
        layout.spine.w,
        layout.spine.h,
        layout.spine.d,
        3,
        spineRadius,
      );
      spineMesh.position.set(layout.spine.x, layout.spine.y, layout.spine.z);

      // Paper block: smaller than the cover on every axis, recessed inside
      // the assembly. Tighter corner radius so it reads as a stack of paper
      // sheets, not a cover board.
      paperMesh.geometry.dispose();
      paperMesh.geometry = new RoundedBoxGeometry(
        layout.paper.w,
        layout.paper.h,
        layout.paper.d,
        2,
        paperRadius,
      );
      paperMesh.position.set(layout.paper.x, layout.paper.y, layout.paper.z);

      // Reposition the ribbon (if this book has one) to hang from inside the
      // paper block and stick out below the bottom edge.
      const ribbon = ribbonRef.current;
      if (ribbon) {
        const ribbonW = layout.paper.w * 0.07;
        const overhang = layout.paper.h * 0.07;
        // Half hidden inside the paper, half hanging below.
        const insideLen = layout.paper.h * 0.4;
        const totalLen = insideLen + overhang;
        ribbon.scale.set(ribbonW, totalLen, 1);
        // Center y: half of (insideLen − overhang) below the paper bottom edge.
        const centerY = -layout.paper.h / 2 + (insideLen - overhang) / 2;
        // Tuck toward the spine + sit slightly forward of the back cover so
        // the ribbon visibly emerges from the binding.
        const ribbonX = layout.paper.x - layout.paper.w * 0.32;
        const ribbonZ = layout.paper.d * 0.18;
        ribbon.position.set(ribbonX, centerY, ribbonZ);
        ribbon.rotation.z = Math.sin(index * 1.7) * 0.05; // tiny natural tilt
      }

      sizeRef.current = [w, h, d];
    }

    // Materials are now always the PBR (MeshStandardMaterial) set — toon
    // shading was removed. The mesh `material` prop in the JSX below
    // already points at standardMaterials.*, so nothing to swap per frame.

    // Visibility toggle for the inner paper block. Skipping the mesh
    // entirely (instead of just hiding via opacity) means zero draw calls
    // when the user wants books to read as hollow shells.
    paperMesh.visible = PARAMS.bookPagesEnabled;

    // Per-axis scale multipliers on top of the layout-derived paper size,
    // applied via mesh.scale so we don't have to rebuild the geometry
    // whenever the user drags the knob.
    paperMesh.scale.set(
      PARAMS.bookPagesScaleX,
      PARAMS.bookPagesScaleY,
      PARAMS.bookPagesScaleZ,
    );

    // Apply per-book fade opacity to every material across all four meshes.
    const op = opacityRef?.current ?? 1;
    const wantTransparent = op < 0.999;
    const applyOpacity = (mat: THREE.Material) => {
      const m = mat as THREE.Material & { opacity: number };
      if (m.transparent !== wantTransparent) {
        m.transparent = wantTransparent;
        m.needsUpdate = true;
      }
      m.opacity = op;
    };
    for (const mat of standardMaterials.frontBoard) applyOpacity(mat);
    for (const mat of standardMaterials.backBoard) applyOpacity(mat);
    for (const mat of standardMaterials.spine) applyOpacity(mat);
    for (const mat of standardMaterials.paper) applyOpacity(mat);
    const ribbon = ribbonRef.current;
    if (ribbon) applyOpacity(ribbon.material as THREE.Material);
  });

  useEffect(() => {
    return () => {
      frontBoardRef.current?.geometry.dispose();
      backBoardRef.current?.geometry.dispose();
      spineRef.current?.geometry.dispose();
      paperMeshRef.current?.geometry.dispose();
    };
  }, []);

  // Initial placeholder geometries — useFrame replaces them with the proper
  // bookLayout()-sized RoundedBoxGeometries on first tick.
  return (
    <group>
      <mesh ref={frontBoardRef} material={standardMaterials.frontBoard}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh ref={backBoardRef} material={standardMaterials.backBoard}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh ref={spineRef} material={standardMaterials.spine}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh ref={paperMeshRef} material={standardMaterials.paper}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      {showRibbon ? (
        <mesh ref={ribbonRef}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial
            color={ribbonColor}
            roughness={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
    </group>
  );
}
