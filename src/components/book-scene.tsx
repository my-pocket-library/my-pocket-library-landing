"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Outline } from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import {
  type RefObject,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import Core from "smooothy";
import * as THREE from "three";
import { Book, type BookCover } from "./book";
import { CosmicCompass } from "./cosmic-compass";
import { SparkleEmitter } from "./sparkle-emitter";
import { PARAMS } from "@/lib/scene-params";

const COVERS: BookCover[] = [
  {
    title: "On the Feast",
    author: "L. Mysteries",
    baseColor: "#efe1d4",
    accent: "#7a4a39",
    ink: "#2a1f1a",
    pattern: "emblem",
  },
  {
    title: "Rafael Okonkwo",
    author: "a novel",
    baseColor: "#f0c8cf",
    accent: "#7a2435",
    ink: "#3b1018",
    pattern: "ornate",
  },
  {
    title: "The Garden of Flowers",
    baseColor: "#1c3a2b",
    accent: "#c9a35a",
    ink: "#e8d6a8",
    pattern: "ornate",
  },
  {
    title: "When the Sky is Rising",
    baseColor: "#f1e7d2",
    accent: "#1e2a3a",
    ink: "#1e2a3a",
    pattern: "plain",
  },
  {
    title: "Above the Clouds",
    author: "Albert Camus",
    baseColor: "#f5e9c8",
    accent: "#7b8a55",
    ink: "#2c3014",
    pattern: "plain",
  },
  {
    title: "Eleanor Vance",
    author: "Winner of the Booker Prize",
    baseColor: "#1f4a8a",
    accent: "#f5e9c8",
    ink: "#f5e9c8",
    pattern: "stripe",
  },
  {
    title: "The Last Ghost",
    baseColor: "#0c0c0c",
    accent: "#e8c84a",
    ink: "#e8c84a",
    pattern: "plain",
  },
  {
    title: "The Quiet Hour",
    baseColor: "#f5ecd6",
    accent: "#3a3a3a",
    ink: "#1a1a1a",
    pattern: "plain",
  },
  {
    title: "Watcher of the Peaks",
    author: "Conrad Vale",
    baseColor: "#c8543b",
    accent: "#f3dcc6",
    ink: "#f7e9d6",
    pattern: "swirl",
  },
  {
    title: "Where the Oranges Bloom",
    author: "Adela Marchetti",
    baseColor: "#c9651f",
    accent: "#f4e1c4",
    ink: "#f7ead4",
    pattern: "ornate",
  },
  {
    title: "The R",
    baseColor: "#e8dcc4",
    accent: "#3a2a1a",
    ink: "#2a1a10",
    pattern: "plain",
  },
  {
    title: "Codex Nocturne",
    baseColor: "#0e0e12",
    accent: "#c9a35a",
    ink: "#d8bf86",
    pattern: "ornate",
  },
  {
    title: "The Gorgon Medusa",
    baseColor: "#1d4540",
    accent: "#dec07a",
    ink: "#ead49a",
    pattern: "emblem",
  },
  {
    title: "The Lantern and the Dragon",
    baseColor: "#1a2c5a",
    accent: "#e9d27a",
    ink: "#f1e2a4",
    pattern: "stars",
  },
];

const SLIDE_PX = 220;

// Animation timings for the "open / inspect a book" flow.
// SELECT/RETURN must outlast the fade wave: stagger × (count-2) + fade.
const SELECT_DURATION = 1.1; // s — fade-out wave + travel to center
const RETURN_DURATION = 1.1; // s — reverse
const STAGGER_PER_RING_STEP = 0.05; // s between successive book fade-starts
const FADE_DURATION = 0.28; // s per book's own fade
const HOVER_LIFT = 0.18; // world units a hovered book lifts upward

export type SelectionPhase = "idle" | "selecting" | "centered" | "returning";

export type SelectionState = {
  hoveredIndex: number | null;
  selectedIndex: number | null;
  phase: SelectionPhase;
  /** Clock time (state.clock.elapsedTime) when the current phase began.
   *  Used by the fade-wave calculation — DO NOT reset on phase transitions
   *  through "centered", or the wave will restart. */
  phaseStart: number;
  /** Separate clock for the "centered" floating wobble so we can reset its
   *  phase to 0 without disturbing the fade timeline. */
  centeredAt: number | null;
};

