"use client";

import { useFrame } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { LineMaterial, LineSegments2, LineSegmentsGeometry } from "three-stdlib";
import { type BookCover, loadCoverImage } from "./book";
import { requestFrame } from "@/lib/scene-frame";
import {
  AIMING,
  type PillState,
  RISE_AT,
  abbreviatedIsbn,
  ean13Modules,
  screenAt,
} from "@/lib/scan-ceremony";

/**
 * The phone's screen: the app's ISBN scan page and approval sheet, drawn as
 * layered planes in the RenderTexture scene. Textures are painted once (per
 * book where they differ); the ceremony only moves and fades planes, so
 * nothing is re-uploaded per frame. Layout follows the app's SwiftUI views
 * (ISBNScanPage, ScanStatusPill, BookApprovalSheet), in points on a 390×844
 * iPhone screen, scaled to the render target.
 */

/** What the scene tells the screen each frame (written by Books). */
export type ScanShared = {
  /** "timeline": playing the ceremony at `t`. "aiming": the visitor is
   *  spinning the shelf, so the camera is up and nothing has been read. */
  mode: "timeline" | "aiming";
  /** Seconds into the current ceremony cycle (see scan-ceremony.ts). */
  t: number;
  /** COVERS index of the book being scanned. */
  book: number;
  /** The book whose sheet slides away at the start of a cycle. */
  previousBook: number;
  /** The book in front of the camera (in aiming mode, the one nearest the
   *  front as the shelf turns). */
  feedBook: number;
};

/** Where the phone model's Dynamic Island sits on the screen: its centre as
 *  a fraction of the screen height, its width as a fraction of the width. */
export type IslandPlacement = { centerY: number; width: number };

// The app's palette (PLTheme / PLPalette, light mode).
const PAPER = "#f6f5f1";
const INK = "#131211";
const MUTED = "#73706a";
const SURFACE = "#ffffff";
const HAIRLINE = "rgba(0, 0, 0, 0.08)";
const GLASS = "rgba(34, 34, 36, 0.62)";
const FONT = '-apple-system, "SF Pro Text", system-ui, "Helvetica Neue", Arial, sans-serif';

/** Points on the app's 390×844 screen. */
const SCREEN_PT_H = 844;

type Rect = { x: number; y: number; w: number; h: number };

type Layout = {
  W: number;
  H: number;
  pt: (n: number) => number;
  reticle: Rect;
  sheetTop: number;
  cover: Rect;
  addButton: Rect;
};

function layoutFor(W: number, H: number): Layout {
  const pt = (n: number) => (n * H) / SCREEN_PT_H;
  // ISBNScanPage: a barcode-shaped reticle, half the width, 1.74:1, at 46%.
  const rw = W * 0.5;
  const rh = rw / 1.74;
  const reticle = { x: (W - rw) / 2, y: H * 0.46 - rh / 2, w: rw, h: rh };
  // BookApprovalSheet at the .large detent: top bar, the cover and its
  // identity centred, the two actions at the bottom.
  const sheetTop = pt(69);
  const actionsBottom = H - pt(42);
  const buttonH = pt(48);
  const addButton = { x: pt(20), y: actionsBottom - buttonH, w: W - pt(40), h: buttonH };
  const contentTop = sheetTop + pt(62);
  const contentBottom = actionsBottom - buttonH * 2 - pt(10) - pt(14);
  const coverW = pt(200);
  const coverH = coverW * 1.5;
  const block = coverH + pt(18) + pt(27) + pt(6) + pt(18);
  const coverY = (contentTop + contentBottom) / 2 - block / 2;
  const cover = { x: (W - coverW) / 2, y: coverY, w: coverW, h: coverH };
  return { W, H, pt, reticle, sheetTop, cover, addButton };
}

// ---------------------------------------------------------------------------
// Painters
// ---------------------------------------------------------------------------

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w);
  canvas.height = Math.ceil(h);
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, ctx, texture };
}

function capsule(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
}

function shade(hex: string, factor: number) {
  return new THREE.Color(hex).multiplyScalar(factor).getStyle();
}

/** The back cover under the camera, out of focus: the book's colour, a few
 *  soft lines of blurb, a vignette. Painted small — scaled up it blurs. */
