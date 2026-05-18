"use client";

import { Line, Trail } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { PARAMS } from "@/lib/scene-params";

const INK = "#000000";

// Generate a closed circle on the local xz-plane (y = 0).
function circlePoints(radius: number, segments = 192): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  return pts;
}

type FlatRingProps = {
  radius: number;
  dashed?: boolean;
  lineWidth?: number;
  dashSize?: number;
  gapSize?: number;
  segments?: number;
};

function FlatRing({
  radius,
  dashed = false,
  lineWidth = 1,
  dashSize = 0.06,
  gapSize = 0.04,
  segments,
}: FlatRingProps) {
  const points = useMemo(
    () => circlePoints(radius, segments),
    [radius, segments],
  );
  return (
    <Line
      points={points}
      color={INK}
      lineWidth={lineWidth}
      dashed={dashed}
      dashSize={dashSize}
      gapSize={gapSize}
    />
  );
}

type SpokesProps = {
  count: number;
  innerR: number;
  outerR: number;
  lineWidth?: number;
  jitter?: number;
};

function Spokes({
  count,
  innerR,
  outerR,
  lineWidth = 0.8,
  jitter = 0.3,
}: SpokesProps) {
  const segments = useMemo(() => {
    const arr: THREE.Vector3[][] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.sin(i * 1.7) * 0.04;
      const ir = innerR * (1 - jitter * Math.abs(Math.cos(i * 2.3)));
      const or = outerR * (1 - jitter * 0.5 * Math.abs(Math.sin(i * 3.1)));
      arr.push([
        new THREE.Vector3(Math.cos(a) * ir, 0, Math.sin(a) * ir),
        new THREE.Vector3(Math.cos(a) * or, 0, Math.sin(a) * or),
      ]);
    }
    return arr;
  }, [count, innerR, outerR, jitter]);

  return (
    <>
      {segments.map((segment, i) => (
        <Line key={i} points={segment} color={INK} lineWidth={lineWidth} />
      ))}
    </>
  );
}

type DotProps = {
  radius: number;
  angle: number;
  size?: number;
};

function Dot({ radius, angle, size = 0.025 }: DotProps) {
  return (
    <mesh position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]}>
      <sphereGeometry args={[size, 12, 12]} />
      <meshBasicMaterial color={INK} />
    </mesh>
  );
}

type PlanetProps = {
  orbitRadius: number;
  baseSpeed: number; // baseline speed (rad/s); multiplied by PARAMS.compassPlanetSpeed live
  phase?: number;
  size?: number;
  trailLength?: number;
  trailWidth?: number;
};

function Planet({
  orbitRadius,
  baseSpeed,
  phase = 0,
  size = 0.08,
  trailLength = 2.5,
  trailWidth = 0.06,
}: PlanetProps) {
  const ref = useRef<THREE.Mesh>(null);
  // Accumulate the planet's angle so speed changes don't cause position jumps
  // (a tweaked multiplier on `clock.elapsedTime * speed` would teleport).
  const angleRef = useRef(phase);

  useFrame((_, delta) => {
    if (!ref.current) return;
    angleRef.current += delta * baseSpeed * PARAMS.compassPlanetSpeed;
    const a = angleRef.current;
    ref.current.position.set(
      Math.cos(a) * orbitRadius,
      0,
      Math.sin(a) * orbitRadius,
    );
  });

  return (
    <Trail
      width={trailWidth}
      length={trailLength}
      color={INK}
      attenuation={(t) => t * t}
      stride={0}
    >
      <mesh ref={ref}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshBasicMaterial color={INK} />
      </mesh>
    </Trail>
  );
}

