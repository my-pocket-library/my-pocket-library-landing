"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { type RefObject, Suspense, useEffect, useRef } from "react";
import Core from "smooothy";
import * as THREE from "three";
import { Book, type BookCover } from "./book";
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

function wrapToRange(value: number, half: number): number {
  const total = half * 2;
  return ((((value + half) % total) + total) % total) - half;
}

type BooksProps = {
  sliderRef: RefObject<Core | null>;
};

function Books({ sliderRef }: BooksProps) {
  const refs = useRef<(THREE.Group | null)[]>([]);

  useFrame((state) => {
    const slider = sliderRef.current;
    if (slider) {
      slider.config.lerpFactor = PARAMS.lerpFactor;
      slider.config.dragSensitivity = PARAMS.dragSensitivity;
      slider.config.scrollSensitivity = PARAMS.scrollSensitivity;
      slider.config.speedDecay = PARAMS.speedDecay;
      slider.snap = PARAMS.snap;
      slider.update();
    }

    const count = COVERS.length;
    const spacing = PARAMS.spacing;
    const totalWidth = count * spacing;
    const halfWidth = totalWidth / 2;
    const offset = slider ? slider.current * spacing : 0;
    const t = state.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const node = refs.current[i];
      if (!node) continue;

      const ti = i / (count - 1);
      const baseX = (i - (count - 1) / 2) * spacing;
      const baseZ =
        Math.sin(ti * Math.PI) * PARAMS.arcDepth + (i % 2 === 0 ? 0.04 : -0.04);
      const bob = Math.sin(t * PARAMS.bobSpeed + i * 0.6) * PARAMS.bobAmount;
      const baseY = -0.4 + Math.sin(i * 0.9) * 0.03 + bob;

      const ry =
        PARAMS.rotationY +
        Math.sin(ti * Math.PI * 1.2) * PARAMS.rotationVariance;
      const rz =
        (Math.sin(i * 1.7) * Math.PI) / 200 +
        Math.sin(t * 0.5 + i * 0.4) * 0.01;

      node.position.set(
        wrapToRange(baseX + offset, halfWidth),
        baseY,
        baseZ,
      );
      node.rotation.set(0, ry, rz);
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
          <Book cover={cover} />
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
  return (
    <fog
      ref={fogRef}
      attach="fog"
      args={["#000000", PARAMS.fogNear, PARAMS.fogFar]}
    />
  );
}

export function BookScene() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<Core | null>(null);

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
        <color attach="background" args={["#000000"]} />
        <LiveFog />
        <CameraRig />
        <LiveLights />

        <Suspense fallback={null}>
          <Books sliderRef={sliderRef} />
          <Environment
            preset="city"
            environmentIntensity={PARAMS.envIntensity}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
