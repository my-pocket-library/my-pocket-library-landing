"use client";

import { PerspectiveCamera, RenderTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { type BookCover, loadCoverImage, paintCover } from "./book";
import { PARAMS } from "@/lib/scene-params";

// ============================================================================
// Phone hardware — rounded-rect shape extruded into a slim iPhone-shaped slab.
// The screen plane sits just in front; a Dynamic Island pill and small side
// buttons round out the silhouette.
// ============================================================================

const PHONE_W = 1.55;
const PHONE_H = 3.1;
const PHONE_D = 0.16;
const CORNER_R = 0.30;        // body corner radius
const BEZEL = 0.05;            // visible bezel between body edge and screen
const SCREEN_W = PHONE_W - BEZEL * 2;
const SCREEN_H = PHONE_H - BEZEL * 2;
const SCREEN_CORNER_R = Math.max(0.02, CORNER_R - BEZEL);

// ExtrudeGeometry's bevel pushes the front face OUT by `bevelThickness` past
// the nominal `depth`, so the body's true front isn't at PHONE_D/2 — it's at
// PHONE_D/2 + BEVEL_T. The screen has to sit past that or the body occludes
// it (which is exactly the all-black-screen bug we hit).
const BEVEL_T = 0.024;
const BEVEL_S = 0.024;
const SCREEN_FORWARD = PHONE_D / 2 + BEVEL_T + 0.004;

// Dynamic Island — small black rounded pill at the top of the screen.
const ISLAND_W = 0.46;
const ISLAND_H = 0.13;
const ISLAND_Y = PHONE_H / 2 - BEZEL - ISLAND_H / 2 - 0.07;
const ISLAND_FORWARD = SCREEN_FORWARD + 0.004;

// Side button nubs — half-buried in the body wall so they read as buttons,
// not floating cubes. (Volume up, volume down, power.)
const BTN_W = 0.022;
const BTN_VOL_H = 0.30;
const BTN_VOL_DOWN_H = 0.30;
const BTN_PWR_H = 0.44;
const BTN_D = PHONE_D * 0.55;

/** Build a rounded-rectangle THREE.Shape centered on the origin. */
function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const x = -w / 2;
  const y = -h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// ============================================================================
// Inner-scene framing — ortho camera matched to the screen plane's aspect so
// the app-UI canvas maps 1:1 with no stretch.
// ============================================================================

const SCREEN_ASPECT = SCREEN_W / SCREEN_H;
const ORTHO_HALF_H = 1.05;
const ORTHO_HALF_W = ORTHO_HALF_H * SCREEN_ASPECT;
const FBO_H = 1024;
const FBO_W = Math.round(FBO_H * SCREEN_ASPECT);

// Inner perspective-camera framing. To preserve the same visible area the
// ortho was giving us at the planes' z, set vertical FOV so that at distance
// INNER_CAM_Z from the camera the visible half-height equals ORTHO_HALF_H:
//
//   tan(fov_y / 2) = ORTHO_HALF_H / INNER_CAM_Z
//
// Pulling INNER_CAM_Z far back and using a narrow FOV makes the inner-scene
// projection feel nearly orthographic — so the app UI doesn't keystone — but
// still IS perspective (which is what the user asked for).
const INNER_CAM_Z = 10;
const INNER_FOV_DEG = (2 * Math.atan(ORTHO_HALF_H / INNER_CAM_Z) * 180) / Math.PI;

// ============================================================================
// Canvas-2D helpers for painting the app UI texture.
// ============================================================================

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * App shell — painted once. Status bar (11:49 + cellular/wifi/battery icons)
 * and the "My Library" header with chevron. Sits behind the per-book
 * content so the chrome stays put while the book slides through.
 *
 * Glyph styles match the reference iPhone Dynamic Island status bar:
 *   • Cellular: 4 same-size filled dots
 *   • WiFi:     3 stacked filled arcs + base dot
 *   • Battery:  rounded outline + inner fill + cap nub
 */
function paintAppShell(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  // Background — same warm cream as the surrounding page so the rounded
  // corners of the screen disappear into the body.
  ctx.fillStyle = "#f6f2ea";
  ctx.fillRect(0, 0, W, H);

  // ---- Status bar ------------------------------------------------------
  const sbY = H * 0.045;
  const ink = "#0c0c0c";

  // Time on the left
  ctx.fillStyle = ink;
  ctx.font = `700 ${H * 0.022}px -apple-system, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("11:49", W * 0.10, sbY);

  // Right-side cluster, anchored from W * 0.90 and laid out right-to-left:
  //   …  cellular dots  ·  wifi  ·  battery  →
  const rightX = W * 0.90;
  let x = rightX;

  // ── Battery — rounded rectangle + inner fill (≈85% charge) + cap nub
  const battW = W * 0.085;
  const battH = H * 0.014;
  const battR = 2.5;
  const inset = 2;
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  roundedRectPath(ctx, x - battW, sbY - battH / 2, battW, battH, battR);
  ctx.stroke();
  ctx.fillStyle = ink;
  // Inner fill — leaves a small gap to the outline so it reads as a
  // separate "charge" indicator, not a solid black box.
  roundedRectPath(
    ctx,
    x - battW + inset,
    sbY - battH / 2 + inset,
    (battW - inset * 2) * 0.85,
    battH - inset * 2,
    Math.max(0, battR - 1.5),
  );
  ctx.fill();
  // Cap nub on the right
  ctx.fillRect(x, sbY - (battH * 0.5) / 2, 2, battH * 0.5);
  ctx.restore();

  x -= battW + W * 0.018; // gap before WiFi

  // ── WiFi — 3 stacked filled arcs + a base dot at the bottom.
  // Arcs are thick rounded strokes so they read as solid wedges (matches
  // the reference style, not the thin-outline look).
  const wifiH = H * 0.022;
  const wifiCx = x - wifiH * 0.55;
  const wifiCy = sbY + wifiH * 0.20;

  ctx.save();
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineCap = "round";

  // Base dot
  ctx.beginPath();
  ctx.arc(wifiCx, wifiCy, wifiH * 0.13, 0, Math.PI * 2);
  ctx.fill();

  // Three concentric arcs above the dot
  ctx.lineWidth = wifiH * 0.16;
  for (let i = 0; i < 3; i++) {
    const r = wifiH * (0.42 + i * 0.28);
    ctx.beginPath();
    ctx.arc(wifiCx, wifiCy, r, Math.PI * 1.22, Math.PI * 1.78);
    ctx.stroke();
  }
  ctx.restore();

  x = wifiCx - wifiH * 0.5 - W * 0.016; // gap before cellular dots

  // ── Cellular — 4 same-size filled dots, evenly spaced
  const dotR = H * 0.0055;
  const dotGap = dotR * 3.4;
  ctx.fillStyle = ink;
  for (let i = 3; i >= 0; i--) {
    ctx.beginPath();
    ctx.arc(x - i * dotGap, sbY, dotR, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Header: "My Library" with chevron-down -------------------------
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#0c0c0c";
  ctx.font = `700 ${H * 0.036}px -apple-system, system-ui, sans-serif`;
  ctx.fillText("My Library", W * 0.10, H * 0.125);

  const chevronX = W * 0.90;
  const chevronY = H * 0.125;
  ctx.strokeStyle = "#0c0c0c";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(chevronX - 10, chevronY - 5);
  ctx.lineTo(chevronX, chevronY + 5);
  ctx.lineTo(chevronX + 10, chevronY - 5);
  ctx.stroke();
}

/** Where the cover sits on the per-book content canvas (book aspect 2:3). */
function coverRect(W: number, H: number) {
  const w = W * 0.55;
  const h = w * (768 / 512);
  return { x: (W - w) / 2, y: H * 0.2, w, h };
}

/**
 * Per-book content — cover artwork with drop shadow + white rounded info card
 * containing the title and author. Drawn on a transparent canvas so it can
 * slide over the static app shell. Image-backed books get a flat baseColor
 * block in the cover slot; BookContent draws the image over it once loaded.
 */
function paintBookContent(canvas: HTMLCanvasElement, cover: BookCover) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  const {
    x: coverX,
    y: coverY,
    w: coverDispW,
    h: coverDispH,
  } = coverRect(W, H);

  // Drop shadow under the cover (drawn as a separately blurred fill so the
  // cover itself renders without shadow leakage onto adjacent pixels).
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.32)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = "#000";
  ctx.fillRect(coverX + 6, coverY + 8, coverDispW - 12, coverDispH - 12);
  ctx.restore();

  if (cover.image) {
    ctx.fillStyle = cover.baseColor;
    ctx.fillRect(coverX, coverY, coverDispW, coverDispH);
  } else {
    // Procedural cover — painted at high resolution, then drawn at display
    // size so the pattern reads cleanly at FBO resolution.
    const coverCanvas = document.createElement("canvas");
    coverCanvas.width = 512;
    coverCanvas.height = 768;
    paintCover(coverCanvas, cover, 1);
    ctx.drawImage(coverCanvas, coverX, coverY, coverDispW, coverDispH);
  }

  // ---- Info card: white rounded rect with title + author --------------
  const cardW = W * 0.78;
  const cardH = H * 0.105;
  const cardX = (W - cardW) / 2;
  const cardY = coverY + coverDispH + H * 0.035;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.10)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = "#ffffff";
  roundedRectPath(ctx, cardX, cardY, cardW, cardH, 20);
  ctx.fill();
  ctx.restore();

  // Title
  ctx.fillStyle = "#0c0c0c";
  ctx.font = `700 ${H * 0.028}px -apple-system, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(cover.title, cardX + W * 0.045, cardY + H * 0.018);

  // Author (or a placeholder so the card always has two lines)
  ctx.fillStyle = "rgba(12, 12, 12, 0.55)";
  ctx.font = `500 ${H * 0.022}px -apple-system, system-ui, sans-serif`;
  ctx.fillText(
    cover.author ?? "Unknown author",
    cardX + W * 0.045,
    cardY + H * 0.058,
  );
}

// ============================================================================
// <Phone /> — phone body + screen + Dynamic Island + side buttons.
// ============================================================================

type PhoneProps = {
  covers: BookCover[];
  /** Follow the mouse. Off while the scene holds its opening frame. */
  parallax: boolean;
  centeredIndexRef: RefObject<number>;
  transitionRef: RefObject<number>;
};

export function Phone({
  covers,
  parallax,
  centeredIndexRef,
  transitionRef,
}: PhoneProps) {
  const rootRef = useRef<THREE.Group>(null);

  // Phone body — rounded rect extruded with a small bevel so the silhouette
  // has the same chamfer iPhones do where the front meets the side.
  const phoneGeom = useMemo(() => {
    const shape = roundedRectShape(PHONE_W, PHONE_H, CORNER_R);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: PHONE_D,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: BEVEL_S,
      bevelThickness: BEVEL_T,
    });
    // Re-center along z so the body is symmetric about the origin.
    g.translate(0, 0, -PHONE_D / 2);
    return g;
  }, []);

  // Screen and Dynamic Island are flat rounded-rect ShapeGeometries — same
  // form language as the body, no extrusion needed (they sit in front).
  //
  // ShapeGeometry's default UV generator copies vertex xy straight into uv,
  // so for a centered shape with xy in [-w/2, +w/2] × [-h/2, +h/2] the UVs
  // also span that range — not [0,1] like the FBO expects. Normalize them
  // so the screen texture maps 1:1 across the rounded plane.
  const screenGeom = useMemo(() => {
    const shape = roundedRectShape(SCREEN_W, SCREEN_H, SCREEN_CORNER_R);
    const g = new THREE.ShapeGeometry(shape);
    const uvs = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uvs.count; i++) {
      uvs.setXY(
        i,
        uvs.getX(i) / SCREEN_W + 0.5,
        uvs.getY(i) / SCREEN_H + 0.5,
      );
    }
    uvs.needsUpdate = true;
    return g;
  }, []);
  const islandGeom = useMemo(() => {
    const shape = roundedRectShape(ISLAND_W, ISLAND_H, ISLAND_H / 2);
    return new THREE.ShapeGeometry(shape);
  }, []);

  useEffect(() => {
    return () => {
      phoneGeom.dispose();
      screenGeom.dispose();
      islandGeom.dispose();
    };
  }, [phoneGeom, screenGeom, islandGeom]);

  // ---- Mouse parallax -------------------------------------------------
  // Latest normalized cursor coords in [-1, +1] from viewport centre.
  // Written from a window-level mousemove listener (the Canvas wrapper is
  // pointer-events-none, so R3F's built-in pointer state wouldn't update).
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // Current lerped rotation contribution from the mouse — added on top of
  // PARAMS.phoneRot* each frame.
  const mouseRotRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: MouseEvent) => {
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      if (halfW <= 0 || halfH <= 0) return;
      mouseRef.current.x = (e.clientX - halfW) / halfW;
      mouseRef.current.y = (e.clientY - halfH) / halfH;
    };
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  // Live transform driven by PARAMS so the tweakpane can move/scale the
  // phone without re-renders.
  useFrame((_, delta) => {
    const g = rootRef.current;
    if (!g) return;
    g.visible = PARAMS.phoneEnabled;
    if (!g.visible) return;
    g.position.set(PARAMS.phoneX, PARAMS.phoneY, PARAMS.phoneZ);

    // Mouse parallax: target rotation = normalized cursor × strength;
    // when disabled, target is 0 so the phone eases back to its base
    // rotation instead of snapping. Y-axis yaw follows mouse-x and
    // X-axis pitch follows mouse-y (negate mouseY because browser y
    // grows DOWN — so "cursor below centre" should pitch the phone-top
    // toward the viewer, not away).
    const follow = parallax && PARAMS.phoneMouseRotation;
    const targetPitch = follow
      ? -mouseRef.current.y * PARAMS.phoneMouseStrengthX
      : 0;
    const targetYaw = follow
      ? mouseRef.current.x * PARAMS.phoneMouseStrengthY
      : 0;
    // phoneMouseLerp is tuned as a per-frame factor at 60 fps; converting
    // it to a rate and damping by elapsed time keeps the easing the same
    // speed on 120 Hz screens instead of twice as fast.
    const lerp = Math.min(0.999, Math.max(0.001, PARAMS.phoneMouseLerp));
    const rate = -Math.log(1 - lerp) * 60;
    const m = mouseRotRef.current;
    m.x = THREE.MathUtils.damp(m.x, targetPitch, rate, delta);
    m.y = THREE.MathUtils.damp(m.y, targetYaw, rate, delta);

    g.rotation.set(
      PARAMS.phoneRotX + mouseRotRef.current.x,
      PARAMS.phoneRotY + mouseRotRef.current.y,
      PARAMS.phoneRotZ,
    );
    g.scale.setScalar(PARAMS.phoneScale);
  });

  return (
    <group ref={rootRef}>
      {/* Phone body */}
      <mesh geometry={phoneGeom}>
        <meshStandardMaterial
          color="#17171b"
          roughness={0.32}
          metalness={0.72}
        />
      </mesh>

      {/* Side buttons — left: volume up + down, right: power.
       *  Centered on the body edge so they read as half-buried nubs. */}
      <mesh position={[-PHONE_W / 2, PHONE_H * 0.22, 0]}>
        <boxGeometry args={[BTN_W, BTN_VOL_H, BTN_D]} />
        <meshStandardMaterial
          color="#26262a"
          roughness={0.45}
          metalness={0.6}
        />
      </mesh>
      <mesh position={[-PHONE_W / 2, PHONE_H * 0.06, 0]}>
        <boxGeometry args={[BTN_W, BTN_VOL_DOWN_H, BTN_D]} />
        <meshStandardMaterial
          color="#26262a"
          roughness={0.45}
          metalness={0.6}
        />
      </mesh>
      <mesh position={[PHONE_W / 2, PHONE_H * 0.12, 0]}>
        <boxGeometry args={[BTN_W, BTN_PWR_H, BTN_D]} />
        <meshStandardMaterial
          color="#26262a"
          roughness={0.45}
          metalness={0.6}
        />
      </mesh>

      {/* Screen — rounded-rect ShapeGeometry so the screen edge follows
       *  the body's curvature. The RenderTexture inside renders the app
       *  UI scene into an FBO whose aspect matches the plane. */}
      <mesh geometry={screenGeom} position={[0, 0, SCREEN_FORWARD]}>
        <meshBasicMaterial toneMapped={false}>
          <RenderTexture attach="map" width={FBO_W} height={FBO_H}>
            <color attach="background" args={["#f6f2ea"]} />

            {/* `manual` + explicit `aspect` is required here — without them
             *  drei syncs the camera's aspect to the outer Canvas viewport
             *  (which is wide), but this camera renders into a portrait
             *  FBO. Result without the override: horizontal squish. */}
            <PerspectiveCamera
              makeDefault
              manual
              fov={INNER_FOV_DEG}
              aspect={SCREEN_ASPECT}
              near={0.1}
              far={100}
              position={[0, 0, INNER_CAM_Z]}
            />

            {/* Static chrome behind the sliding book content. */}
            <AppShell />

            {/* Per-book content that slides in lockstep with the carousel. */}
            <BookContent
              covers={covers}
              centeredIndexRef={centeredIndexRef}
              transitionRef={transitionRef}
            />
          </RenderTexture>
        </meshBasicMaterial>
      </mesh>

      {/* Dynamic Island — small black rounded pill above the screen content,
       *  slightly forward so it occludes the screen. */}
      <mesh
        geometry={islandGeom}
        position={[0, ISLAND_Y, ISLAND_FORWARD]}
      >
        <meshBasicMaterial color="#000000" toneMapped={false} />
      </mesh>
    </group>
  );
}