export function CosmicCompass() {
  const rootRef = useRef<THREE.Group>(null);
  const innerRingsRef = useRef<THREE.Group>(null);
  const spokesRef = useRef<THREE.Group>(null);
  const tiltedARef = useRef<THREE.Group>(null);
  const tiltedBRef = useRef<THREE.Group>(null);

  // Angle accumulators — let speed sliders feel smooth instead of jumping.
  const ringsAngleRef = useRef(0);
  const spokesAngleRef = useRef(0);
  const wobbleClockRef = useRef(0);

  useFrame((_, delta) => {
    wobbleClockRef.current += delta;
    ringsAngleRef.current += delta * PARAMS.compassRingsSpeed;
    spokesAngleRef.current += delta * PARAMS.compassSpokesSpeed;
    const t = wobbleClockRef.current;

    if (rootRef.current) {
      rootRef.current.visible = PARAMS.compassEnabled;
      rootRef.current.position.set(0, PARAMS.compassY, 0);
      rootRef.current.scale.setScalar(PARAMS.compassScale);
    }

    if (innerRingsRef.current) {
      innerRingsRef.current.rotation.y = ringsAngleRef.current;
    }
    if (spokesRef.current) {
      spokesRef.current.rotation.y = spokesAngleRef.current;
    }

    // Primary tilted orbit — tilt is driven by params, wobble is layered on top.
    if (tiltedARef.current) {
      tiltedARef.current.rotation.x = PARAMS.compassTilt;
      tiltedARef.current.rotation.y = Math.sin(t * 0.18) * PARAMS.compassWobble;
      tiltedARef.current.rotation.z =
        Math.PI / 12 + Math.sin(t * 0.13) * PARAMS.compassWobble * 0.3;
    }
    // Secondary orbit — opposite-direction tilt and offset wobble for depth.
    if (tiltedBRef.current) {
      tiltedBRef.current.rotation.x = -PARAMS.compassTilt * 0.6;
      tiltedBRef.current.rotation.y =
        Math.PI / 5 - Math.sin(t * 0.22 + 1) * PARAMS.compassWobble * 1.2;
      tiltedBRef.current.rotation.z =
        Math.sin(t * 0.16) * PARAMS.compassWobble * 0.5;
    }
  });

  const innerDots = useMemo(
    () => [
      { r: 0.55, a: Math.PI * 0.2 },
      { r: 0.9, a: Math.PI * 0.7 },
      { r: 0.9, a: Math.PI * 1.45 },
      { r: 1.3, a: Math.PI * 0.05 },
      { r: 1.3, a: Math.PI * 1.1 },
      { r: 1.7, a: Math.PI * 0.55 },
      { r: 1.7, a: Math.PI * 1.7 },
    ],
    [],
  );

  return (
    <group ref={rootRef}>
      <group ref={innerRingsRef}>
        <FlatRing radius={0.55} dashed dashSize={0.05} gapSize={0.04} />
        <FlatRing radius={0.9} lineWidth={0.9} />
        <FlatRing radius={1.3} dashed dashSize={0.08} gapSize={0.05} />
        <FlatRing radius={1.7} lineWidth={0.9} />
        {innerDots.map((d, i) => (
          <Dot key={i} radius={d.r} angle={d.a} />
        ))}
      </group>

      <group ref={spokesRef}>
        <Spokes count={22} innerR={0.08} outerR={1.7} jitter={0.35} />
      </group>

      <group ref={tiltedARef}>
        <FlatRing radius={2.4} lineWidth={1.2} />
        <Planet
          orbitRadius={2.4}
          baseSpeed={0.55}
          phase={0}
          size={0.09}
          trailLength={2.6}
          trailWidth={0.06}
        />
        <Planet
          orbitRadius={2.4}
          baseSpeed={0.55}
          phase={Math.PI * 0.78}
          size={0.07}
          trailLength={2.2}
          trailWidth={0.05}
        />
        <Dot radius={2.4} angle={Math.PI * 0.3} size={0.03} />
        <Dot radius={2.4} angle={Math.PI * 1.55} size={0.03} />
      </group>

      <group ref={tiltedBRef}>
        <FlatRing
          radius={2.0}
          dashed
          dashSize={0.1}
          gapSize={0.06}
          lineWidth={0.9}
        />
        <Planet
          orbitRadius={2.0}
          baseSpeed={-0.42}
          phase={Math.PI}
          size={0.06}
          trailLength={2.0}
          trailWidth={0.045}
        />
      </group>

      <mesh>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color={INK} />
      </mesh>
    </group>
  );
}
