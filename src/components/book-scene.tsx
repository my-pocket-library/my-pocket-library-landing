"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  type RefObject,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Book, type BookCover, loadCoverImage } from "./book";
import { Phone } from "./phone";
import { onFrameRequest } from "@/lib/scene-frame";
import { PARAMS } from "@/lib/scene-params";
import { cn } from "@/lib/utils";

// 9 real, image-backed books. The COVERS array below repeats this list
// twice so the carousel has 18 entries — each duplicate sits 180° from
// its sibling, so duplicates are never visible on-screen at the same
// time (only the front ~5 books are rendered with opacity 1). Duplicates
// are the same objects, so they share textures (see book.tsx).
const BOOKS: BookCover[] = [
  {
    title: "The Trial",
    author: "Franz Kafka",
    baseColor: "#1a1a1a",
    accent: "#c4a052",
    ink: "#e8d49a",
    pattern: "plain",
    image: "/images/the-trial.jpg",
  },
  {
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    baseColor: "#1f3a2a",
    accent: "#c9a35a",
    ink: "#e8d6a8",
    pattern: "ornate",
    image: "/images/the-hobbit.jpg",
  },
  {
    title: "The Catcher in the Rye",
    author: "J.D. Salinger",
    baseColor: "#8a1f1f",
    accent: "#f5e7c8",
    ink: "#f7eddd",
    pattern: "plain",
    image: "/images/the-catcher-in-the-rye.jpg",
  },
  {
    title: "Intermezzo",
    author: "Sally Rooney",
    baseColor: "#e8c84a",
    accent: "#1a1a1a",
    ink: "#1a1a1a",
    pattern: "plain",
    image: "/images/intermezzo.jpg",
  },
  {
    title: "Atomic Habits",
    author: "James Clear",
    baseColor: "#f4a821",
    accent: "#1a1a1a",
    ink: "#1a1a1a",
    pattern: "plain",
    image: "/images/atomic-habits.jpg",
  },
  {
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    // Iconic Francis Cugat dark-blue + orange/yellow palette.
    baseColor: "#16264a",
    accent: "#e8a23c",
    ink: "#f5d089",
    pattern: "plain",
    image: "/images/the-great-gatsby.jpg",
  },
  {
    title: "Rüyaların Çağrısı",
    author: "Katia Haviters",
    baseColor: "#2a3d5c",
    accent: "#d4b87a",
    ink: "#ead49a",
    pattern: "plain",
    image: "/images/ruyalarin-cagrisi.jpg",
  },
  {
    title: "It",
    author: "Stephen King",
    // Pennywise red on near-white — matches the classic mass-market jacket.
    baseColor: "#f4ede0",
    accent: "#c8331f",
    ink: "#a52419",
    pattern: "plain",
    image: "/images/it.jpg",
  },
  {
    title: "Sapiens",
    author: "Yuval Noah Harari",
    // Cream cover with red thumbprint accent — Harari's English edition.
    baseColor: "#efe4c8",
    accent: "#9c2018",
    ink: "#1a1a1a",
    pattern: "plain",
    image: "/images/sapiens.jpg",
  },
];

const COVERS: BookCover[] = [...BOOKS, ...BOOKS];

export { COVERS };

// Floor plane y-coordinate. Books are positioned so their bottom edge sits on
// this y value (no float, no clipping). Phone sits a fixed offset above it.
const GROUND_Y = -1.55;

// Longest frame step the carousel will integrate, and the step used for the
// first frame after an idle stretch (whose raw delta spans the whole pause).
const MAX_FRAME_DELTA = 0.1;
const RESUME_DELTA = 1 / 60;

// The ease stops (and the scene goes idle) once the carousel is this close
// to its target, in books. One book step moves a front book ~150 px, so
// this is about a third of a pixel — without it, the exponential tail would
// keep drawing invisible motion for another couple of seconds.
const SETTLE_EPSILON = 2e-3;