// ============================================================================
// Inner-scene meshes: static app shell + sliding per-book content.
// ============================================================================

function AppShell() {
  const tex = useMemo<THREE.CanvasTexture | null>(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = FBO_W;
    c.height = FBO_H;
    paintAppShell(c);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  useEffect(() => {
    return () => {
      tex?.dispose();
    };
  }, [tex]);

  if (!tex) return null;

  return (
    // Sit just behind the sliding book-content plane. Under the inner
    // perspective camera, putting the shell at z = -0.5 would foreshorten
    // it by ~5% and leave a visible cream gap around the screen edge —
    // -0.01 keeps the shell the same projected size as the content.
    <mesh position={[0, 0, -0.01]}>
      <planeGeometry args={[ORTHO_HALF_W * 2, ORTHO_HALF_H * 2]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

// Distance between neighbouring books on the phone screen, in inner-scene
// units: just under one screen width. Mid-change more of both books stays
// on screen, while a page waiting at rest (card 78% of the width, plus its
// shadow) still sits fully off the edge.
const PAGE_STRIDE = ORTHO_HALF_W * 2 * 0.95;

function BookContent({
  covers,
  centeredIndexRef,
  transitionRef,
}: {
  covers: BookCover[];
  centeredIndexRef: RefObject<number>;
  transitionRef: RefObject<number>;
}) {
  // Two pages: the book the carousel is leaving and the one it's heading
  // to. They slide together, so the screen always shows at least one book.
  const pageRefs = useRef<(THREE.Mesh | null)[]>([]);
  const pageBooksRef = useRef<number[]>([-1, -1]);

  // Pre-build all per-book content textures up front so the swap on index
  // change is a pointer assignment — no allocation, no GPU upload mid-frame.
  // One texture per distinct cover: the carousel lists every book twice.
  const contentTextures = useMemo(() => {
    const byCover = new Map<BookCover, THREE.CanvasTexture>();
    return covers.map((cover) => {
      const existing = byCover.get(cover);
      if (existing) return existing;

      const c = document.createElement("canvas");
      c.width = FBO_W;
      c.height = FBO_H;
      paintBookContent(c, cover);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      byCover.set(cover, t);

      // Real cover image: draw it into the slot paintBookContent left for
      // it (same image the 3D book uses — loaded once, see loadCoverImage).
      if (cover.image) {
        loadCoverImage(cover.image).then(
          (img) => {
            const r = coverRect(c.width, c.height);
            c.getContext("2d")?.drawImage(img, r.x, r.y, r.w, r.h);
            t.needsUpdate = true;
          },
          () => {
            // Keep the flat placeholder.
          },
        );
      }

      return t;
    });
  }, [covers]);

  useEffect(() => {
    return () => {
      for (const t of new Set(contentTextures)) t.dispose();
    };
  }, [contentTextures]);

  useFrame(() => {
    // Continuous carousel position, in books: the centred index plus how
    // far it is towards its neighbour.
    const count = contentTextures.length;
    const position = (centeredIndexRef.current ?? 0) + (transitionRef.current ?? 0);
    const base = Math.floor(position);
    const t = position - base;

    // Page 0 shows book `base`, page 1 the next one. At t = 0 page 0 is
    // centred; as the auto-rotation walks the position down, the current
    // book exits to the right and the next one enters from the left — the
    // same direction the books behind the phone turn.
    for (let i = 0; i < 2; i++) {
      const page = pageRefs.current[i];
      if (!page) continue;
      const book = (((base + i) % count) + count) % count;
      const material = page.material as THREE.MeshBasicMaterial;
      if (pageBooksRef.current[i] !== book) {
        pageBooksRef.current[i] = book;
        material.map = contentTextures[book] ?? null;
        material.needsUpdate = true;
      }
      const x = (i - t) * PAGE_STRIDE;
      page.position.x = x;
      // A slight tilt mid-slide, flat at rest — both centred and waiting
      // off-screen, where a tilt would swing a corner into view.
      page.rotation.z = -Math.sin((Math.PI * x) / PAGE_STRIDE) * 0.1;
    }
  });

  return (
    <>
      {[0, 1].map((i) => (
        <mesh
          key={i}
          ref={(el: THREE.Mesh | null) => {
            pageRefs.current[i] = el;
          }}
        >
          <planeGeometry args={[ORTHO_HALF_W * 2, ORTHO_HALF_H * 2]} />
          <meshBasicMaterial transparent toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}