function paintFeed(cover: BookCover) {
  const { ctx, canvas, texture } = makeCanvas(96, 192);
  const { width: w, height: h } = canvas;
  ctx.fillStyle = shade(cover.baseColor, 0.5);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255, 255, 255, 0.09)";
  for (let i = 0; i < 6; i++) {
    const lineW = w * (i === 5 ? 0.45 : 0.72);
    ctx.fillRect(w * 0.14, h * 0.16 + i * h * 0.045, lineW, h * 0.018);
  }
  const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, h * 0.7);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.6)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  return texture;
}

/** The ISBN barcode sticker the reticle frames. */
function paintBarcode(isbn: string, rect: Rect) {
  const scale = 2;
  const { ctx, canvas, texture } = makeCanvas(rect.w * scale, rect.h * scale);
  const { width: w, height: h } = canvas;
  ctx.fillStyle = "#fbfaf7";
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, h * 0.08);
  ctx.fill();

  const modules = ean13Modules(isbn);
  const padX = w * 0.1;
  const unit = (w - padX * 2) / (modules.length + 9);
  const left = padX + unit * 9;
  const top = h * 0.14;
  const barH = h * 0.56;
  const guards = new Set([0, 1, 2, 45, 46, 47, 48, 49, 92, 93, 94]);
  ctx.fillStyle = "#111";
  for (let i = 0; i < modules.length; i++) {
    if (modules[i] !== "1") continue;
    ctx.fillRect(left + i * unit, top, unit + 0.4, barH + (guards.has(i) ? h * 0.07 : 0));
  }
  ctx.font = `500 ${Math.round(h * 0.15)}px ui-monospace, Menlo, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const textY = top + barH + h * 0.02;
  ctx.fillText(isbn[0], left - unit * 5, textY);
  for (let i = 0; i < 6; i++) {
    ctx.fillText(isbn[1 + i], left + unit * (3 + 7 * i + 3.5), textY);
    ctx.fillText(isbn[7 + i], left + unit * (50 + 7 * i + 3.5), textY);
  }
  return texture;
}

/** Four corner brackets — a closed frame reads as a crop tool. */
function paintReticle(L: Layout) {
  const pad = L.pt(4);
  const { ctx, texture } = makeCanvas(L.reticle.w + pad * 2, L.reticle.h + pad * 2);
  const arm = L.pt(22);
  const radius = L.pt(4);
  const x0 = pad;
  const y0 = pad;
  const x1 = pad + L.reticle.w;
  const y1 = pad + L.reticle.h;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = L.pt(2.4);
  ctx.lineCap = "round";
  const bracket = (cx: number, cy: number, ax: number, ay: number) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + ay * arm);
    ctx.lineTo(cx, cy + ay * radius);
    ctx.quadraticCurveTo(cx, cy, cx + ax * radius, cy);
    ctx.lineTo(cx + ax * arm, cy);
    ctx.stroke();
  };
  bracket(x0, y0, 1, 1);
  bracket(x1, y0, -1, 1);
  bracket(x1, y1, -1, -1);
  bracket(x0, y1, 1, -1);
  return texture;
}

/** The iOS status bar over the camera: the time, and the signal, Wi-Fi and
 *  battery glyphs, in white, each group centred in the space beside the
 *  Dynamic Island. Covers the top of the screen down to twice the island's
 *  centre. */
function paintStatusBar(L: Layout, island: IslandPlacement) {
  const { pt } = L;
  const cy = island.centerY * L.H;
  const { ctx, texture } = makeCanvas(L.W, cy * 2);
  const side = (L.W * (1 - island.width)) / 2;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";

  ctx.font = `600 ${pt(17)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("9:41", side / 2, cy + pt(0.5));

  // Signal bars, Wi-Fi fan and battery, laid out left to right.
  const barW = pt(3);
  const barGap = pt(1.7);
  const signalW = barW * 4 + barGap * 3;
  const wifiW = pt(15.3);
  const batteryW = pt(24.3);
  const capW = pt(1.4);
  const gap = pt(5);
  let x = L.W - side / 2 - (signalW + gap + wifiW + gap + batteryW + capW) / 2;

  const bottom = cy + pt(5.5);
  for (let i = 0; i < 4; i++) {
    const h = pt(4 + i * 2.35);
    ctx.beginPath();
    ctx.roundRect(x + i * (barW + barGap), bottom - h, barW, h, pt(1));
    ctx.fill();
  }
  x += signalW + gap;

  // Wi-Fi: a small wedge under two arcs, fanned upward.
  const fanX = x + wifiW / 2;
  const fanY = cy + pt(5.3);
  const start = Math.PI * 1.25;
  const end = Math.PI * 1.75;
  ctx.beginPath();
  ctx.moveTo(fanX, fanY);
  ctx.arc(fanX, fanY, pt(3.9), start, end);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = pt(2.3);
  ctx.lineCap = "round";
  for (const r of [pt(7.1), pt(10.3)]) {
    ctx.beginPath();
    ctx.arc(fanX, fanY, r, start + 0.06, end - 0.06);
    ctx.stroke();
  }
  x += wifiW + gap;

  // Battery: a faint outline and cap around a nearly full charge.
  const batteryH = pt(11.3);
  const top = cy - batteryH / 2;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = pt(1);
  ctx.beginPath();
  ctx.roundRect(x + pt(0.5), top + pt(0.5), batteryW - pt(1), batteryH - pt(1), pt(3.2));
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(x + batteryW + pt(0.4), cy - pt(2), capW, pt(4), [0, pt(1), pt(1), 0]);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.roundRect(x + pt(2), top + pt(2), (batteryW - pt(4)) * 0.85, batteryH - pt(4), pt(1.6));
  ctx.fill();
  return texture;
}