// Shortest-arc angle lerp so books don't spin the long way around when
// returning to / from the camera-facing rotation.
function lerpAngle(from: number, to: number, t: number): number {
  const TWO_PI = Math.PI * 2;
  let diff = (to - from) % TWO_PI;
  if (diff > Math.PI) diff -= TWO_PI;
  if (diff < -Math.PI) diff += TWO_PI;
  return from + diff * t;
}

// Compute where a centered book should sit — a few units in front of the
// camera, along its view direction toward the carousel center.
function computeCenterPosition(
  camera: THREE.Camera,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  const lookAt = new THREE.Vector3(0, -0.2, 0);
  const viewDir = lookAt.clone().sub(camera.position).normalize();
  return out.copy(camera.position).addScaledVector(viewDir, 4);
}

type BooksProps = {
  sliderRef: RefObject<Core | null>;
  onMeshesReady?: (objects: THREE.Object3D[]) => void;
  selectionRef: RefObject<SelectionState>;
  opacityRefs: RefObject<RefObject<number>[]>;
  wireframeOpacityRefs: RefObject<RefObject<number>[]>;
  /** Normalized cursor position over the scene container, [-1, 1] each axis.
   *  Drives the centered book's parallax yaw/pitch. */
  mouseRef: RefObject<{ x: number; y: number }>;
  /** Shared centering progress (0..1). Written by Books, read by MaskPlane. */
  centerLerpRef: RefObject<number>;
};

