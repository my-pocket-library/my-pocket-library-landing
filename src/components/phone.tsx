"use client";

import { PerspectiveCamera, RenderTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { type BookCover, paintCover } from "./book";
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
// the app-UI canvas maps 1:1 with no stretch, and a world-to-inner conversion
// factor that keeps the sliding book in lockstep with the outer carousel.
// ============================================================================

const SCREEN_ASPECT = SCREEN_W / SCREEN_H;
const ORTHO_HALF_H = 1.05;
const ORTHO_HALF_W = ORTHO_HALF_H * SCREEN_ASPECT;
const FBO_H = 1024;
const FBO_W = Math.round(FBO_H * SCREEN_ASPECT);

const PHONE_HALF_W_WORLD = SCREEN_W / 2;
const WORLD_TO_INNER = ORTHO_HALF_W / PHONE_HALF_W_WORLD;

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
 * App shell — painted once. Status bar (9:41 + signal/wifi/battery icons) and
 * the "My Library" header with chevron. Sits behind the per-book content so
 * the chrome stays put while the book slides through.
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
  ctx.fillStyle = "#0c0c0c";
  ctx.font = `700 ${H * 0.022}px -apple-system, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("9:41", W * 0.10, sbY);

  // Right-side cluster: signal bars, wifi arc, battery
  const rightX = W * 0.90;

  // Battery (outline + fill + cap)
  const battW = W * 0.085;
  const battH = H * 0.013;
  ctx.strokeStyle = "#0c0c0c";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(rightX - battW, sbY - battH / 2, battW, battH);
  ctx.fillStyle = "#0c0c0c";
  ctx.fillRect(
    rightX - battW + 1.5,
    sbY - battH / 2 + 1.5,
    battW * 0.7 - 1.5,
    battH - 3,
  );
  ctx.fillRect(rightX, sbY - battH / 4, 2, battH / 2);

  // Wifi (3 stacked arcs)
  const wifiX = rightX - battW - W * 0.045;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(
      wifiX,
      sbY + battH / 2,
      (i + 1) * W * 0.011,
      Math.PI * 1.18,
      Math.PI * 1.82,
    );
    ctx.strokeStyle = "#0c0c0c";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Signal bars (4 increasing bars)
  const sigBaseX = wifiX - W * 0.065;
  for (let i = 0; i < 4; i++) {
    const bw = W * 0.008;
    const bh = 4 + i * 4;
    ctx.fillStyle = "#0c0c0c";
    ctx.fillRect(sigBaseX + i * (bw + 2), sbY + battH / 2 - bh, bw, bh);
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

/**
 * Per-book content — cover artwork with drop shadow + white rounded info card
 * containing the title and author. Drawn on a transparent canvas so it can
 * slide over the static app shell.
 */
function paintBookContent(canvas: HTMLCanvasElement, cover: BookCover) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  // Cover image — paint a high-res version, then draw it at display size
  // so the embossed pattern reads cleanly at FBO resolution.
  const coverCanvas = document.createElement("canvas");
  coverCanvas.width = 512;
  coverCanvas.height = 768;
  paintCover(coverCanvas, cover, 1);

  const coverDispW = W * 0.55;
  const coverDispH = coverDispW * (768 / 512); // book aspect
  const coverX = (W - coverDispW) / 2;
  const coverY = H * 0.20;

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

  ctx.drawImage(coverCanvas, coverX, coverY, coverDispW, coverDispH);

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
  centeredIndexRef: RefObject<number>;
  transitionRef: RefObject<number>;
};

export function Phone({
  covers,
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

  // Live transform driven by PARAMS so the tweakpane can move/scale the
  // phone without re-renders.
  useFrame(() => {
    const g = rootRef.current;
    if (!g) return;
    g.visible = PARAMS.phoneEnabled;
    if (!g.visible) return;
    g.position.set(PARAMS.phoneX, PARAMS.phoneY, PARAMS.phoneZ);
    g.rotation.set(PARAMS.phoneRotX, PARAMS.phoneRotY, PARAMS.phoneRotZ);
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

function BookContent({
  covers,
  centeredIndexRef,
  transitionRef,
}: {
  covers: BookCover[];
  centeredIndexRef: RefObject<number>;
  transitionRef: RefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const currentIdxRef = useRef<number>(-1);

  // Pre-build all per-book content textures up front so the swap on index
  // change is a pointer assignment — no allocation, no GPU upload mid-frame.
  const contentTextures = useMemo<(THREE.CanvasTexture | null)[]>(() => {
    if (typeof document === "undefined") return covers.map(() => null);
    return covers.map((cover) => {
      const c = document.createElement("canvas");
      c.width = FBO_W;
      c.height = FBO_H;
      paintBookContent(c, cover);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    });
  }, [covers]);

  useEffect(() => {
    return () => {
      for (const t of contentTextures) t?.dispose();
    };
  }, [contentTextures]);

  useFrame(() => {
    const g = groupRef.current;
    const mat = materialRef.current;
    if (!g || !mat) return;

    // Swap the active book's content texture if the carousel's centered
    // index changed since the last frame.
    const idx = centeredIndexRef.current ?? 0;
    if (idx !== currentIdxRef.current) {
      currentIdxRef.current = idx;
      mat.map = contentTextures[idx] ?? null;
      mat.needsUpdate = true;
    }

    // Slide using the SAME world-x formula the outer carousel uses for its
    // centered book, just rescaled into inner-ortho space — so the inner
    // content reaches the screen edge at the same `frac` value the outer
    // book does, in the same sinusoidal curve.
    const frac = transitionRef.current ?? 0;
    const count = covers.length;
    const angleStep = (Math.PI * 2) / count;
    const outerWorldX = -Math.sin(frac * angleStep) * PARAMS.circleRadius;
    g.position.x = outerWorldX * WORLD_TO_INNER;
    g.rotation.z = frac * 0.12;
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <planeGeometry args={[ORTHO_HALF_W * 2, ORTHO_HALF_H * 2]} />
        <meshBasicMaterial
          ref={materialRef}
          transparent
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
