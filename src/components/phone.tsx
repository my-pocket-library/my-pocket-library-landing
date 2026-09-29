"use client";

import { PerspectiveCamera, RenderTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { type BookCover } from "./book";
import { type IslandPlacement, ScanScreen, type ScanShared } from "./phone-screen";
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
// The same, as fractions of the screen — the status bar centres on it.
const ISLAND_ON_SCREEN: IslandPlacement = {
  centerY: (SCREEN_H / 2 - ISLAND_Y) / SCREEN_H,
  width: ISLAND_W / SCREEN_W,
};

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
// <Phone /> — phone body + screen + Dynamic Island + side buttons.
// ============================================================================

type PhoneProps = {
  covers: BookCover[];
  /** Follow the mouse. Off while the scene holds its opening frame. */
  parallax: boolean;
  /** The scan ceremony's state, written by Books each frame. */
  sharedRef: RefObject<ScanShared>;
};

export function Phone({ covers, parallax, sharedRef }: PhoneProps) {
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
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      if (halfW <= 0 || halfH <= 0) return;
      mouseRef.current.x = (e.clientX - halfW) / halfW;
      mouseRef.current.y = (e.clientY - halfH) / halfH;
      // Frames are drawn on demand: wake the loop to ease towards the cursor.
      invalidate();
    };
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, [invalidate]);

  // Live transform driven by PARAMS so the tweakpane can move/scale the
  // phone without re-renders.
  useFrame((state, rawDelta) => {
    const g = rootRef.current;
    if (!g) return;
    // The first frame after an idle stretch reports the whole pause as its
    // delta; cap it so the tilt eases instead of jumping.
    const delta = Math.min(rawDelta, 1 / 30);
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
    // Keep drawing until the tilt has caught up with the cursor.
    if (Math.abs(m.x - targetPitch) > 1e-4 || Math.abs(m.y - targetYaw) > 1e-4) {
      state.invalidate();
    }

    g.rotation.set(
      PARAMS.phoneRotX + mouseRotRef.current.x,
      PARAMS.phoneRotY + mouseRotRef.current.y,
      PARAMS.phoneRotZ,
    );
    g.scale.setScalar(PARAMS.phoneScale);
  });

  // The phone stands in front of the shelf: pointer events that hit it stop
  // here instead of reaching (and lifting or scanning) the books behind it.
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <group
      ref={rootRef}
      onPointerOver={stop}
      onPointerMove={stop}
      onClick={stop}
    >
      {/* Phone body — dark graphite metal; the studio environment gives
       *  its rounded edges soft highlights. */}
      <mesh geometry={phoneGeom}>
        <meshStandardMaterial
          color="#202026"
          roughness={0.3}
          metalness={0.9}
        />
      </mesh>

      {/* Side buttons — left: volume up + down, right: power.
       *  Centered on the body edge so they read as half-buried nubs. */}
      <mesh position={[-PHONE_W / 2, PHONE_H * 0.22, 0]}>
        <boxGeometry args={[BTN_W, BTN_VOL_H, BTN_D]} />
        <meshStandardMaterial
          color="#2a2a30"
          roughness={0.35}
          metalness={0.9}
        />
      </mesh>
      <mesh position={[-PHONE_W / 2, PHONE_H * 0.06, 0]}>
        <boxGeometry args={[BTN_W, BTN_VOL_DOWN_H, BTN_D]} />
        <meshStandardMaterial
          color="#2a2a30"
          roughness={0.35}
          metalness={0.9}
        />
      </mesh>
      <mesh position={[PHONE_W / 2, PHONE_H * 0.12, 0]}>
        <boxGeometry args={[BTN_W, BTN_PWR_H, BTN_D]} />
        <meshStandardMaterial
          color="#2a2a30"
          roughness={0.35}
          metalness={0.9}
        />
      </mesh>

      {/* Screen — rounded-rect ShapeGeometry so the screen edge follows
       *  the body's curvature. The RenderTexture inside renders the app
       *  UI scene into an FBO whose aspect matches the plane. */}
      <mesh geometry={screenGeom} position={[0, 0, SCREEN_FORWARD]}>
        <meshBasicMaterial toneMapped={false}>
          <RenderTexture attach="map" width={FBO_W} height={FBO_H}>
            <color attach="background" args={["#000000"]} />

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

            {/* The app's scan page and approval sheet, playing the scan
             *  ceremony for whichever book the carousel brings to the front. */}
            <ScanScreen
              covers={covers}
              sharedRef={sharedRef}
              width={FBO_W}
              height={FBO_H}
              halfH={ORTHO_HALF_H}
              island={ISLAND_ON_SCREEN}
            />
          </RenderTexture>
        </meshBasicMaterial>
      </mesh>

      {/* Cover glass — a faint reflection of the studio environment added
       *  over the screen. It shifts as the phone tilts, which sells the
       *  glass; black diffuse + additive blending means only the
       *  reflection shows. */}
      <mesh geometry={screenGeom} position={[0, 0, SCREEN_FORWARD + 0.002]}>
        <meshStandardMaterial
          color="#000000"
          roughness={0.15}
          metalness={0}
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
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