function Books({
  sliderRef,
  onMeshesReady,
  selectionRef,
  opacityRefs,
  wireframeOpacityRefs,
  mouseRef,
  centerLerpRef,
}: BooksProps) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const reportedRef = useRef(false);

  // Per-book lerps for hover lift and stagger fade.
  const hoverLerpsRef = useRef<number[]>(new Array(COVERS.length).fill(0));
  const fadeLerpsRef = useRef<number[]>(new Array(COVERS.length).fill(1));
  // Mouse-influence rotation lerp for the centered book.
  const mouseLerpRef = useRef({ x: 0, y: 0 });

  const { camera } = useThree();
  const centerPosV = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    if (!reportedRef.current && onMeshesReady) {
      const all = refs.current.filter(
        (n): n is THREE.Group => n !== null,
      );
      if (all.length === COVERS.length) {
        // Tag each group with its book index so the raycaster can find it
        // when walking up from a hit mesh to its book group.
        all.forEach((g, i) => {
          g.userData.bookIndex = i;
        });
        reportedRef.current = true;
        onMeshesReady(all);
      }
    }
    const slider = sliderRef.current;
    if (slider) {
      slider.config.lerpFactor = PARAMS.lerpFactor;
      slider.config.dragSensitivity = PARAMS.dragSensitivity;
      slider.config.scrollSensitivity = PARAMS.scrollSensitivity;
      slider.config.speedDecay = PARAMS.speedDecay;
      slider.snap = PARAMS.snap;
      slider.update();
    }

    const t = state.clock.elapsedTime;
    const sel = selectionRef.current;

    // -----------------------------------------------------------------
    // Selection state machine: advance phase when the visible animation
    // (center lerp + stagger wave) has settled.
    // -----------------------------------------------------------------
    if (sel.phase === "selecting") {
      const elapsed = t - sel.phaseStart;
      if (elapsed > SELECT_DURATION && centerLerpRef.current > 0.99) {
        sel.phase = "centered";
        // Float wobble gets its own clock starting at 0 so the wobble eases
        // in instead of snapping to a random phase. The fade calculation
        // continues using the original phaseStart so it doesn't re-trigger.
        sel.centeredAt = t;
      }
    } else if (sel.phase === "returning") {
      const elapsed = t - sel.phaseStart;
      if (elapsed > RETURN_DURATION && centerLerpRef.current < 0.01) {
        sel.phase = "idle";
        sel.selectedIndex = null;
        sel.centeredAt = null;
      }
    }

    // Single lerp drives the carousel↔center morph. Damped (not sin-eased)
    // so it always settles regardless of frame rate fluctuations.
    const targetCenter =
      sel.phase === "selecting" || sel.phase === "centered" ? 1 : 0;
    centerLerpRef.current = THREE.MathUtils.damp(
      centerLerpRef.current,
      targetCenter,
      4,
      delta,
    );

    // Mouse-parallax target rotation for the centered book — only meaningful
    // while we're at / near the centered phase. The cwSmooth multiplier later
    // is already baked in via this gate.
    const m = mouseRef.current;
    const gated = sel.selectedIndex !== null ? 1 : 0;
    const targetMouseRy = -m.x * 0.45 * gated; // mouse right → see right side
    const targetMouseRx = m.y * 0.3 * gated; // mouse up → see top
    mouseLerpRef.current.x = THREE.MathUtils.damp(
      mouseLerpRef.current.x,
      targetMouseRy,
      7,
      delta,
    );
    mouseLerpRef.current.y = THREE.MathUtils.damp(
      mouseLerpRef.current.y,
      targetMouseRx,
      7,
      delta,
    );

    // -----------------------------------------------------------------
    // Carousel layout — same as before.
    // -----------------------------------------------------------------
    const count = COVERS.length;
    const angleStep = (Math.PI * 2) / count;
    const R = PARAMS.circleRadius;
    const offsetAngle = slider ? slider.current * angleStep : 0;

    // Where the selected book should end up (a few units in front of camera).
    computeCenterPosition(camera, centerPosV.current);
    const cw = centerLerpRef.current;
    const cwSmooth = cw * cw * (3 - 2 * cw); // smoothstep for nicer easing

    for (let i = 0; i < count; i++) {
      const node = refs.current[i];
      if (!node) continue;

      const angle = i * angleStep - offsetAngle;
      let x = Math.sin(angle) * R;
      let z = Math.cos(angle) * R;
      const bob = Math.sin(t * PARAMS.bobSpeed + i * 0.6) * PARAMS.bobAmount;
      const arcY = Math.sin(angle * 2) * PARAMS.arcDepth * 0.15;
      let y = -0.4 + bob + arcY;
      const baseRy =
        angle +
        PARAMS.rotationY +
        Math.sin(i * 1.31 + t * 0.1) * PARAMS.rotationVariance;
      const baseRz =
        (Math.sin(i * 1.7) * Math.PI) / 200 +
        Math.sin(t * 0.5 + i * 0.4) * 0.01;

      // -----------------------------------------------------------------
      // Hover lerp: lift the hovered book on +Y. Suppressed unless we're
      // in the idle phase (so the wave doesn't fight the user's hover).
      // -----------------------------------------------------------------
      const isHovered =
        sel.hoveredIndex === i && sel.phase === "idle";
      hoverLerpsRef.current[i] = THREE.MathUtils.damp(
        hoverLerpsRef.current[i],
        isHovered ? 1 : 0,
        10,
        delta,
      );
      y += hoverLerpsRef.current[i] * HOVER_LIFT;

      // -----------------------------------------------------------------
      // Fade: directional stagger starting at the previous book of the
      // selected one, sweeping around the ring (i-1, i-2, …, wrap, …, i+1).
      // step=0 is the immediate previous book, step=count-2 is the next book.
      // -----------------------------------------------------------------
      let targetFade = 1;
      if (sel.selectedIndex !== null && i !== sel.selectedIndex) {
        const step = (sel.selectedIndex - 1 - i + count) % count;
        const delay = step * STAGGER_PER_RING_STEP;
        const progress = Math.min(
          1,
          Math.max(0, t - sel.phaseStart - delay) / FADE_DURATION,
        );
        if (sel.phase === "selecting" || sel.phase === "centered") {
          targetFade = 1 - progress; // fade out over progress
        } else if (sel.phase === "returning") {
          targetFade = progress; // fade back in over progress
        }
      }
      // High-rate damp — basically follows the linear progress curve but
      // absorbs the discontinuity when the user switches selection mid-wave
      // (a previously-faded book that becomes the new selection-neighbor
      // smoothly catches up to its new target instead of snapping).
      fadeLerpsRef.current[i] = THREE.MathUtils.damp(
        fadeLerpsRef.current[i],
        targetFade,
        30,
        delta,
      );
      const opRef = opacityRefs.current?.[i];
      if (opRef) opRef.current = fadeLerpsRef.current[i];

      // -----------------------------------------------------------------
      // Wireframe overlay: visible only when this is the selected book and
      // the center lerp is alive. Driven per-frame so Book can apply it to
      // its overlay-mesh material without React re-renders.
      // -----------------------------------------------------------------
      const wfRef = wireframeOpacityRefs.current?.[i];
      if (wfRef) {
        wfRef.current = sel.selectedIndex === i ? cwSmooth : 0;
      }

      // -----------------------------------------------------------------
      // Selected book: lerp position toward centerPos and rotation toward
      // facing the camera (+Z aligned to world +Z = toward the camera).
      // After the lerp settles, add a magical floating wobble AND a
      // mouse-driven yaw/pitch so the book follows the cursor like a 3D
      // inspector view.
      // -----------------------------------------------------------------
      let rx = 0;
      let ry = baseRy;
      let rz = baseRz;
      if (sel.selectedIndex === i && cwSmooth > 0.001) {
        const cp = centerPosV.current;
        x = THREE.MathUtils.lerp(x, cp.x, cwSmooth);
        y = THREE.MathUtils.lerp(y, cp.y, cwSmooth);
        z = THREE.MathUtils.lerp(z, cp.z, cwSmooth);
        ry = lerpAngle(baseRy, 0, cwSmooth);
        rz = baseRz * (1 - cwSmooth);

        if (sel.phase === "centered" && sel.centeredAt !== null) {
          const tf = t - sel.centeredAt;
          // Ease the wobble amplitude up over the first 0.3s after arrival
          // so it doesn't pop on.
          const amp = Math.min(1, tf / 0.3);
          y += Math.sin(tf * 1.4) * 0.04 * amp;
          ry += Math.sin(tf * 0.7) * 0.05 * amp;
        }

        // Mouse parallax. Scale by cwSmooth so the rotation only kicks in
        // as the book settles toward the centered position; otherwise the
        // book would jolt mid-flight if the cursor was off-center.
        ry += mouseLerpRef.current.x * cwSmooth;
        rx = mouseLerpRef.current.y * cwSmooth;
      }

      node.position.set(x, y, z);
      node.rotation.set(rx, ry, rz);

      // Per-book aspect-ratio variance.
      const sx = 1 + Math.sin(i * 1.93) * 0.1 + Math.cos(i * 0.71) * 0.06;
      const sy = 1 + Math.cos(i * 1.41) * 0.14 + Math.sin(i * 0.83) * 0.06;
      const sz = 1 + Math.sin(i * 2.71) * 0.22 + Math.cos(i * 0.31) * 0.1;
      node.scale.set(sx, sy, sz);
    }
  });

  return (
    <group>
      {COVERS.map((cover, i) => (
        <group
          key={i}
          ref={(el: THREE.Group | null) => {
            refs.current[i] = el;
          }}
        >
          <Book
            cover={cover}
            index={i}
            opacityRef={opacityRefs.current?.[i]}
            wireframeOpacityRef={wireframeOpacityRefs.current?.[i]}
          />
        </group>
      ))}
    </group>
  );
}