/** Cancel on the left, "Enter ISBN" on the right, in dark glass. */
function paintTopChrome(L: Layout) {
  const h = L.pt(32);
  const { ctx, texture } = makeCanvas(L.W, h);
  ctx.font = `500 ${L.pt(15)}px ${FONT}`;
  ctx.textBaseline = "middle";
  const padX = L.pt(14);

  const cancelW = ctx.measureText("Cancel").width + padX * 2;
  ctx.fillStyle = GLASS;
  capsule(ctx, L.pt(16), 0, cancelW, h);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText("Cancel", L.pt(16) + padX, h / 2);

  const label = "Enter ISBN";
  const iconW = L.pt(16);
  const gap = L.pt(6);
  const entryW = iconW + gap + ctx.measureText(label).width + padX * 2;
  const entryX = L.W - L.pt(16) - entryW;
  ctx.fillStyle = GLASS;
  capsule(ctx, entryX, 0, entryW, h);
  ctx.fill();
  // A small keyboard glyph.
  const kx = entryX + padX;
  const ky = h / 2 - L.pt(5.5);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = L.pt(1.2);
  ctx.beginPath();
  ctx.roundRect(kx, ky, iconW, L.pt(11), L.pt(2));
  ctx.stroke();
  ctx.fillStyle = "#fff";
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      ctx.fillRect(kx + L.pt(2.5) + col * L.pt(3.2), ky + L.pt(2.4) + row * L.pt(2.8), L.pt(1.5), L.pt(1.4));
    }
  }
  ctx.fillRect(kx + L.pt(4), ky + L.pt(8), L.pt(8), L.pt(1.3));
  ctx.fillText(label, kx + iconW + gap, h / 2);
  return texture;
}

/** The status pill; one texture per text, drawn when it changes. Returns
 *  where the spinner sits (x of its centre, in canvas px), if it has one. */
function paintPill(
  target: { ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture },
  L: Layout,
  text: string,
  withSpinner: boolean,
): number {
  const { ctx, texture } = target;
  const h = L.pt(32);
  ctx.clearRect(0, 0, L.W, h);
  ctx.font = `500 ${L.pt(13)}px ${FONT}`;
  ctx.textBaseline = "middle";
  const padX = L.pt(14);
  const spinnerW = withSpinner ? L.pt(12) + L.pt(7) : 0;
  const w = ctx.measureText(text).width + padX * 2 + spinnerW;
  const x = (L.W - w) / 2;
  ctx.fillStyle = GLASS;
  capsule(ctx, x, 0, w, h);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x + padX + spinnerW, h / 2);
  texture.needsUpdate = true;
  return x + padX + L.pt(6);
}