// The scene fades in once cover images have loaded, or after this long
// regardless (slow connections still get the scene, with flat covers that
// fill in as images arrive).
const COVER_WAIT_MS = 1500;

// Length of the fade over the poster (matches the wrapper's duration-700).
// The scene holds its opening frame until the fade is done, so it lines up
// with the poster the whole way through.
const FADE_MS = 700;

// ---------------------------------------------------------------------------
// Books — auto-advancing circular carousel.
//
// The carousel position is a number of books: the target steps down by one
// every 1 / autoCarouselSpeed seconds and the position eases toward it with
// a time constant of lerpFactor seconds. The scene renders on demand, so
// frames are requested only while the position is still easing; between
// steps a timer wakes the loop for the next one. Books exposes the centred
// book and the progress towards its neighbour through refs, which the Phone
// reads in the same frame to sync its screen.
// ---------------------------------------------------------------------------

type BooksProps = {
  /** False holds the opening frame — no auto-advance — which is exactly
   *  what the hero poster shows. */
  playing: boolean;
  /** Integer index of the current 'front-facing' book. Written every frame
   *  by Books's useFrame; the Phone reads it inside its own useFrame so the
   *  texture swap happens in the same frame as the position update (no
   *  one-frame React-state lag). */
  centeredIndexRef?: RefObject<number>;
  /** Subframe progress between the previous and current front books in
   *  [-0.5, +0.5]. Written every frame; the Phone reads it to slide its
   *  pages in sync with the carousel. */
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

function Books({ playing, centeredIndexRef, transitionRef }: BooksProps) {
  const invalidate = useThree((s) => s.invalidate);
  const refs = useRef<(THREE.Group | null)[]>([]);
  // Ref to the outer <group> wrapping all books — receives the live carousel
  // transform (translate / rotate / scale) from PARAMS each frame so the
  // tweakpane can nudge the whole ring without re-rendering.
  const carouselGroupRef = useRef<THREE.Group>(null);
  // Per-book opacity, indexed like COVERS. Books on the front arc read 1;
  // books behind the camera read 0. Written every frame here and read every
  // frame inside each <Book>'s useFrame, so the fade tracks rotation without
  // React-state lag. The ref object itself is what gets passed down.
  const opacitiesRef = useRef<number[]>(COVERS.map(() => 1));
  // Carousel state, in books. nextStepAt is a performance.now() time, or 0
  // while not auto-advancing.
  const carouselRef = useRef({ position: 0, target: 0, nextStepAt: 0, easing: false });
  const wakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Starting (or stopping) play needs a frame to arm the step timer.
  useEffect(() => {
    invalidate();
  }, [playing, invalidate]);

  useEffect(() => {
    return () => {
      if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current);
    };
  }, []);

  useFrame((state, rawDelta) => {
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

    // Auto-advance: one book per period, never more than one per frame, so
    // a long pause (off-screen, background tab) can't queue up a whirl.
    const c = carouselRef.current;
    const now = performance.now();
    const autoAdvance = playing && PARAMS.autoCarousel;
    if (autoAdvance) {
      const period = 1000 / Math.max(0.05, PARAMS.autoCarouselSpeed);
      if (c.nextStepAt === 0) c.nextStepAt = now + period;
      if (now >= c.nextStepAt) {
        c.target -= 1;
        c.nextStepAt = now + period;
      }
    } else {
      c.nextStepAt = 0;
    }

    // Ease towards the target (the same exponential ease smooothy used).
    const delta = c.easing ? Math.min(rawDelta, MAX_FRAME_DELTA) : RESUME_DELTA;
    c.position = THREE.MathUtils.damp(
      c.position,
      c.target,
      1 / Math.max(0.02, PARAMS.lerpFactor),
      delta,
    );
    if (Math.abs(c.target - c.position) < SETTLE_EPSILON) c.position = c.target;
    c.easing = c.position !== c.target;

    if (c.easing) {
      state.invalidate();
    } else if (autoAdvance && !wakeTimerRef.current) {
      wakeTimerRef.current = setTimeout(() => {
        wakeTimerRef.current = null;
        state.invalidate();
      }, Math.max(0, c.nextStepAt - now));
    }

    // Determine the current "front" book (whose angle is closest to 0).
    // angle_i = i*angleStep - position*angleStep
    // → angle_i ≈ 0 when (position mod count) ≈ i.
    const count = COVERS.length;
    const wrapped = ((c.position % count) + count) % count;
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
    const offsetAngle = c.position * angleStep;

    // Front-arc opacity band, in radians. Front FULL_BOOKS = full alpha,
    // FADE_WIDTH_BOOKS = linear fade band on either side, everything past
    // that is fully invisible (and culled via node.visible).
    const fullHalf = (FULL_BOOKS / 2) * angleStep;
    const fadeWidth = FADE_WIDTH_BOOKS * angleStep;
    const opacities = opacitiesRef.current;

    for (let i = 0; i < count; i++) {
      const node = refs.current[i];
      if (!node) continue;

      const angle = i * angleStep - offsetAngle;
      const x = Math.sin(angle) * R;
      const z = Math.cos(angle) * R;

      // All books share one size, and stand on GROUND_Y (their bottom edge
      // on the floor).
      const y = GROUND_Y + PARAMS.bookHeight / 2;
      // Negate the angle component so each book's spine (its "tail" — the
      // -X local face) rotates to face the OUTER side of the fan and the
      // open edge swings toward the carousel center. Cover faces stay
      // tilted more directly toward the camera as a side-effect. A small
      // fixed per-book lean keeps the row from looking machine-placed.
      const ry = -angle + PARAMS.rotationY + Math.sin(i * 1.31) * PARAMS.rotationVariance;
      const rz = (Math.sin(i * 1.7) * Math.PI) / 200;

      node.position.set(x, y, z);
      node.rotation.set(0, ry, rz);

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
      opacities[i] = opacity;
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
          <Book cover={cover} index={i} opacitiesRef={opacitiesRef} />
        </group>
      ))}
    </group>
  );
}