function CameraRig() {
  const { camera } = useThree();
  useFrame(() => {
    camera.position.set(PARAMS.camX, PARAMS.camY, PARAMS.camZ);
    if ("fov" in camera) {
      const persp = camera as THREE.PerspectiveCamera;
      if (persp.fov !== PARAMS.fov) {
        persp.fov = PARAMS.fov;
        persp.updateProjectionMatrix();
      }
    }
    camera.lookAt(0, -0.2, 0);
  });
  return null;
}

function LiveLights() {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const keyRef = useRef<THREE.DirectionalLight>(null);
  const fillRef = useRef<THREE.DirectionalLight>(null);
  const rimRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    if (ambientRef.current) ambientRef.current.intensity = PARAMS.ambient;
    if (keyRef.current) {
      keyRef.current.intensity = PARAMS.keyIntensity;
      keyRef.current.position.set(PARAMS.keyX, PARAMS.keyY, PARAMS.keyZ);
    }
    if (fillRef.current) fillRef.current.intensity = PARAMS.fillIntensity;
    if (rimRef.current) rimRef.current.intensity = PARAMS.rimIntensity;
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={PARAMS.ambient} />
      <directionalLight
        ref={keyRef}
        position={[PARAMS.keyX, PARAMS.keyY, PARAMS.keyZ]}
        intensity={PARAMS.keyIntensity}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight
        ref={fillRef}
        position={[-6, 3, 2]}
        intensity={PARAMS.fillIntensity}
        color="#88aaff"
      />
      <pointLight
        ref={rimRef}
        position={[0, -2, 4]}
        intensity={PARAMS.rimIntensity}
        color="#ffd2a8"
      />
    </>
  );
}

