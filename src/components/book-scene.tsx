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

type BooksProps = {
  sliderRef: RefObject<Core | null>;
  onMeshesReady?: (objects: THREE.Object3D[]) => void;
};

function Books({ sliderRef, onMeshesReady }: BooksProps) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const reportedRef = useRef(false);

  useFrame((state) => {
    if (!reportedRef.current && onMeshesReady) {
      const all = refs.current.filter(
        (n): n is THREE.Group => n !== null,
      );
      if (all.length === COVERS.length) {
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

    // Distribute books evenly around a horizontal circle (xz-plane).
    // slider.current is in slide-index units (one unit = one book slot),
    // so multiplying by the angular step gives a continuous offset angle.
    const count = COVERS.length;
    const angleStep = (Math.PI * 2) / count;
    const R = PARAMS.circleRadius;
    const offsetAngle = slider ? slider.current * angleStep : 0;
    const t = state.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const node = refs.current[i];
      if (!node) continue;

      // Negate the offset so dragging left brings the next book in from the
      // right, matching the original linear-scroll feel.
      const angle = i * angleStep - offsetAngle;
      const x = Math.sin(angle) * R;
      const z = Math.cos(angle) * R;

      // Optional subtle y-axis modulation around the loop + per-book bob.
      const bob = Math.sin(t * PARAMS.bobSpeed + i * 0.6) * PARAMS.bobAmount;
      const arcY = Math.sin(angle * 2) * PARAMS.arcDepth * 0.15;
      const y = -0.4 + bob + arcY;

      // Each book faces outward from the circle's center; rotationY adds an
      // extra global tilt, rotationVariance adds per-book noise.
      const ry =
        angle +
        PARAMS.rotationY +
        Math.sin(i * 1.31 + t * 0.1) * PARAMS.rotationVariance;
      const rz =
        (Math.sin(i * 1.7) * Math.PI) / 200 +
        Math.sin(t * 0.5 + i * 0.4) * 0.01;

      node.position.set(x, y, z);
      node.rotation.set(0, ry, rz);

      // Per-book aspect-ratio variance — each axis scaled independently from
      // deterministic sine sums of i, so the row reads as a real shelf
      // (paperbacks, mass-markets, oversize). Stronger than the previous pass
      // so the silhouettes are visibly different, not just slightly nudged.
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
          <Book cover={cover} index={i} />
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
        gl={{ antialias: true, alpha: true }}
        className="!absolute inset-0"
      >
        <color attach="background" args={["#f4eee2"]} />
        <LiveFog />
        <CameraRig />
        <LiveLights />

        <Suspense fallback={null}>
          <Books sliderRef={sliderRef} onMeshesReady={setBookObjects} />
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
