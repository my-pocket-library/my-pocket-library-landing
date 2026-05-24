"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  type RefObject,
  Suspense,
  useEffect,
  useRef,
} from "react";
import Core from "smooothy";
import * as THREE from "three";
import { Book, type BookCover } from "./book";
import { Phone } from "./phone";
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

export { COVERS };

const SLIDE_PX = 220;

// Floor plane y-coordinate. Books are positioned so their bottom edge sits on
// this y value (no float, no clipping). Phone sits a fixed offset above it.
const GROUND_Y = -1.55;

// ---------------------------------------------------------------------------
// Books — auto-rotating circular carousel.
// Drag/click selection is gone; the carousel just turns at PARAMS.autoCarousel
// pace, and we expose which integer book index is currently "front-facing"
// (closest to angle 0) via the onCenteredBookChange callback so the Phone
// can sync its inner screen to the same book.
// ---------------------------------------------------------------------------

type BooksProps = {
  sliderRef: RefObject<Core | null>;
  /** Integer index of the current 'front-facing' book. Written every frame
   *  by Books's useFrame; the Phone reads it inside its own useFrame so the
   *  texture swap happens in the same frame as the position update (no
   *  one-frame React-state lag). */
  centeredIndexRef?: RefObject<number>;
  /** Subframe progress between the previous and current front books in
   *  [-0.5, +0.5]. Written every frame; the Phone reads it to animate the
   *  inner book's slide-from-left transition in sync with the carousel. */
  transitionRef?: RefObject<number>;
};

// Front-of-fan visibility. 5 books at full opacity (centre + ±2), with a
// 1-step fade band just outside the boundary so the book entering OR
// leaving the visible arc crossfades 0 → 1 instead of popping. Anything
// past the fade band is hard 0 (and culled via node.visible).
//
//   FULL_BOOKS = 5      → positions {0, ±1, ±2} always at opacity 1
//   FADE_WIDTH_BOOKS = 1 → positions {±3} fade in/out as carousel turns
const FULL_BOOKS = 5;
const FADE_WIDTH_BOOKS = 1;

/** Normalize an angle into [-π, π]. */
function wrapToPi(a: number): number {
  const TWO_PI = Math.PI * 2;
  let x = a % TWO_PI;
  if (x > Math.PI) x -= TWO_PI;
  else if (x < -Math.PI) x += TWO_PI;
  return x;
}