function LiveFog() {
  const fogRef = useRef<THREE.Fog>(null);
  useFrame(() => {
    if (!fogRef.current) return;
    fogRef.current.near = PARAMS.fogNear;
    fogRef.current.far = PARAMS.fogFar;
  });
  // Match the page bg (--ana-1 ≈ #f4eee2) so distant books fade into the section.
  return (
    <fog
      ref={fogRef}
      attach="fog"
      args={["#f4eee2", PARAMS.fogNear, PARAMS.fogFar]}
    />
  );
}

// ---------------------------------------------------------------------------
// MaskPlane
//
// A screen-aligned rectangle that follows the cursor in NDC and writes
// stencilRef=1 wherever it covers. Renders first (renderOrder=1), invisible
// to the color buffer (colorWrite=false), so it just sets up the stencil
// region where downstream meshes (the book's masked fill + wireframe) are
// allowed to draw. 4 small handles render alongside it as visible UI.
// ---------------------------------------------------------------------------
const MASK_WORLD_SIZE = 0.75;
const MASK_DISTANCE_FROM_CAMERA = 4;
const HANDLE_SIZE = 0.05;

type MaskPlaneProps = {
  mouseRef: RefObject<{ x: number; y: number }>;
  centerLerpRef: RefObject<number>;
  selectionRef: RefObject<SelectionState>;
};

