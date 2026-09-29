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
import type { ScanShared } from "./phone-screen";
import {
  AIM_DWELL,
  CYCLE,
  DETECT_AT,
  RESULT_AT,
  screenActivity,
} from "@/lib/scan-ceremony";
import { onFrameRequest, requestFrame } from "@/lib/scene-frame";
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
    isbn: "9780805209990",
    baseColor: "#1a1a1a",
    accent: "#c4a052",
    ink: "#e8d49a",
    pattern: "plain",
    image: "/images/the-trial.jpg",
  },
  {
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    isbn: "9780261102217",
    baseColor: "#1f3a2a",
    accent: "#c9a35a",
    ink: "#e8d6a8",
    pattern: "ornate",
    image: "/images/the-hobbit.jpg",
  },
  {
    title: "The Catcher in the Rye",
    author: "J.D. Salinger",
    isbn: "9780316769488",
    baseColor: "#8a1f1f",
    accent: "#f5e7c8",
    ink: "#f7eddd",
    pattern: "plain",
    image: "/images/the-catcher-in-the-rye.jpg",
  },
  {
    title: "Intermezzo",
    author: "Sally Rooney",
    isbn: "9780571365463",
    baseColor: "#e8c84a",
    accent: "#1a1a1a",
    ink: "#1a1a1a",
    pattern: "plain",
    image: "/images/intermezzo.jpg",
  },
  {
    title: "Atomic Habits",
    author: "James Clear",
    isbn: "9780735211292",
    baseColor: "#f4a821",
    accent: "#1a1a1a",
    ink: "#1a1a1a",
    pattern: "plain",
    image: "/images/atomic-habits.jpg",
  },
  {
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    isbn: "9780743273565",
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
    isbn: "9786257612340",
    baseColor: "#2a3d5c",
    accent: "#d4b87a",
    ink: "#ead49a",
    pattern: "plain",
    image: "/images/ruyalarin-cagrisi.jpg",
  },
  {
    title: "It",
    author: "Stephen King",
    isbn: "9781501142970",
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
    isbn: "9780099590088",
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
// Books — the carousel, and the director that runs the scan ceremony.
//
// The carousel position is a number of books (book i is in front when the
// position ≡ i mod count), easing toward an integer target with a time
// constant of lerpFactor seconds. The director plays the app's scan
// ceremony on the phone (scan-ceremony.ts) for whichever book is in front:
// each cycle it steps the carousel to the next book, and while the visitor
// drags the shelf or taps a book it switches the phone to aiming, then
// scans the book that lands in front. The scene renders on demand, so the
// director requests frames only while something moves and otherwise sets a
// timer for the next beat.
// ---------------------------------------------------------------------------

/** The first cycle holds the opening sheet a little longer. */
const FIRST_HOLD = 1;
/** After a visitor-started scan, the result stays up this much longer. */
const USER_HOLD = 2.5;
/** How far a hovered book rises off the shelf, in world units. */
const HOVER_LIFT = 0.14;

/** Shared between the wrapper's pointer handlers and the frame loop. */
export type SceneControl = {
  carousel: {
    position: number;
    target: number;
    easing: boolean;
    /** The target came from the visitor (drag, tap), not the director. */
    userDriven: boolean;
  };
  director: {
    mode: "timeline" | "aiming";
    /** performance.now() at t = 0 of the current cycle. */
    cycleStart: number;
    /** When this cycle hands over to the next book, in seconds. */
    cycleLength: number;
    book: number;
    previousBook: number;
  };
  drag: {
    pointerId: number;
    active: boolean;
    startX: number;
    startY: number;
    startPosition: number;
    /** Recent pointer samples, for the release fling. */
    samples: { x: number; time: number }[];
  };
  /** Book under the mouse, or -1. A hovered book holds the shelf: the
   *  next book waits until the mouse leaves it. */
  hovered: number;
  /** The mouse is over the scene (hover is re-checked as books move). */
  mouseInside: boolean;
  /** Books per pixel of horizontal drag (set from the canvas height). */
  booksPerPixel: number;
};

export function createSceneControl(): SceneControl {
  return {
    carousel: { position: 0, target: 0, easing: false, userDriven: false },
    director: {
      mode: "timeline",
      cycleStart: 0,
      cycleLength: CYCLE + FIRST_HOLD,
      book: 0,
      previousBook: 0,
    },
    drag: { pointerId: -1, active: false, startX: 0, startY: 0, startPosition: 0, samples: [] },
    hovered: -1,
    mouseInside: false,
    booksPerPixel: 1 / 150,
  };
}

type BooksProps = {
  /** False holds the opening frame (the first book's finished sheet), which
   *  is exactly what the hero poster shows. */
  playing: boolean;
  controlRef: RefObject<SceneControl>;
  sharedRef: RefObject<ScanShared>;
  /** Cursor for the wrapper: over a book, dragging, or neither. */
  onCursor: (cursor: "grab" | "grabbing" | "pointer") => void;
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

const mod = (n: number, m: number) => ((n % m) + m) % m;

function Books({ playing, controlRef, sharedRef, onCursor }: BooksProps) {
  const invalidate = useThree((s) => s.invalidate);
  const canvasHeight = useThree((s) => s.size.height);
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
  // Per-book hover lift in world units, read by each <Book> for its shadow.
  const liftsRef = useRef<number[]>(COVERS.map(() => 0));
  const liftingRef = useRef(false);
  const startedRef = useRef(false);
  const wakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A front book moves ~0.29 × the canvas height per book step, so dragging
  // that far turns the shelf by one book — the books follow the finger.
  useEffect(() => {
    controlRef.current.booksPerPixel = 1 / (0.29 * canvasHeight);
  }, [controlRef, canvasHeight]);

  // Starting play needs a frame to start the clock.
  useEffect(() => {
    invalidate();
  }, [playing, invalidate]);

  useEffect(() => {
    return () => {
      if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current);
    };
  }, []);

  /** Turn the shelf the short way round until book i is in front. */
  const bringToFront = (i: number) => {
    const { carousel, director } = controlRef.current;
    const count = COVERS.length;
    const offset = mod(i - carousel.position + count / 2, count) - count / 2;
    carousel.target = Math.round(carousel.position + offset);
    carousel.userDriven = true;
    director.mode = "aiming";
    invalidate();
  };

  useFrame((state, rawDelta) => {
    const cg = carouselGroupRef.current;
    if (cg) {
      cg.position.set(PARAMS.carouselX, PARAMS.carouselY, PARAMS.carouselZ);
      cg.rotation.set(PARAMS.carouselRotX, PARAMS.carouselRotY, PARAMS.carouselRotZ);
      cg.scale.setScalar(PARAMS.carouselScale);
    }

    const { carousel: c, director: d, drag } = controlRef.current;
    const now = performance.now();
    const count = COVERS.length;

    // Carousel: close behind the pointer while dragging, otherwise the
    // exponential ease (the same one smooothy used). The first frame after
    // an idle stretch reports the whole pause as its delta, so it steps from
    // a nominal frame instead.
    const delta = c.easing ? Math.min(rawDelta, MAX_FRAME_DELTA) : RESUME_DELTA;
    const rate = drag.active ? 30 : 1 / Math.max(0.02, PARAMS.lerpFactor);
    c.position = THREE.MathUtils.damp(c.position, c.target, rate, delta);
    if (!drag.active && Math.abs(c.target - c.position) < SETTLE_EPSILON) {
      c.position = c.target;
    }
    c.easing = drag.active || c.position !== c.target;
    const front = mod(Math.round(c.position), count);

    // R3F hit-tests only when the pointer moves, so while the shelf turns
    // under a resting mouse, re-run hover against its last position.
    if (c.easing && !drag.active && controlRef.current.mouseInside) {
      state.events.update?.();
    }
    const held = controlRef.current.hovered !== -1;

    // Director.
    if (drag.active || (c.userDriven && c.easing)) {
      d.mode = "aiming";
    } else if (d.mode === "aiming") {
      // The shelf settled after a drag or a tap: scan the book in front.
      d.mode = "timeline";
      d.previousBook = d.book;
      d.book = front;
      d.cycleStart = now - (DETECT_AT - AIM_DWELL) * 1000;
      d.cycleLength = CYCLE + USER_HOLD;
      c.userDriven = false;
    }

    let t: number;
    if (!playing) {
      // Hold the opening frame: the first book's finished sheet.
      startedRef.current = false;
      t = RESULT_AT;
    } else {
      // Play picks up from the opening frame, however long it was held.
      if (!startedRef.current) {
        startedRef.current = true;
        d.cycleStart = now - RESULT_AT * 1000;
      }
      t = (now - d.cycleStart) / 1000;
      if (d.mode === "timeline" && PARAMS.autoCarousel && !held && t >= d.cycleLength) {
        // Next book: the shelf turns while the sheet slides away.
        c.target = Math.round(c.target) - 1;
        c.easing = true;
        d.previousBook = d.book;
        d.book = mod(c.target, count);
        d.cycleStart = now;
        d.cycleLength = CYCLE;
        t = 0;
      }
    }

    const shared = sharedRef.current;
    shared.mode = d.mode;
    shared.t = t;
    shared.book = d.book;
    shared.previousBook = d.previousBook;
    shared.feedBook = d.mode === "aiming" ? front : d.book;

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
    const lifts = liftsRef.current;
    const liftDelta = liftingRef.current ? Math.min(rawDelta, MAX_FRAME_DELTA) : RESUME_DELTA;
    let lifting = false;

    for (let i = 0; i < count; i++) {
      const node = refs.current[i];
      if (!node) continue;

      const angle = i * angleStep - offsetAngle;
      const x = Math.sin(angle) * R;
      const z = Math.cos(angle) * R;

      // A hovered book rises a little off the shelf.
      const liftTarget = controlRef.current.hovered === i ? HOVER_LIFT : 0;
      lifts[i] = THREE.MathUtils.damp(lifts[i], liftTarget, 14, liftDelta);
      if (Math.abs(lifts[i] - liftTarget) < 1e-4) lifts[i] = liftTarget;
      else lifting = true;

      // All books share one size, and stand on GROUND_Y (their bottom edge
      // on the floor) unless lifted.
      const y = GROUND_Y + PARAMS.bookHeight / 2 + lifts[i];
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

    liftingRef.current = lifting;

    // Frames: keep drawing while anything moves; otherwise sleep until the
    // ceremony's next beat or the next book, whichever comes first. Each
    // frame re-arms the timer, so it always holds the nearest deadline.
    if (wakeTimerRef.current) {
      clearTimeout(wakeTimerRef.current);
      wakeTimerRef.current = null;
    }
    const timeline = playing && d.mode === "timeline";
    const activity = timeline ? screenActivity(t) : { moving: false, wakeIn: Infinity };
    if (c.easing || lifting || activity.moving) {
      state.invalidate();
    } else if (timeline) {
      const nextBookIn = PARAMS.autoCarousel && !held ? d.cycleLength - t : Infinity;
      const wakeIn = Math.min(activity.wakeIn, nextBookIn);
      if (wakeIn < Infinity) {
        wakeTimerRef.current = setTimeout(() => {
          wakeTimerRef.current = null;
          state.invalidate();
        }, Math.max(0, wakeIn * 1000));
      }
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
          onPointerOver={(e) => {
            e.stopPropagation();
            if (e.nativeEvent.pointerType !== "mouse") return;
            if (opacitiesRef.current[i] < 0.5 || controlRef.current.drag.active) return;
            controlRef.current.hovered = i;
            onCursor("pointer");
            invalidate();
          }}
          onPointerOut={() => {
            if (controlRef.current.hovered !== i) return;
            controlRef.current.hovered = -1;
            onCursor(controlRef.current.drag.active ? "grabbing" : "grab");
            invalidate();
          }}
          onClick={(e) => {
            e.stopPropagation();
            // A drag that ends over a book is not a tap.
            if (e.delta > DRAG_SLOP || opacitiesRef.current[i] < 0.5) return;
            bringToFront(i);
          }}
        >
          <Book cover={cover} index={i} opacitiesRef={opacitiesRef} liftsRef={liftsRef} />
        </group>
      ))}
    </group>
  );
}

/** Pixels a pointer may travel and still count as a tap. */
const DRAG_SLOP = 6;

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
  const controlRef = useRef<SceneControl>(createSceneControl());
  const sharedRef = useRef<ScanShared>({
    mode: "timeline",
    t: RESULT_AT,
    book: 0,
    previousBook: 0,
    feedBook: 0,
  });

  // Render only while the hero is on screen. On screen, frames are drawn on
  // demand — while the carousel eases, the phone plays a beat of the scan
  // ceremony or follows the mouse, or a texture changes.
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

  const setCursor = (cursor: "grab" | "grabbing" | "pointer") => {
    if (wrapperRef.current) wrapperRef.current.style.cursor = cursor;
  };

  // Drag or swipe to spin the shelf. Horizontal only: `touch-action: pan-y`
  // leaves vertical swipes to the page, and a gesture that starts out more
  // vertical than horizontal is never claimed.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!playing || (e.pointerType === "mouse" && e.button !== 0)) return;
    const { drag, carousel } = controlRef.current;
    drag.pointerId = e.pointerId;
    drag.active = false;
    drag.startX = e.clientX;
    drag.startY = e.clientY;
    drag.startPosition = carousel.position;
    drag.samples = [{ x: e.clientX, time: e.timeStamp }];
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const { drag, carousel, director } = controlRef.current;
    if (e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.active) {
      if (Math.abs(dy) > DRAG_SLOP && Math.abs(dy) > Math.abs(dx)) {
        drag.pointerId = -1; // a scroll, not ours
        return;
      }
      if (Math.abs(dx) <= DRAG_SLOP) return;
      drag.active = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      controlRef.current.hovered = -1;
      setCursor("grabbing");
    }
    carousel.target = drag.startPosition - dx * controlRef.current.booksPerPixel;
    carousel.userDriven = true;
    director.mode = "aiming";
    drag.samples.push({ x: e.clientX, time: e.timeStamp });
    if (drag.samples.length > 6) drag.samples.shift();
    requestFrame();
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>, fling: boolean) => {
    const { drag, carousel } = controlRef.current;
    if (e.pointerId !== drag.pointerId) return;
    drag.pointerId = -1;
    if (!drag.active) return;
    drag.active = false;
    // Release: carry the fling for a quarter of a second, then settle on
    // the nearest book — which the phone then scans.
    const first = drag.samples[0];
    const last = drag.samples[drag.samples.length - 1];
    const seconds = Math.max(0.016, (last.time - first.time) / 1000);
    const velocity = fling ? (last.x - first.x) / seconds : 0;
    carousel.target = Math.round(carousel.target - velocity * 0.25 * controlRef.current.booksPerPixel);
    setCursor("grab");
    requestFrame();
  };

  return (
    <div
      ref={wrapperRef}
      aria-hidden
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") controlRef.current.mouseInside = true;
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") controlRef.current.mouseInside = false;
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endDrag(e, true)}
      onPointerCancel={(e) => endDrag(e, false)}
      onDragStart={(e) => e.preventDefault()}
      style={{ touchAction: "pan-y", cursor: "grab" }}
      className={cn(
        "relative h-full w-full select-none transition-opacity duration-700 ease-out motion-reduce:transition-none",
        ready ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
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
        style={{ touchAction: "pan-y" }}
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
            controlRef={controlRef}
            sharedRef={sharedRef}
            onCursor={setCursor}
          />
          <Phone covers={COVERS} parallax={playing} sharedRef={sharedRef} />
        </Suspense>
      </Canvas>
    </div>
  );
}