function CameraRig() {
  useFrame(({ camera }) => {
    camera.position.set(PARAMS.camX, PARAMS.camY, PARAMS.camZ);
    if (camera instanceof THREE.PerspectiveCamera && camera.fov !== PARAMS.fov) {
      camera.fov = PARAMS.fov;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/**
 * Image-based lighting from three's RoomEnvironment — a small procedural
 * studio (light panels in a box), prefiltered once. It gives the phone's
 * metal frame and glass something to reflect and the book covers soft,
 * directional fill, with no HDR download.
 */
function StudioEnvironment() {
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);

  useEffect(() => {
    let target: THREE.WebGLRenderTarget | null = null;
    const build = () => {
      target?.dispose();
      const pmrem = new THREE.PMREMGenerator(gl);
      const room = new RoomEnvironment();
      target = pmrem.fromScene(room, 0.04);
      room.dispose();
      pmrem.dispose();
      get().scene.environment = target.texture;
      get().invalidate();
    };
    build();
    // A lost WebGL context takes the prefiltered map with it; rebuild it
    // once three.js has restored the context (its own listener runs first).
    const canvas = gl.domElement;
    canvas.addEventListener("webglcontextrestored", build);
    return () => {
      canvas.removeEventListener("webglcontextrestored", build);
      get().scene.environment = null;
      target?.dispose();
    };
  }, [gl, get]);

  useFrame(({ scene }) => {
    scene.environmentIntensity = PARAMS.envIntensity;
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
      args={["#fdfaf4", PARAMS.fogNear, PARAMS.fogFar]}
    />
  );
}

/** Calls `onFrame` once, after the scene's first rendered frame. */
function FirstFrame({ onFrame }: { onFrame: () => void }) {
  const doneRef = useRef(false);
  useFrame(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onFrame();
  });
  return null;
}

/**
 * Bridges on-demand rendering to the outside world: requests from outside
 * the frame loop (textures filling in, tweakpane), and a fresh frame
 * whenever `wake` changes (the scene coming back on screen).
 */
function FrameRequests({ wake }: { wake: unknown }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => onFrameRequest(invalidate), [invalidate]);
  useEffect(() => {
    invalidate();
  }, [wake, invalidate]);
  return null;
}

type BookSceneProps = {
  /** Called with true once the scene is drawn and fading in over the
   *  poster, and with false if it stops being visible (WebGL context lost). */
  onLiveChange?: (live: boolean) => void;
};

export function BookScene({ onLiveChange }: BookSceneProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Refs read by Phone every frame so the texture swap + slide stay in
  // perfect lockstep with the carousel (no React-state-vs-useFrame race).
  const centeredIndexRef = useRef<number>(0);
  const transitionRef = useRef<number>(0);

  // Render only while the hero is on screen. On screen, frames are drawn on
  // demand — while the carousel eases, the phone follows the mouse, or a
  // texture changes — so the GPU idles between book changes.
  const [inView, setInView] = useState(true);
  // Fade-in gate: first frame drawn + cover images in (or timed out).
  const [firstFrame, setFirstFrame] = useState(false);
  const [coversReady, setCoversReady] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  // True once the fade over the poster has finished; motion starts then.
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "100px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Starts the downloads now — the books reuse the same cached promises
    // when they build their textures.
    const covers = BOOKS.flatMap((b) => (b.image ? [loadCoverImage(b.image)] : []));
    const timeout = new Promise((resolve) => setTimeout(resolve, COVER_WAIT_MS));
    Promise.race([Promise.allSettled(covers), timeout]).then(() => {
      if (!cancelled) setCoversReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const ready = firstFrame && coversReady && !contextLost;

  useEffect(() => {
    onLiveChange?.(ready);
    if (!ready) return;
    const timer = setTimeout(() => setPlaying(true), FADE_MS);
    return () => clearTimeout(timer);
  }, [ready, onLiveChange]);

  return (
    <div
      ref={wrapperRef}
      aria-hidden
      className={cn(
        "relative h-full w-full transition-opacity duration-700 ease-out motion-reduce:transition-none",
        ready ? "opacity-100" : "opacity-0",
      )}
    >
      <Canvas
        frameloop={inView ? "demand" : "never"}
        dpr={[1, 2]}
        camera={{
          position: [PARAMS.camX, PARAMS.camY, PARAMS.camZ],
          fov: PARAMS.fov,
        }}
        // Transparent: the hero's icon pattern shows through instead of
        // stopping in a hard line at the canvas edge. Neutral tone mapping
        // keeps the book covers' printed colours true (ACES shifts and
        // desaturates them).
        gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}
        onCreated={({ gl }) => {
          // three.js restores a lost context by itself; meanwhile the
          // poster covers for the blank canvas.
          gl.domElement.addEventListener("webglcontextlost", () =>
            setContextLost(true),
          );
          gl.domElement.addEventListener("webglcontextrestored", () =>
            setContextLost(false),
          );
        }}
        className="!absolute inset-0"
      >
        <FrameRequests wake={inView} />
        <StudioEnvironment />
        <LiveFog />
        <CameraRig />
        <LiveLights />
        <FirstFrame onFrame={() => setFirstFrame(true)} />

        <Suspense fallback={null}>
          <Books
            playing={playing}
            centeredIndexRef={centeredIndexRef}
            transitionRef={transitionRef}
          />
          <Phone
            covers={COVERS}
            parallax={playing}
            centeredIndexRef={centeredIndexRef}
            transitionRef={transitionRef}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