/** iOS's activity indicator: eight spokes fading round. */
function paintSpinner(size: number) {
  const { ctx, texture } = makeCanvas(size, size);
  ctx.translate(size / 2, size / 2);
  ctx.lineCap = "round";
  ctx.lineWidth = size * 0.1;
  for (let i = 0; i < 8; i++) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.25 + (0.75 * i) / 7})`;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.22);
    ctx.lineTo(0, -size * 0.42);
    ctx.stroke();
    ctx.rotate(Math.PI / 4);
  }
  return texture;
}

/** The sheet's silhouette (rounded top), white — tinted per material. */
function paintSheetShape(L: Layout) {
  const { ctx, texture } = makeCanvas(L.W, L.H);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(0, L.sheetTop, L.W, L.H - L.sheetTop + L.pt(40), [L.pt(12), L.pt(12), 0, 0]);
  ctx.fill();
  return texture;
}

/** The approval sheet for one book: close button, cover, title, author and
 *  the two actions. The cover image is drawn in when it arrives. */
function paintSheet(cover: BookCover, L: Layout) {
  const { ctx, texture } = makeCanvas(L.W, L.H);
  const { pt } = L;

  // Close button.
  const r = pt(16);
  const cx = pt(20) + r;
  const cy = L.sheetTop + pt(22) + r;
  ctx.fillStyle = SURFACE;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = pt(1.8);
  ctx.lineCap = "round";
  const k = pt(4.5);
  ctx.beginPath();
  ctx.moveTo(cx - k, cy - k);
  ctx.lineTo(cx + k, cy + k);
  ctx.moveTo(cx + k, cy - k);
  ctx.lineTo(cx - k, cy + k);
  ctx.stroke();

  // Cover slot: shadow, then a flat placeholder until the image arrives.
  const c = L.cover;
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
  ctx.shadowBlur = pt(16);
  ctx.shadowOffsetY = pt(12);
  ctx.fillStyle = cover.baseColor;
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.restore();
  if (cover.image) {
    loadCoverImage(cover.image).then(
      (img) => {
        ctx.drawImage(img, c.x, c.y, c.w, c.h);
        texture.needsUpdate = true;
        requestFrame();
      },
      () => {
        // Keep the flat placeholder.
      },
    );
  }

  // Identity.
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = INK;
  ctx.font = `600 ${pt(22)}px ${FONT}`;
  const titleY = c.y + c.h + pt(18);
  ctx.fillText(cover.title, L.W / 2, titleY, L.W - pt(40));
  if (cover.author) {
    ctx.fillStyle = MUTED;
    ctx.font = `500 ${pt(15)}px ${FONT}`;
    ctx.fillText(cover.author, L.W / 2, titleY + pt(27) + pt(6), L.W - pt(40));
  }

  // Actions: "♡ Wishlist" (secondary) above "+ Add to library" (primary).
  const add = L.addButton;
  const wish = { ...add, y: add.y - add.h - pt(10) };
  ctx.textBaseline = "middle";
  ctx.font = `600 ${pt(16)}px ${FONT}`;
  ctx.fillStyle = SURFACE;
  capsule(ctx, wish.x, wish.y, wish.w, wish.h);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillText("♡  Wishlist", L.W / 2, wish.y + wish.h / 2);
  ctx.fillStyle = INK;
  capsule(ctx, add.x, add.y, add.w, add.h);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText("+  Add to library", L.W / 2, add.y + add.h / 2);
  return texture;
}

function paintPressOverlay(L: Layout) {
  const { ctx, texture } = makeCanvas(L.addButton.w, L.addButton.h);
  ctx.fillStyle = "#fff";
  capsule(ctx, 0, 0, L.addButton.w, L.addButton.h);
  ctx.fill();
  return texture;
}

// ---------------------------------------------------------------------------
// The wireframe book (ScanWireframeSpin): a box turning in the cover's slot,
// projected the way the app projects it, drawn as fat lines with a glow.
// ---------------------------------------------------------------------------

const WIRE_SEGMENTS = 20;

function wireframeSegments(slot: Rect, angle: number, pt: (n: number) => number) {
  const halfW = slot.w / 2;
  const halfH = slot.h / 2;
  const midX = slot.x + halfW;
  const midY = slot.y + halfH;
  const depth = slot.w * 0.08;
  const camera = slot.w * 3;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const corner = (x: number, y: number, z: number): [number, number] => {
    const p = camera / (camera - (z * cos - x * sin));
    return [midX + (x * cos + z * sin) * p, midY + y * p];
  };
  const face = (z: number) => [
    corner(-halfW, -halfH, z),
    corner(halfW, -halfH, z),
    corner(halfW, halfH, z),
    corner(-halfW, halfH, z),
  ];
  const front = face(depth);
  const back = face(-depth);
  const lerp = (a: [number, number], b: [number, number], u: number): [number, number] => [
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
  ];
  const segments: { a: [number, number]; b: [number, number]; light: number }[] = [];
  for (let i = 0; i < 4; i++) {
    segments.push({ a: back[i], b: back[(i + 1) % 4], light: 0.45 });
    segments.push({ a: front[i], b: back[i], light: 0.55 });
    segments.push({ a: front[i], b: front[(i + 1) % 4], light: 1 });
  }
  // Mesh on the front face: 3 columns, 5 rows.
  for (let c = 1; c < 4; c++) {
    const u = c / 4;
    segments.push({ a: lerp(front[0], front[1], u), b: lerp(front[3], front[2], u), light: 0.32 });
  }
  for (let r = 1; r < 6; r++) {
    const v = r / 6;
    segments.push({ a: lerp(front[0], front[3], v), b: lerp(front[1], front[2], v), light: 0.32 });
  }
  return { segments, dots: [front[3], front[2]], dotRadius: pt(3.5) };
}

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

type Props = {
  covers: BookCover[];
  sharedRef: RefObject<ScanShared>;
  /** Render-target size in pixels, and the inner scene's half height. */
  width: number;
  height: number;
  halfH: number;
  island: IslandPlacement;
};

const FEED_CROSSFADE = 0.35;

export function ScanScreen({ covers, sharedRef, width, height, halfH, island }: Props) {
  const L = useMemo(() => layoutFor(width, height), [width, height]);
  const px = (2 * halfH) / height;

  // Per-book textures, one set per distinct cover (the carousel lists every
  // book twice), plus the shared chrome.
  const assets = useMemo(() => {
    const byCover = new Map<BookCover, { feed: THREE.CanvasTexture; barcode: THREE.CanvasTexture; sheet: THREE.CanvasTexture }>();
    const books = covers.map((cover) => {
      let set = byCover.get(cover);
      if (!set) {
        set = {
          feed: paintFeed(cover),
          barcode: paintBarcode(cover.isbn, { x: 0, y: 0, w: L.reticle.w * 0.8, h: L.reticle.h * 0.74 }),
          sheet: paintSheet(cover, L),
        };
        byCover.set(cover, set);
      }
      return set;
    });
    const pill = makeCanvas(L.W, L.pt(32));
    return {
      books,
      reticle: paintReticle(L),
      statusBar: paintStatusBar(L, island),
      chrome: paintTopChrome(L),
      pill,
      spinner: paintSpinner(Math.round(L.pt(12) * 2)),
      sheetShape: paintSheetShape(L),
      press: paintPressOverlay(L),
      all(): THREE.Texture[] {
        const shared = [this.reticle, this.statusBar, this.chrome, this.pill.texture, this.spinner, this.sheetShape, this.press];
        const perBook = [...byCover.values()].flatMap((s) => [s.feed, s.barcode, s.sheet]);
        return [...shared, ...perBook];
      },
    };
  }, [covers, L, island]);

  const wire = useMemo(() => {
    const geometry = new LineSegmentsGeometry();
    const make = (linewidth: number, opacity: number) =>
      new LineMaterial({
        color: 0xffffff,
        linewidth,
        vertexColors: true,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      });
    // Core lines, then two wide faint passes — the app's white glow. Drawn
    // widest first; bounds change every frame, so no frustum culling.
    const materials = [make(L.pt(1.3), 1), make(L.pt(6), 0.2), make(L.pt(16), 0.07)];
    const lines = materials.map((material, i) => {
      material.resolution.set(width, height);
      const line = new LineSegments2(geometry, material);
      line.renderOrder = 13 + (materials.length - 1 - i);
      line.frustumCulled = false;
      return line;
    });
    lines.forEach((line, i) => {
      line.userData.glow = [1, 0.2, 0.07][i];
    });
    return { geometry, materials, lines };
  }, [L, width, height]);

  useEffect(() => {
    return () => {
      for (const texture of assets.all()) texture.dispose();
      wire.geometry.dispose();
      for (const m of wire.materials) m.dispose();
    };
  }, [assets, wire]);

  // Scratch buffers for the wireframe's per-frame segments.
  const wireBuffers = useRef({
    positions: new Float32Array(WIRE_SEGMENTS * 6),
    colors: new Float32Array(WIRE_SEGMENTS * 6),
  });

  // Scene graph handles.
  const feedRefs = useRef<(THREE.Mesh | null)[]>([]);
  const barcodeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const reticleRef = useRef<THREE.Mesh>(null);
  const pillRef = useRef<THREE.Mesh>(null);
  const spinnerRef = useRef<THREE.Mesh>(null);
  const dimRef = useRef<THREE.Mesh>(null);
  const sheetRef = useRef<THREE.Group>(null);
  const sheetContentRef = useRef<THREE.Mesh>(null);
  const blackRef = useRef<THREE.Mesh>(null);
  const pressRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.Group>(null);
  const dotRefs = useRef<(THREE.Mesh | null)[]>([]);

  // Screen state carried between frames.
  const memo = useRef({
    feedShown: -1,
    feedPrevious: -1,
    feedMix: 1,
    pillKey: "",
    spinnerX: 0,
    sheet: 1,
    sheetBook: -1,
  });

  // Place a unit plane at a pixel rect (top-left origin, y down).
  const place = (mesh: THREE.Object3D, r: Rect) => {
    mesh.position.set((r.x + r.w / 2 - width / 2) * px, (height / 2 - (r.y + r.h / 2)) * px, 0);
    mesh.scale.set(r.w * px, r.h * px, 1);
  };

  useFrame((state, rawDelta) => {
    const shared = sharedRef.current;
    const m = memo.current;
    const delta = Math.min(rawDelta, 1 / 30);
    const s = shared.mode === "aiming" ? AIMING : screenAt(shared.t);
    let busy = false;

    // Camera feed: crossfade to the book now in front of the camera.
    const feedBook = shared.mode === "aiming" ? shared.feedBook : shared.book;
    if (feedBook !== m.feedShown) {
      m.feedPrevious = m.feedShown;
      m.feedShown = feedBook;
      m.feedMix = m.feedPrevious < 0 ? 1 : 0;
    }
    if (m.feedMix < 1) {
      m.feedMix = Math.min(1, m.feedMix + delta / FEED_CROSSFADE);
      busy = true;
    }
    const slots = [m.feedPrevious, m.feedShown];
    for (let i = 0; i < 2; i++) {
      const book = slots[i];
      const opacity = i === 1 ? m.feedMix : m.feedMix < 1 ? 1 : 0;
      for (const [refs, key] of [[feedRefs, "feed"], [barcodeRefs, "barcode"]] as const) {
        const mesh = refs.current[i];
        if (!mesh) continue;
        mesh.visible = book >= 0 && opacity > 0.001;
        if (!mesh.visible) continue;
        const material = mesh.material as THREE.MeshBasicMaterial;
        const texture = assets.books[book][key];
        if (material.map !== texture) {
          material.map = texture;
          material.needsUpdate = true;
        }
        material.opacity = opacity;
      }
    }

    // Reticle.
    const reticle = reticleRef.current;
    if (reticle) {
      (reticle.material as THREE.MeshBasicMaterial).opacity = s.reticle;
      const pad = L.pt(4);
      place(reticle, { x: L.reticle.x - pad, y: L.reticle.y - pad, w: L.reticle.w + pad * 2, h: L.reticle.h + pad * 2 });
      reticle.scale.multiplyScalar(1 + 0.05 * s.pulse);
    }

    // Status pill (redrawn when its text changes) and its spinner.
    const book = covers[shared.book];
    const pillText = pillLabel(s.pill, book?.isbn ?? "");
    const pillKey = `${s.pill}:${pillText}`;
    if (pillKey !== m.pillKey) {
      m.pillKey = pillKey;
      m.spinnerX = paintPill(assets.pill, L, pillText, s.spinner);
    }
    const pill = pillRef.current;
    if (pill) {
      const pillH = L.pt(32);
      place(pill, { x: 0, y: L.H - pillBottomInset(L) - pillH, w: L.W, h: pillH });
      pill.scale.multiplyScalar(0.94 + 0.06 * s.pillIn);
      (pill.material as THREE.MeshBasicMaterial).opacity = s.pillIn;
    }
    const spinner = spinnerRef.current;
    if (spinner) {
      spinner.visible = s.spinner;
      if (spinner.visible) {
        const size = L.pt(12);
        place(spinner, { x: m.spinnerX - size / 2, y: L.H - pillBottomInset(L) - L.pt(16) - size / 2, w: size, h: size });
        spinner.rotation.z = -((state.clock.elapsedTime * 8) | 0) * (Math.PI / 4);
        (spinner.material as THREE.MeshBasicMaterial).opacity = s.pillIn;
      }
    }

    // Approval sheet. In aiming mode it eases away from wherever it was;
    // in the ceremony it follows the timeline.
    if (shared.mode === "aiming") {
      const target = 0;
      m.sheet = THREE.MathUtils.damp(m.sheet, target, 14, delta);
      if (Math.abs(m.sheet - target) < 1e-3) m.sheet = target;
      else busy = true;
    } else {
      m.sheet = s.sheet;
      m.sheetBook = shared.t < RISE_AT ? shared.previousBook : shared.book;
    }
    if (m.sheetBook < 0) m.sheetBook = shared.book;
    const sheet = sheetRef.current;
    if (sheet) {
      sheet.visible = m.sheet > 0.001;
      sheet.position.y = -(1 - m.sheet) * (L.H - L.sheetTop + L.pt(20)) * px;
    }
    const content = sheetContentRef.current;
    if (content) {
      const material = content.material as THREE.MeshBasicMaterial;
      const texture = assets.books[m.sheetBook].sheet;
      if (material.map !== texture) {
        material.map = texture;
        material.needsUpdate = true;
      }
      material.opacity = shared.mode === "aiming" ? 1 : s.content;
    }
    if (blackRef.current) {
      (blackRef.current.material as THREE.MeshBasicMaterial).opacity = shared.mode === "aiming" ? 0 : s.black;
    }
    if (dimRef.current) {
      (dimRef.current.material as THREE.MeshBasicMaterial).opacity = 0.45 * m.sheet;
    }
    if (pressRef.current) {
      (pressRef.current.material as THREE.MeshBasicMaterial).opacity = 0.18 * s.press;
    }

    // Wireframe.
    const wireGroup = wireRef.current;
    if (wireGroup) {
      wireGroup.visible = !!s.spin && shared.mode === "timeline";
      if (s.spin && wireGroup.visible) {
        const { segments, dots, dotRadius } = wireframeSegments(L.cover, s.spin.angle, L.pt);
        const { positions, colors } = wireBuffers.current;
        segments.forEach((seg, i) => {
          const [ax, ay] = seg.a;
          const [bx, by] = seg.b;
          positions.set([(ax - width / 2) * px, (height / 2 - ay) * px, 0, (bx - width / 2) * px, (height / 2 - by) * px, 0], i * 6);
          colors.fill(seg.light, i * 6, i * 6 + 6);
        });
        // The three line passes share one geometry.
        let geometryUpdated = false;
        for (const child of wireGroup.children) {
          if (!(child instanceof LineSegments2)) continue;
          if (!geometryUpdated) {
            child.geometry.setPositions(positions);
            child.geometry.setColors(colors);
            geometryUpdated = true;
          }
          child.material.opacity = child.userData.glow * s.spin.opacity;
        }
        dots.forEach(([dx, dy], i) => {
          const dot = dotRefs.current[i];
          if (!dot) return;
          dot.position.set((dx - width / 2) * px, (height / 2 - dy) * px, 0);
          dot.scale.setScalar(dotRadius * px);
          (dot.material as THREE.MeshBasicMaterial).opacity = s.spin!.opacity;
        });
      }
    }

    if (busy) state.invalidate();
  });

  const fullScreen = { x: 0, y: 0, w: width, h: height };
  const barcodeBox = {
    x: L.reticle.x + L.reticle.w * 0.1,
    y: L.reticle.y + L.reticle.h * 0.13,
    w: L.reticle.w * 0.8,
    h: L.reticle.h * 0.74,
  };
  // Layering is by renderOrder; nothing here depth-tests.
  const flat = { transparent: true, toneMapped: false, depthTest: false, depthWrite: false } as const;

  return (
    <group>
      {[0, 1].map((i) => (
        <mesh
          key={`feed${i}`}
          ref={(el: THREE.Mesh | null) => {
            feedRefs.current[i] = el;
            if (el) place(el, fullScreen);
          }}
          renderOrder={i}
        >
          <planeGeometry />
          <meshBasicMaterial {...flat} />
        </mesh>
      ))}
      {[0, 1].map((i) => (
        <mesh
          key={`barcode${i}`}
          ref={(el: THREE.Mesh | null) => {
            barcodeRefs.current[i] = el;
            if (el) place(el, barcodeBox);
          }}
          renderOrder={2 + i}
        >
          <planeGeometry />
          <meshBasicMaterial {...flat} />
        </mesh>
      ))}
      <mesh ref={reticleRef} renderOrder={4}>
        <planeGeometry />
        <meshBasicMaterial {...flat} map={assets.reticle} />
      </mesh>
      <mesh
        ref={(el: THREE.Mesh | null) => {
          if (el) place(el, { x: 0, y: L.pt(83) - L.pt(16), w: L.W, h: L.pt(32) });
        }}
        renderOrder={5}
      >
        <planeGeometry />
        <meshBasicMaterial {...flat} map={assets.chrome} />
      </mesh>
      <mesh ref={pillRef} renderOrder={6}>
        <planeGeometry />
        <meshBasicMaterial {...flat} map={assets.pill.texture} />
      </mesh>
      <mesh ref={spinnerRef} renderOrder={7} visible={false}>
        <planeGeometry />
        <meshBasicMaterial {...flat} map={assets.spinner} />
      </mesh>
      <mesh
        ref={(el: THREE.Mesh | null) => {
          dimRef.current = el;
          if (el) place(el, fullScreen);
        }}
        renderOrder={8}
      >
        <planeGeometry />
        <meshBasicMaterial {...flat} color="#000000" opacity={0} />
      </mesh>
      <group ref={sheetRef}>
        <mesh
          ref={(el: THREE.Mesh | null) => {
            if (el) place(el, fullScreen);
          }}
          renderOrder={9}
        >
          <planeGeometry />
          <meshBasicMaterial {...flat} map={assets.sheetShape} color={PAPER} />
        </mesh>
        <mesh
          ref={(el: THREE.Mesh | null) => {
            sheetContentRef.current = el;
            if (el) place(el, fullScreen);
          }}
          renderOrder={10}
        >
          <planeGeometry />
          <meshBasicMaterial {...flat} />
        </mesh>
        <mesh
          ref={(el: THREE.Mesh | null) => {
            pressRef.current = el;
            if (el) place(el, L.addButton);
          }}
          renderOrder={11}
        >
          <planeGeometry />
          <meshBasicMaterial {...flat} map={assets.press} opacity={0} />
        </mesh>
        <mesh
          ref={(el: THREE.Mesh | null) => {
            blackRef.current = el;
            if (el) place(el, fullScreen);
          }}
          renderOrder={12}
        >
          <planeGeometry />
          <meshBasicMaterial {...flat} map={assets.sheetShape} color="#000000" opacity={0} />
        </mesh>
        <group ref={wireRef} visible={false}>
          {wire.lines.map((line, i) => (
            <primitive key={`wire${i}`} object={line} />
          ))}
          {[0, 1].map((i) => (
            <mesh
              key={`dot${i}`}
              ref={(el: THREE.Mesh | null) => {
                dotRefs.current[i] = el;
              }}
              renderOrder={16}
            >
              <circleGeometry args={[1, 20]} />
              <meshBasicMaterial {...flat} color="#ffffff" />
            </mesh>
          ))}
        </group>
      </group>
      <mesh
        ref={(el: THREE.Mesh | null) => {
          if (el) place(el, { x: 0, y: 0, w: L.W, h: island.centerY * L.H * 2 });
        }}
        renderOrder={17}
      >
        <planeGeometry />
        <meshBasicMaterial {...flat} map={assets.statusBar} />
      </mesh>
    </group>
  );
}

/** Distance from the screen bottom to the pill's bottom edge: the home
 *  indicator inset plus the pill's own padding (ISBNScanPage). */
function pillBottomInset(L: Layout) {
  return L.pt(34 + 18);
}

function pillLabel(pill: PillState, isbn: string) {
  if (pill === "aim") return "Point at a barcode";
  if (pill === "looking") return `Looking up ${abbreviatedIsbn(isbn)}`;
  return "Got it!";
}