function MaskPlane({
  mouseRef,
  centerLerpRef,
  selectionRef,
}: MaskPlaneProps) {
  const { camera } = useThree();
  const rootRef = useRef<THREE.Group>(null);
  const maskRef = useRef<THREE.Mesh>(null);
  const tmpV = useRef(new THREE.Vector3());
  const handleRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(() => {
    const root = rootRef.current;
    if (!root) return;

    const cw = centerLerpRef.current;
    const sel = selectionRef.current;
    const visible = sel.selectedIndex !== null && cw > 0.001;
    root.visible = visible;
    if (!visible) return;

    // Project the cursor into world space at a fixed distance ahead of the
    // camera. The mask stays the same physical size on screen and follows
    // the cursor 1:1 (no smoothing — it's a UI element, not a tracker).
    const m = mouseRef.current;
    const v = tmpV.current.set(m.x, m.y, 0.5).unproject(camera);
    v.sub(camera.position).normalize();
    root.position
      .copy(camera.position)
      .addScaledVector(v, MASK_DISTANCE_FROM_CAMERA);
    root.lookAt(camera.position);
    root.scale.setScalar(cw); // scale in/out with the selection transition
  });

  return (
    <group ref={rootRef} visible={false}>
      {/* Invisible stencil writer — every fragment under the mask writes
       *  stencilRef=1 so the masked fill / wireframe can render only here. */}
      <mesh ref={maskRef} renderOrder={1}>
        <planeGeometry args={[MASK_WORLD_SIZE, MASK_WORLD_SIZE]} />
        <meshBasicMaterial
          colorWrite={false}
          depthWrite={false}
          depthTest={false}
          stencilWrite
          stencilFunc={THREE.AlwaysStencilFunc}
          stencilRef={1}
          stencilZPass={THREE.ReplaceStencilOp}
          stencilFail={THREE.ReplaceStencilOp}
          stencilZFail={THREE.ReplaceStencilOp}
        />
      </mesh>

      {/* 4 corner handles — the "selection-box" UI dressing. */}
      {[
        [-1, 1],
        [1, 1],
        [-1, -1],
        [1, -1],
      ].map(([sx, sy], i) => (
        <mesh
          key={i}
          ref={(el: THREE.Mesh | null) => {
            handleRefs.current[i] = el;
          }}
          position={[
            (sx * MASK_WORLD_SIZE) / 2,
            (sy * MASK_WORLD_SIZE) / 2,
            0.001,
          ]}
          renderOrder={5}
        >
          <planeGeometry args={[HANDLE_SIZE, HANDLE_SIZE]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.9}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// SelectionController
//
// Lives inside the Canvas (so it can access the R3F camera via useThree) but
// attaches its DOM listeners to the smooothy host div that sits *above* the
// canvas in the DOM. That's the only element that actually receives pointer
// events — the canvas is pointer-events-none beneath it. We:
//
//   1. Track pointerdown so we can distinguish drags (smooothy's job) from
//      taps (our job). A drag = move > DRAG_THRESHOLD between down and up.
//   2. On move, raycast and update `selectionRef.hoveredIndex`.
//   3. On click (no drag), raycast and toggle `selectedIndex` / `phase`.
//   4. Pause / resume smooothy whenever a book is selected so the carousel
//      doesn't drift while a book is centered.
// ---------------------------------------------------------------------------
const DRAG_THRESHOLD = 6;

type SelectionControllerProps = {
  hostRef: RefObject<HTMLDivElement | null>;
  bookObjectsRef: RefObject<THREE.Object3D[]>;
  selectionRef: RefObject<SelectionState>;
  sliderRef: RefObject<Core | null>;
  mouseRef: RefObject<{ x: number; y: number }>;
};

function SelectionController({
  hostRef,
  bookObjectsRef,
  selectionRef,
  sliderRef,
  mouseRef,
}: SelectionControllerProps) {
  const { camera, clock } = useThree();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    let didDrag = false;

    const ndcFromEvent = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      return ndc;
    };

    const hitTestBookIndex = (e: PointerEvent): number | null => {
      const objs = bookObjectsRef.current;
      if (!objs || objs.length === 0) return null;
      const sel = selectionRef.current;
      // During any non-idle phase, the only book that should be clickable
      // is the centered one. Restricting the raycast candidates means a
      // pointer over a fading/faded book registers as a miss, and the
      // onClick handler treats it as background.
      const candidates =
        sel.phase !== "idle" && sel.selectedIndex !== null
          ? [objs[sel.selectedIndex]]
          : objs;
      raycaster.setFromCamera(ndcFromEvent(e), camera);
      const hits = raycaster.intersectObjects(candidates, true);
      if (hits.length === 0) return null;
      // Walk up parents until we find the group we tagged with bookIndex.
      let obj: THREE.Object3D | null = hits[0].object;
      while (obj) {
        if (typeof obj.userData.bookIndex === "number") {
          return obj.userData.bookIndex;
        }
        obj = obj.parent;
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
      didDrag = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.buttons > 0) {
        if (
          Math.abs(e.clientX - downX) > DRAG_THRESHOLD ||
          Math.abs(e.clientY - downY) > DRAG_THRESHOLD
        ) {
          didDrag = true;
        }
      }

      // Normalized cursor position for the centered-book parallax (-1..1).
      // y is flipped so +1 is the top of the viewport, matching NDC.
      const rect = host.getBoundingClientRect();
      mouseRef.current.x =
        ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y =
        -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Only update hover state when we're not in the middle of a selection
      // animation — keeps hovered ghosts from appearing during the fade.
      const sel = selectionRef.current;
      if (sel.phase !== "idle") {
        if (sel.hoveredIndex !== null) sel.hoveredIndex = null;
        return;
      }
      sel.hoveredIndex = hitTestBookIndex(e);
    };

    const onClick = (e: PointerEvent) => {
      if (didDrag) return; // was a drag — let smooothy own it
      const sel = selectionRef.current;
      const hit = hitTestBookIndex(e);
      // Use the R3F clock so phaseStart lives in the same time scale as the
      // `t = state.clock.elapsedTime` used inside useFrame for fade progress.
      const now = clock.elapsedTime;

      if (sel.phase === "idle") {
        // From the carousel: clicking a book selects it. Clicking empty
        // space is a no-op.
        if (hit !== null) {
          sel.selectedIndex = hit;
          sel.hoveredIndex = null;
          sel.phase = "selecting";
          sel.phaseStart = now;
          sel.centeredAt = null;
          if (sliderRef.current) sliderRef.current.paused = true;
        }
        return;
      }

      // Non-idle: faded books aren't valid click targets (filtered out in
      // hitTestBookIndex). Any click during selecting/centered/returning
      // returns to the carousel — selecting a different book would require
      // a re-click after the wave plays out.
      if (sel.phase !== "returning") {
        sel.phase = "returning";
        sel.phaseStart = now;
        sel.centeredAt = null;
        if (sliderRef.current) sliderRef.current.paused = false;
      }
    };

    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("click", onClick);
    return () => {
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("click", onClick);
    };
  }, [
    camera,
    clock,
    hostRef,
    bookObjectsRef,
    selectionRef,
    sliderRef,
    mouseRef,
  ]);

  return null;
}

type BookSceneProps = {
  /** Bump to force a re-render when post-processing toggles change. */
  postVersion?: number;
};

export function BookScene({ postVersion = 0 }: BookSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<Core | null>(null);
  const [bookObjects, setBookObjects] = useState<THREE.Object3D[]>([]);
  // Read once per render so toggling them via tweakpane re-mounts the composer.
  const outlineOn = PARAMS.celOutline;
  // postVersion is the trigger for re-renders; reference it so React keeps it.
  void postVersion;

  // Selection state shared between SelectionController (writes on input) and
  // Books (reads per frame to animate). Plain ref — no React re-renders when
  // hover changes, which avoids costly tree updates on every mouse move.
  const selectionRef = useRef<SelectionState>({
    hoveredIndex: null,
    selectedIndex: null,
    phase: "idle",
    phaseStart: 0,
    centeredAt: null,
  });

  // One scalar ref per book — written by Books each frame, read by each Book
  // to apply opacity to its materials. Avoids prop-drilling state changes.
  const opacityRefs = useRef<RefObject<number>[]>(
    Array.from(
      { length: COVERS.length },
      () => ({ current: 1 }) as RefObject<number>,
    ),
  );

  // Per-book wireframe overlay opacity (0 = hidden, 1 = full overlay).
  const wireframeOpacityRefs = useRef<RefObject<number>[]>(
    Array.from(
      { length: COVERS.length },
      () => ({ current: 0 }) as RefObject<number>,
    ),
  );

  // Cursor position normalized to [-1, 1] across the scene container.
  // Drives the centered book's inspection rotation.
  const mouseRef = useRef({ x: 0, y: 0 });

  // Shared centering progress (Books damps it, MaskPlane reads it).
  const centerLerpRef = useRef<number>(0);

  // Ref version of bookObjects so the SelectionController always sees the
  // current array (state writes aren't visible until re-render).
  const bookObjectsRef = useRef<THREE.Object3D[]>([]);
  const handleMeshesReady = (objects: THREE.Object3D[]) => {
    bookObjectsRef.current = objects;
    setBookObjects(objects);
  };

  useEffect(() => {
    if (!hostRef.current) return;
    const inst = new Core(hostRef.current, {
      infinite: true,
      snap: PARAMS.snap,
      scrollInput: PARAMS.scrollInput,
      lerpFactor: PARAMS.lerpFactor,
      dragSensitivity: PARAMS.dragSensitivity,
      speedDecay: PARAMS.speedDecay,
    });
    sliderRef.current = inst;
    return () => {
      inst.destroy();
      sliderRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div
        ref={hostRef}
        data-slider
        aria-hidden
        className="absolute inset-0 z-20 flex overflow-hidden opacity-0 cursor-grab select-none touch-pan-y active:cursor-grabbing pointer-events-auto"
      >
        {COVERS.map((_, i) => (
          <div
            key={i}
            style={{ width: SLIDE_PX, flexShrink: 0, height: "100%" }}
          />
        ))}
      </div>

      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{
          position: [PARAMS.camX, PARAMS.camY, PARAMS.camZ],
          fov: PARAMS.fov,
        }}
        gl={{ antialias: true, alpha: true, stencil: true }}
        className="!absolute inset-0"
      >
        <color attach="background" args={["#f4eee2"]} />
        <LiveFog />
        <CameraRig />
        <LiveLights />

        <Suspense fallback={null}>
          <Books
            sliderRef={sliderRef}
            onMeshesReady={handleMeshesReady}
            selectionRef={selectionRef}
            opacityRefs={opacityRefs}
            wireframeOpacityRefs={wireframeOpacityRefs}
            mouseRef={mouseRef}
            centerLerpRef={centerLerpRef}
          />
          <MaskPlane
            mouseRef={mouseRef}
            centerLerpRef={centerLerpRef}
            selectionRef={selectionRef}
          />
          <SelectionController
            hostRef={hostRef}
            bookObjectsRef={bookObjectsRef}
            selectionRef={selectionRef}
            sliderRef={sliderRef}
            mouseRef={mouseRef}
          />
          <CosmicCompass />
          <SparkleEmitter />
          {outlineOn && bookObjects.length > 0 ? (
            <EffectComposer>
              <Outline
                selection={bookObjects}
                edgeStrength={PARAMS.outlineStrength * 20}
                visibleEdgeColor={0x000000}
                hiddenEdgeColor={0x000000}
                blur={false}
                xRay={false}
                kernelSize={KernelSize.VERY_SMALL}
                blendFunction={BlendFunction.ALPHA}
              />
            </EffectComposer>
          ) : null}
        </Suspense>
      </Canvas>
    </div>
  );
}