function Books({
  sliderRef,
  centeredIndexRef,
  transitionRef,
}: BooksProps) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  // Ref to the outer <group> wrapping all books — receives the live carousel
  // transform (translate / rotate / scale) from PARAMS each frame so the
  // tweakpane can nudge the whole ring without re-rendering.
  const carouselGroupRef = useRef<THREE.Group>(null);
  // Per-book opacity containers. Books on the front arc read 1; books behind
  // the camera read 0. Updated every frame in this component's useFrame, read
  // every frame inside each <Book>'s useFrame so the fade tracks rotation
  // without React-state lag.
  const opacityRefs = useRef<{ current: number }[]>(
    Array.from({ length: COVERS.length }, () => ({ current: 1 })),
  );
  // Accumulator that drives the integer slider.target step. Every full
  // unit of accumulator => one slider.target -= 1 nudge => one book advance.
  const autoStepAccumRef = useRef(0);

  useFrame((_, delta) => {
    // Apply carousel-group transform from PARAMS. Cheap to set every frame;
    // saves a re-render when tweakpane mutates the values.
    const cg = carouselGroupRef.current;
    if (cg) {
      cg.position.set(PARAMS.carouselX, PARAMS.carouselY, PARAMS.carouselZ);
      cg.rotation.set(
        PARAMS.carouselRotX,
        PARAMS.carouselRotY,
        PARAMS.carouselRotZ,
      );
      cg.scale.setScalar(PARAMS.carouselScale);
    }

    const slider = sliderRef.current;
    if (!slider) return;

    slider.config.lerpFactor = PARAMS.lerpFactor;
    slider.config.dragSensitivity = PARAMS.dragSensitivity;
    slider.config.scrollSensitivity = PARAMS.scrollSensitivity;
    slider.config.speedDecay = PARAMS.speedDecay;
    slider.snap = PARAMS.snap;

    // Auto-rotate: accumulate at PARAMS.autoCarouselSpeed books-per-second
    // and trigger one integer step on `target` for each full unit. smooothy
    // lerps `current` toward `target` so the steps feel continuous.
    if (PARAMS.autoCarousel && !slider.paused) {
      autoStepAccumRef.current += delta * PARAMS.autoCarouselSpeed;
      while (autoStepAccumRef.current >= 1) {
        autoStepAccumRef.current -= 1;
        slider.target -= 1;
      }
    } else {
      autoStepAccumRef.current = 0;
    }
    slider.update();

    // Determine the current "front" book (whose angle is closest to 0).
    // angle_i = i*angleStep - slider.current*angleStep
    // → angle_i ≈ 0 when (slider.current mod count) ≈ i.
    const count = COVERS.length;
    const wrapped = ((slider.current % count) + count) % count;
    const idx = Math.round(wrapped) % count;
    // Distance from the nearest integer book — 0 means perfectly aligned,
    // 0.5 means we're exactly between two books.
    const frac = wrapped - Math.round(wrapped); // [-0.5, +0.5]
    if (transitionRef) transitionRef.current = frac;
    if (centeredIndexRef) centeredIndexRef.current = idx;

    // Layout: distribute books around a horizontal circle in the xz-plane,
    // each facing outward along its radius.
    const angleStep = (Math.PI * 2) / count;
    const R = PARAMS.circleRadius;
    const offsetAngle = slider.current * angleStep;
    const t = performance.now() / 1000;

    // Front-arc opacity band, in radians. Front FULL_BOOKS = full alpha,
    // FADE_WIDTH_BOOKS = linear fade band on either side, everything past
    // that is fully invisible (and culled via node.visible).
    const fullHalf = (FULL_BOOKS / 2) * angleStep;
    const fadeWidth = FADE_WIDTH_BOOKS * angleStep;

    for (let i = 0; i < count; i++) {
      const node = refs.current[i];
      if (!node) continue;

      const angle = i * angleStep - offsetAngle;
      const x = Math.sin(angle) * R;
      const z = Math.cos(angle) * R;

      // Per-book aspect-ratio variance (stable per index). Computed first so
      // we can use sy to ground-align each book by its actual scaled height.
      const sx = 1 + Math.sin(i * 1.93) * 0.1 + Math.cos(i * 0.71) * 0.06;
      const sy = 1 + Math.cos(i * 1.41) * 0.14 + Math.sin(i * 0.83) * 0.06;
      const sz = 1 + Math.sin(i * 2.71) * 0.22 + Math.cos(i * 0.31) * 0.1;

      // Ground-align: each book's bottom edge sits on GROUND_Y (flex-end on
      // the y axis). No idle-bob animation — books stand still on the
      // floor.
      const halfH = (PARAMS.bookHeight * sy) / 2;
      const y = GROUND_Y + halfH;
      // Negate the angle component so each book's spine (its "tail" — the
      // -X local face) rotates to face the OUTER side of the fan and the
      // open edge swings toward the carousel center. Cover faces stay
      // tilted more directly toward the camera as a side-effect.
      const ry =
        -angle +
        PARAMS.rotationY +
        Math.sin(i * 1.31 + t * 0.1) * PARAMS.rotationVariance;
      const rz =
        (Math.sin(i * 1.7) * Math.PI) / 200 +
        Math.sin(t * 0.5 + i * 0.4) * 0.01;

      node.position.set(x, y, z);
      node.rotation.set(0, ry, rz);
      node.scale.set(sx, sy, sz);

      // Opacity: 1 while inside ±fullHalf, linearly down to 0 over
      // fadeWidth, then 0 beyond. fadeWidth = 0 collapses to a hard
      // cutoff (avoid division-by-zero). Wrapping the angle into
      // [-π, π] keeps the band centred on the camera-facing direction.
      const dist = Math.abs(wrapToPi(angle));
      let opacity: number;
      if (dist <= fullHalf) {
        opacity = 1;
      } else if (fadeWidth <= 0) {
        opacity = 0;
      } else {
        opacity = Math.max(0, 1 - (dist - fullHalf) / fadeWidth);
      }
      opacityRefs.current[i].current = opacity;
      // Hard cull when invisible — skips all draw calls for back-half books.
      node.visible = opacity > 0.001;
    }
  });

  return (
    <group ref={carouselGroupRef}>
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
            opacityRef={opacityRefs.current[i]}
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
    camera.lookAt(0, 0, 0);
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
  return (
    <fog
      ref={fogRef}
      attach="fog"
      args={["#f4eee2", PARAMS.fogNear, PARAMS.fogFar]}
    />
  );
}

export function BookScene() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<Core | null>(null);

  // Refs read by Phone every frame so the texture swap + slide stay in
  // perfect lockstep with the carousel (no React-state-vs-useFrame race).
  const centeredIndexRef = useRef<number>(0);
  const transitionRef = useRef<number>(0);

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
      {/* Invisible smooothy host. Carousel is driven entirely by the per-frame
       *  target nudge inside Books's useFrame; we still need a DOM wrapper
       *  for Core to read measurements from. */}
      <div
        ref={hostRef}
        data-slider
        aria-hidden
        className="absolute inset-0 z-0 flex overflow-hidden opacity-0 pointer-events-none"
      >
        {COVERS.map((_, i) => (
          <div
            key={i}
            style={{ width: SLIDE_PX, flexShrink: 0, height: "100%" }}
          />
        ))}
      </div>

      <Canvas
        dpr={[1, 2]}
        camera={{
          position: [PARAMS.camX, PARAMS.camY, PARAMS.camZ],
          fov: PARAMS.fov,
        }}
        gl={{ antialias: true, alpha: true }}
        className="!absolute inset-0"
      >
        <color attach="background" args={["#f4eee2"]} />
        <LiveFog />
        <CameraRig />
        <LiveLights />

        <Suspense fallback={null}>
          <Books
            sliderRef={sliderRef}
            centeredIndexRef={centeredIndexRef}
            transitionRef={transitionRef}
          />
          <Phone
            covers={COVERS}
            centeredIndexRef={centeredIndexRef}
            transitionRef={transitionRef}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
