"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PARAMS } from "@/lib/scene-params";

const COUNT = 30;
const TRAIL_POINTS = 18;
const INK = 0x000000;
// Baseline head radius used when constructing the SphereGeometry; runtime size
// is achieved by scaling the mesh, not by rebuilding the geometry.
const BASE_HEAD_RADIUS = 1;

type Particle = {
  direction: THREE.Vector3;
  speed: number;
  spawnTime: number;
  lifetime: number;
  pos: THREE.Vector3;
  trailPositions: Float32Array;
  line: THREE.Line;
  head: THREE.Mesh;
  positionAttr: THREE.BufferAttribute;
  lineMat: THREE.LineBasicMaterial;
  headMat: THREE.MeshBasicMaterial;
};

// Uniform random unit vector on the sphere. Sligthly squashed in Y so the
// burst reads as mostly horizontal (matching the book ring), with subtle
// vertical pop for depth.
function randomDirection(target: THREE.Vector3) {
  const u = (Math.random() * 2 - 1) * 0.6; // y in [-0.6, 0.6]
  const theta = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - u * u);
  target.set(r * Math.cos(theta), u, r * Math.sin(theta)).normalize();
}

function makeParticle(): Particle {
  const trailPositions = new Float32Array(TRAIL_POINTS * 3);
  const lineGeom = new THREE.BufferGeometry();
  const positionAttr = new THREE.BufferAttribute(trailPositions, 3);
  positionAttr.setUsage(THREE.DynamicDrawUsage);
  lineGeom.setAttribute("position", positionAttr);

  const lineMat = new THREE.LineBasicMaterial({
    color: INK,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const line = new THREE.Line(lineGeom, lineMat);
  line.frustumCulled = false;

  const headGeom = new THREE.SphereGeometry(BASE_HEAD_RADIUS, 10, 10);
  const headMat = new THREE.MeshBasicMaterial({
    color: INK,
    transparent: true,
    opacity: 0,
  });
  const head = new THREE.Mesh(headGeom, headMat);
  head.frustumCulled = false;

  return {
    direction: new THREE.Vector3(1, 0, 0),
    speed: 1,
    spawnTime: -Infinity,
    lifetime: 1,
    pos: new THREE.Vector3(),
    trailPositions,
    line,
    head,
    positionAttr,
    lineMat,
    headMat,
  };
}

function fillTrailFromPast(p: Particle, age: number) {
  // Pre-populate the trail with positions consistent with the current motion,
  // assuming ~16ms per historical step. This avoids the first-frame artefact
  // where the trail draws straight from origin to current head position.
  const stepDt = 1 / 60;
  for (let j = 0; j < TRAIL_POINTS; j++) {
    const sampleAge = Math.max(0, age - j * stepDt);
    const dist = p.speed * sampleAge;
    p.trailPositions[j * 3] = p.direction.x * dist;
    p.trailPositions[j * 3 + 1] = p.direction.y * dist;
    p.trailPositions[j * 3 + 2] = p.direction.z * dist;
  }
  p.positionAttr.needsUpdate = true;
}

function respawn(p: Particle, now: number) {
  randomDirection(p.direction);
  p.speed = 1.5 + Math.random() * 2.5;
  p.lifetime = 1.0 + Math.random() * 1.4;
  p.spawnTime = now;
  // Clear trail so it doesn't streak from the last death position back to origin.
  for (let i = 0; i < p.trailPositions.length; i++) {
    p.trailPositions[i] = 0;
  }
  p.positionAttr.needsUpdate = true;
}

export function SparkleEmitter() {
  const rootRef = useRef<THREE.Group>(null);
  const particles = useMemo(
    () => Array.from({ length: COUNT }, makeParticle),
    [],
  );

  // Initialize with staggered spawn times so particles are at different
  // points in their lifecycle on the first frame.
  useEffect(() => {
    const now = performance.now() / 1000;
    particles.forEach((p, i) => {
      randomDirection(p.direction);
      p.speed = 1.5 + Math.random() * 2.5;
      p.lifetime = 1.0 + Math.random() * 1.4;
      const initialAge = (i / COUNT) * p.lifetime;
      p.spawnTime = now - initialAge;
      fillTrailFromPast(p, initialAge);
    });

    return () => {
      // Dispose GPU resources on unmount.
      particles.forEach((p) => {
        p.line.geometry.dispose();
        p.lineMat.dispose();
        p.head.geometry.dispose();
        p.headMat.dispose();
      });
    };
  }, [particles]);

  useFrame((state) => {
    // Sparkles share the compass center.
    if (rootRef.current) {
      rootRef.current.position.y = PARAMS.compassY;
    }

    const enabled = PARAMS.sparkleEnabled;
    if (!enabled) {
      // Hide everything cheaply and bail out.
      for (let i = 0; i < particles.length; i++) {
        particles[i].line.visible = false;
        particles[i].head.visible = false;
      }
      return;
    }

    const t = state.clock.elapsedTime;
    const speedMul = PARAMS.sparkleSpeed;
    const lifetimeMul = Math.max(0.1, PARAMS.sparkleLifetime);
    // Sphere geometry is built at radius 1, so scaling by sparkleSize gives a
    // head whose world-space radius equals sparkleSize directly.
    const sizeScale = PARAMS.sparkleSize;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.line.visible = true;
      p.head.visible = true;

      // Effective lifetime applies the user's lifetime multiplier on top of
      // each particle's per-instance variance.
      const effectiveLife = p.lifetime * lifetimeMul;
      let age = t - p.spawnTime;
      if (age > effectiveLife) {
        respawn(p, t);
        age = 0;
      }

      // Linear outward motion from origin.
      const dist = p.speed * speedMul * age;
      p.pos.set(
        p.direction.x * dist,
        p.direction.y * dist,
        p.direction.z * dist,
      );

      // Shift trail buffer one step: drop the oldest position, prepend the new head.
      const arr = p.trailPositions;
      for (let j = TRAIL_POINTS - 1; j > 0; j--) {
        arr[j * 3] = arr[(j - 1) * 3];
        arr[j * 3 + 1] = arr[(j - 1) * 3 + 1];
        arr[j * 3 + 2] = arr[(j - 1) * 3 + 2];
      }
      arr[0] = p.pos.x;
      arr[1] = p.pos.y;
      arr[2] = p.pos.z;
      p.positionAttr.needsUpdate = true;

      // Lifecycle alpha: fast fade-in, sustained middle, gentle fade-out.
      const f = age / effectiveLife;
      const fadeIn = Math.min(1, f / 0.08);
      const fadeOut = Math.max(0, 1 - Math.max(0, (f - 0.65)) / 0.35);
      const opacity = fadeIn * fadeOut;

      p.headMat.opacity = opacity;
      p.lineMat.opacity = opacity * 0.7; // trail slightly lighter than head

      p.head.position.copy(p.pos);
      p.head.scale.setScalar(sizeScale);
    }
  });

  return (
    <group ref={rootRef}>
      {particles.map((p, i) => (
        <group key={i}>
          <primitive object={p.line} />
          <primitive object={p.head} />
        </group>
      ))}
    </group>
  );
}
