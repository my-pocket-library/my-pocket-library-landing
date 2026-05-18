"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import { PARAMS } from "@/lib/scene-params";

// One paper-fiber normal map shared across every face of every book.
// Built once on the first call, then reused.
let paperNormalTex: THREE.CanvasTexture | null = null;
function getPaperNormalTexture(): THREE.CanvasTexture {
  if (paperNormalTex) return paperNormalTex;
  if (typeof document === "undefined") {
    // Server side: return a dummy that will be replaced on the client.
    return (paperNormalTex = new THREE.CanvasTexture(
      // tiny placeholder canvas; will be overwritten on client mount
      typeof OffscreenCanvas !== "undefined"
        ? (new OffscreenCanvas(2, 2) as unknown as HTMLCanvasElement)
        : ({ width: 2, height: 2 } as unknown as HTMLCanvasElement),
    ));
  }
  const SIZE = 512;
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext("2d");
  if (!ctx) return (paperNormalTex = new THREE.CanvasTexture(c));
  const img = ctx.createImageData(SIZE, SIZE);
  // Each pixel encodes a perturbed surface normal. RGB = (x, y, z) mapped from
  // [-1,1] -> [0,255]. Default "flat" pixel = (128, 128, 255).
  for (let i = 0; i < img.data.length; i += 4) {
    // Two-octave noise: coarse undulation + finer fiber.
    const nx = (Math.random() - 0.5) * 0.45 + (Math.random() - 0.5) * 0.15;
    const ny = (Math.random() - 0.5) * 0.45 + (Math.random() - 0.5) * 0.15;
    img.data[i] = Math.floor((nx * 0.5 + 0.5) * 255);
    img.data[i + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
    img.data[i + 2] = 255;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = 4;
  paperNormalTex = tex;
  return tex;
}

export type BookCover = {
  title: string;
  author?: string;
  baseColor: string;
  accent: string;
  ink: string;
  pattern: "ornate" | "swirl" | "plain" | "stripe" | "emblem" | "stars";
};

type BookProps = {
  cover: BookCover;
  /** Stable book index — drives per-book wear, ribbon, and color variation. */
  index?: number;
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

// ---------------------------------------------------------------------------
// Heightmap → normal map conversion (Sobel + fiber noise)
//
// Reads luminance from `src` (red channel — we paint grayscale into it), emits
// a normal map encoding partial derivatives of the height field. A small
// amount of high-freq noise is mixed into the tangent components so the cover
// also reads as paper fiber, not just embossed artwork.
// ---------------------------------------------------------------------------
function heightToNormalCanvas(
  src: HTMLCanvasElement,
  strength = 2.5,
  fiberAmount = 0.18,
): HTMLCanvasElement {
  const W = src.width;
  const H = src.height;
  const srcCtx = src.getContext("2d");
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const outCtx = out.getContext("2d");
  if (!srcCtx || !outCtx) return out;
  const heightData = srcCtx.getImageData(0, 0, W, H).data;
  const outImg = outCtx.createImageData(W, H);

  const at = (x: number, y: number) => {
    const xx = x < 0 ? 0 : x >= W ? W - 1 : x;
    const yy = y < 0 ? 0 : y >= H ? H - 1 : y;
    return heightData[(yy * W + xx) * 4] / 255;
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx + (Math.random() - 0.5) * fiberAmount;
      let ny = -dy + (Math.random() - 0.5) * fiberAmount;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * W + x) * 4;
      outImg.data[i] = Math.floor((nx * 0.5 + 0.5) * 255);
      outImg.data[i + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
      outImg.data[i + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
      outImg.data[i + 3] = 255;
    }
  }

  outCtx.putImageData(outImg, 0, 0);
  return out;
}

// Paints the *embossable* layer of the cover (pattern + title + author) onto a
// grayscale canvas where lighter pixels = raised ink. Background is black so
// the unprinted card stock sits at zero relief.
function paintCoverHeight(canvas: HTMLCanvasElement, cover: BookCover) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  // Patterns — drawn in mid-gray so they get a subtle deboss.
  ctx.save();
  ctx.strokeStyle = "rgb(140, 140, 140)";
  ctx.fillStyle = "rgb(140, 140, 140)";
  const SX = W / 512;
  const SY = H / 768;
  if (cover.pattern === "ornate") {
    ctx.lineWidth = 6 * SX;
    ctx.strokeRect(36 * SX, 36 * SY, W - 72 * SX, H - 72 * SY);
    ctx.lineWidth = 2 * SX;
    ctx.strokeRect(56 * SX, 56 * SY, W - 112 * SX, H - 112 * SY);
    for (const [cx, cy] of [
      [80 * SX, 80 * SY],
      [W - 80 * SX, 80 * SY],
      [80 * SX, H - 80 * SY],
      [W - 80 * SX, H - 80 * SY],
    ]) {
      ctx.beginPath();
      ctx.arc(cx, cy, 18 * SX, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (cover.pattern === "swirl") {
    ctx.lineWidth = 3 * SX;
    for (let r = 40 * SX; r < W; r += 60 * SX) {
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.6, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (cover.pattern === "stripe") {
    for (let y = 0; y < H; y += 32 * SY) {
      ctx.fillRect(0, y, W, 12 * SY);
    }
  } else if (cover.pattern === "emblem") {
    ctx.lineWidth = 4 * SX;
    const cx = W / 2;
    const cy = H * 0.55;
    ctx.beginPath();
    ctx.ellipse(cx, cy, W * 0.28, H * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, W * 0.22, H * 0.14, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (cover.pattern === "stars") {
    for (let i = 0; i < 24; i++) {
      const x = (i * 137.5 * SX) % W;
      const y = (i * 211.3 * SY) % H;
      ctx.beginPath();
      ctx.arc(x, y, (3 + (i % 4)) * SX, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.lineWidth = 4 * SX;
    ctx.strokeRect(48 * SX, 48 * SY, W - 96 * SX, H - 96 * SY);
  }
  ctx.restore();

  // Title — fully white (max emboss height).
  ctx.fillStyle = "#fff";
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
  const fontSize =
    Math.min(72, 520 / Math.max(...lines.map((l) => l.length))) * SX;
  ctx.font = `700 ${fontSize}px "Times New Roman", serif`;
  const totalH = lines.length * fontSize * 1.05;
  const startY = H * 0.42 - totalH / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, startY + i * fontSize * 1.05);
  });

  // Author — half-gray (subtle relief).
  if (cover.author) {
    ctx.fillStyle = "rgb(160, 160, 160)";
    ctx.font = `italic ${28 * SX}px "Times New Roman", serif`;
    ctx.fillText(cover.author, W / 2, H * 0.82);
  }
}

// Spine heightfield — vertical title plus the two horizontal bands.
function paintSpineHeight(canvas: HTMLCanvasElement, cover: BookCover) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  // Bands (slight deboss).
  ctx.fillStyle = "rgb(150,150,150)";
  ctx.fillRect(0, H * 0.1, W, 6 * (W / 128));
  ctx.fillRect(0, H * 0.9 - 6 * (W / 128), W, 6 * (W / 128));

  // Vertical title at full white.
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fontSize = Math.min(34, 400 / cover.title.length) * (W / 128);
  ctx.font = `600 ${fontSize}px "Times New Roman", serif`;
  ctx.fillText(cover.title.toUpperCase(), 0, 0);
  ctx.restore();
}

function paintCover(
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

// Paper-block geometry constants — fractions of the book's outer dimensions.
const OPEN_PROTRUDE_FRAC = 0.018; // paper sticks out past cover at open edge
const TB_PROTRUDE_FRAC = 0.012; // …and at top + bottom
const SPINE_RECESS_FRAC = 0.005; // paper sits slightly inside the spine
const PAPER_DEPTH_FRAC = 0.84; // paper is thinner than the total book depth
const COVER_BOW_FRAC = 0.06; // front/back cover swells outward in the center

// Compute the inner paper block's dimensions and centered position relative
// to the outer cover, given the outer (w, h, d).
function paperLayout(w: number, h: number, d: number) {
  const openProtrude = w * OPEN_PROTRUDE_FRAC;
  const spineRecess = w * SPINE_RECESS_FRAC;
  const tbProtrude = h * TB_PROTRUDE_FRAC;
  const paperW = w - spineRecess + openProtrude;
  const paperH = h + 2 * tbProtrude;
  const paperD = d * PAPER_DEPTH_FRAC;
  // Shift the paper toward +X so its spine-side edge is at -w/2 + spineRecess.
  const offsetX = (openProtrude + spineRecess) / 2;
  return { paperW, paperH, paperD, offsetX };
}

// Push +Z and -Z face vertices outward in the +Z / -Z direction so each cover
// reads as a soft pillow. Falloff is (1-u²)(1-v²) so the bow vanishes at the
// edges. Identification is via the original face normals on the rounded box,
// which is robust regardless of dimensions.
function bowCoverGeometry(geom: THREE.BufferGeometry, bowAmount: number) {
  const positions = geom.attributes.position as THREE.BufferAttribute;
  const normals = geom.attributes.normal as THREE.BufferAttribute;
  const box = new THREE.Box3().setFromBufferAttribute(positions);
  const halfW = (box.max.x - box.min.x) / 2;
  const halfH = (box.max.y - box.min.y) / 2;
  if (halfW <= 0 || halfH <= 0) return;
  for (let i = 0; i < positions.count; i++) {
    const nz = normals.getZ(i);
    if (Math.abs(nz) > 0.85) {
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

export function Book({ cover, index = 0 }: BookProps) {
  const coverMeshRef = useRef<THREE.Mesh>(null);
  const paperMeshRef = useRef<THREE.Mesh>(null);
  const ribbonRef = useRef<THREE.Mesh>(null);
  const sizeRef = useRef<[number, number, number]>([0, 0, 0]);

  const wear = useMemo(() => getWearAmount(index), [index]);
  const showRibbon = useMemo(() => hasBookmarkRibbon(index), [index]);
  const ribbonColor = useMemo(() => getRibbonColor(index), [index]);

  const { coverTex, spineTex, pagesTex, coverNormalTex, spineNormalTex } =
    useMemo(() => {
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
      // Color textures — sRGB encoded.
      const coverTex = make(512, 768, (c) => paintCover(c, cover, wear), {
        srgb: true,
      });
      const spineTex = make(128, 768, (c) => paintSpine(c, cover, wear), {
        srgb: true,
      });
      const pagesTex = make(512, 512, paintPages, { srgb: true });

      // Build per-book normal maps from a transient grayscale heightmap of
      // just the embossable artwork (pattern + title). Then convert via
      // Sobel + add fiber noise. Normal maps stay in linear color space.
      const coverH = document.createElement("canvas");
      coverH.width = 256;
      coverH.height = 384;
      paintCoverHeight(coverH, cover);
      const coverNormalCanvas = heightToNormalCanvas(coverH, 2.6, 0.22);
      const coverNormalTex = new THREE.CanvasTexture(coverNormalCanvas);
      coverNormalTex.colorSpace = THREE.NoColorSpace;
      coverNormalTex.anisotropy = 4;

      const spineH = document.createElement("canvas");
      spineH.width = 64;
      spineH.height = 384;
      paintSpineHeight(spineH, cover);
      const spineNormalCanvas = heightToNormalCanvas(spineH, 2.0, 0.18);
      const spineNormalTex = new THREE.CanvasTexture(spineNormalCanvas);
      spineNormalTex.colorSpace = THREE.NoColorSpace;
      spineNormalTex.anisotropy = 4;

      return {
        coverTex,
        spineTex,
        pagesTex,
        coverNormalTex,
        spineNormalTex,
      };
    }, [cover, wear]);

  const gradientMapRef = useRef<THREE.DataTexture | null>(null);
  const bandsRef = useRef<number>(0);

  // Build a gradient ramp texture used by MeshToonMaterial for the banded look.
  // Lazily (re)built when the desired band count changes.
  const ensureGradient = (bands: number) => {
    if (bandsRef.current === bands && gradientMapRef.current) {
      return gradientMapRef.current;
    }
    gradientMapRef.current?.dispose();
    const data = new Uint8Array(bands);
    for (let i = 0; i < bands; i++) {
      data[i] = Math.floor(((i + 1) / bands) * 255);
    }
    const tex = new THREE.DataTexture(data, bands, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    gradientMapRef.current = tex;
    bandsRef.current = bands;
    return tex;
  };

  // Shared paper-fiber normal map for the matte page faces, inner edges,
  // and (in toon mode) anywhere we want surface relief without artwork emboss.
  const paperNormal = useMemo(() => getPaperNormalTexture(), []);

  // Materials per face order: +X, -X, +Y, -Y, +Z, -Z
  // +X right (open edge — hidden behind paper), -X left (spine),
  // +Y top (hidden behind paper), -Y bottom (hidden behind paper),
  // +Z front (cover art), -Z back (cover dark)
  //
  // All cover faces are now MeshStandardMaterial (no clearcoat) — matches
  // the matte ink-paper look and saves shader work on mobile.
  const standardMaterials = useMemo(() => {
    // Paper — high roughness, light fiber normal relief.
    const pages = new THREE.MeshStandardMaterial({
      map: pagesTex,
      roughness: 0.95,
      normalMap: paperNormal,
      normalScale: new THREE.Vector2(0.15, 0.15),
    });
    // Spine — uses the per-book spine normal map (vertical title emboss +
    // hinge creases bake in via the heightfield + fiber noise).
    const spine = new THREE.MeshStandardMaterial({
      map: spineTex,
      roughness: 0.75,
      normalMap: spineNormalTex,
      normalScale: new THREE.Vector2(0.4, 0.4),
    });
    // Front cover — emboss normal makes the title and pattern read as raised.
    const front = new THREE.MeshStandardMaterial({
      map: coverTex,
      roughness: 0.78,
      normalMap: coverNormalTex,
      normalScale: new THREE.Vector2(0.55, 0.55),
    });
    const back = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cover.baseColor).multiplyScalar(0.42),
      roughness: 0.85,
      normalMap: paperNormal,
      normalScale: new THREE.Vector2(0.22, 0.22),
    });
    // Inside lip of the cover where the paper meets — mostly occluded; we
    // keep it neutral so any peek-through reads as binding lining.
    const innerEdge = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cover.baseColor).multiplyScalar(0.38),
      roughness: 0.9,
    });
    return {
      cover: [innerEdge, spine, innerEdge, innerEdge, front, back],
      paper: pages,
    };
  }, [
    coverTex,
    spineTex,
    pagesTex,
    coverNormalTex,
    spineNormalTex,
    paperNormal,
    cover.baseColor,
  ]);

  const toonMaterials = useMemo(() => {
    const gradientMap = ensureGradient(PARAMS.toonBands);
    const pages = new THREE.MeshToonMaterial({
      map: pagesTex,
      gradientMap,
      normalMap: paperNormal,
      normalScale: new THREE.Vector2(0.2, 0.2),
    });
    const spine = new THREE.MeshToonMaterial({
      map: spineTex,
      gradientMap,
      normalMap: spineNormalTex,
      normalScale: new THREE.Vector2(0.4, 0.4),
    });
    const front = new THREE.MeshToonMaterial({
      map: coverTex,
      gradientMap,
      normalMap: coverNormalTex,
      normalScale: new THREE.Vector2(0.5, 0.5),
    });
    const back = new THREE.MeshToonMaterial({
      color: new THREE.Color(cover.baseColor).multiplyScalar(0.55),
      gradientMap,
      normalMap: paperNormal,
      normalScale: new THREE.Vector2(0.2, 0.2),
    });
    const innerEdge = new THREE.MeshToonMaterial({
      color: new THREE.Color(cover.baseColor).multiplyScalar(0.5),
      gradientMap,
    });
    return {
      cover: [innerEdge, spine, innerEdge, innerEdge, front, back],
      paper: pages,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    coverTex,
    spineTex,
    pagesTex,
    coverNormalTex,
    spineNormalTex,
    paperNormal,
    cover.baseColor,
  ]);

  // Imperatively swap geometry size + active material set each frame so
  // tweakpane edits don't require React re-renders (which caused flickering).
  useFrame(() => {
    const coverMesh = coverMeshRef.current;
    const paperMesh = paperMeshRef.current;
    if (!coverMesh || !paperMesh) return;

    const [lw, lh, ld] = sizeRef.current;
    if (
      lw !== PARAMS.bookWidth ||
      lh !== PARAMS.bookHeight ||
      ld !== PARAMS.bookDepth
    ) {
      const w = PARAMS.bookWidth;
      const h = PARAMS.bookHeight;
      const d = PARAMS.bookDepth;
      const minDim = Math.min(w, h, d);
      const radius = minDim * 0.08;

      // Outer cover — RoundedBox + a soft pillow-bow on the front and back faces.
      coverMesh.geometry.dispose();
      const coverGeom = new RoundedBoxGeometry(w, h, d, 4, radius);
      bowCoverGeometry(coverGeom, d * COVER_BOW_FRAC);
      coverMesh.geometry = coverGeom;

      // Inner paper block — sticks out past the cover at top/bottom/open edge,
      // hidden inside the cover on the spine and depth axes.
      paperMesh.geometry.dispose();
      const layout = paperLayout(w, h, d);
      const paperRadius = Math.min(layout.paperD, layout.paperH) * 0.04;
      paperMesh.geometry = new RoundedBoxGeometry(
        layout.paperW,
        layout.paperH,
        layout.paperD,
        2,
        paperRadius,
      );
      paperMesh.position.set(layout.offsetX, 0, 0);

      // Reposition the ribbon (if this book has one) to hang from inside the
      // paper block and stick out a small overhang below the bottom edge.
      const ribbon = ribbonRef.current;
      if (ribbon) {
        const ribbonW = layout.paperW * 0.07;
        const overhang = layout.paperH * 0.07;
        // Half hidden inside the paper, half hanging below.
        const insideLen = layout.paperH * 0.4;
        const totalLen = insideLen + overhang;
        ribbon.scale.set(ribbonW, totalLen, 1);
        // Center y: half of (insideLen − overhang) below the paper bottom edge.
        const centerY = -layout.paperH / 2 + (insideLen - overhang) / 2;
        // Offset toward the spine + sit slightly forward of the back cover so
        // the ribbon "tucks into" the binding.
        const ribbonX = layout.offsetX - layout.paperW * 0.32;
        const ribbonZ = layout.paperD * 0.18;
        ribbon.position.set(ribbonX, centerY, ribbonZ);
        ribbon.rotation.z = Math.sin(index * 1.7) * 0.05; // tiny natural tilt
      }

      sizeRef.current = [w, h, d];
    }

    // Refresh the toon gradient ramp if band count was tweaked.
    if (PARAMS.toonShading && bandsRef.current !== PARAMS.toonBands) {
      const ramp = ensureGradient(PARAMS.toonBands);
      for (const mat of toonMaterials.cover) {
        (mat as THREE.MeshToonMaterial).gradientMap = ramp;
        (mat as THREE.MeshToonMaterial).needsUpdate = true;
      }
      (toonMaterials.paper as THREE.MeshToonMaterial).gradientMap = ramp;
      (toonMaterials.paper as THREE.MeshToonMaterial).needsUpdate = true;
    }

    const desired = PARAMS.toonShading ? toonMaterials : standardMaterials;
    if (coverMesh.material !== desired.cover) {
      coverMesh.material = desired.cover;
    }
    if (paperMesh.material !== desired.paper) {
      paperMesh.material = desired.paper;
    }
  });

  useEffect(() => {
    return () => {
      coverMeshRef.current?.geometry.dispose();
      paperMeshRef.current?.geometry.dispose();
      gradientMapRef.current?.dispose();
    };
  }, []);

  return (
    <group>
      <mesh
        ref={coverMeshRef}
        castShadow
        receiveShadow
        material={standardMaterials.cover}
      >
        <boxGeometry
          args={[PARAMS.bookWidth, PARAMS.bookHeight, PARAMS.bookDepth]}
        />
      </mesh>
      <mesh
        ref={paperMeshRef}
        castShadow
        receiveShadow
        material={standardMaterials.paper}
      >
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
