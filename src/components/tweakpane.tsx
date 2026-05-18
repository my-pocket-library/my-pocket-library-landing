"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pane } from "tweakpane";
import { PARAMS, type SceneParams } from "@/lib/scene-params";

// Tweakpane v4 ships incomplete public types for addFolder / addBinding
// (the methods exist at runtime via FolderApi). Cast at the boundary.
type BindingOpts = { min?: number; max?: number; step?: number };
type Binding = {
  on: (event: "change", cb: () => void) => Binding;
};
type Folder = {
  addBinding: (target: object, key: string, opts?: BindingOpts) => Binding;
};
type PaneLike = Folder & {
  addFolder: (cfg: { title: string; expanded?: boolean }) => Folder;
  dispose: () => void;
};

type Props = {
  /** Fired when toggles that need a React re-render change (e.g. celOutline). */
  onPostToggle?: () => void;
};

export function Tweakpane({ onPostToggle }: Props = {}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<PaneLike | null>(null);
  // Only render the portal after mount so document.body is available (SSR safe).
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!hostRef.current) return;

    const pane = new Pane({
      container: hostRef.current,
      title: "Controls",
    }) as unknown as PaneLike;
    paneRef.current = pane;

    const carousel = pane.addFolder({ title: "Carousel", expanded: true });
    carousel.addBinding(PARAMS, "lerpFactor", { min: 0.02, max: 1, step: 0.01 });
    carousel.addBinding(PARAMS, "dragSensitivity", {
      min: 0.0005,
      max: 0.02,
      step: 0.0005,
    });
    carousel.addBinding(PARAMS, "scrollSensitivity", {
      min: 0.1,
      max: 4,
      step: 0.05,
    });
    carousel.addBinding(PARAMS, "speedDecay", {
      min: 0.5,
      max: 0.99,
      step: 0.01,
    });
    carousel.addBinding(PARAMS, "snap");
    carousel.addBinding(PARAMS, "scrollInput");

    const books = pane.addFolder({ title: "Books", expanded: true });
    const sizeKeys: (keyof SceneParams)[] = [
      "bookWidth",
      "bookHeight",
      "bookDepth",
    ];
    sizeKeys.forEach((k) => {
      books.addBinding(PARAMS, k, { min: 0.1, max: 4, step: 0.01 });
    });
    books.addBinding(PARAMS, "circleRadius", {
      min: 0.5,
      max: 14,
      step: 0.05,
    });
    books.addBinding(PARAMS, "rotationY", { min: -1.5, max: 1.5, step: 0.01 });
    books.addBinding(PARAMS, "rotationVariance", {
      min: 0,
      max: 0.6,
      step: 0.01,
    });
    books.addBinding(PARAMS, "arcDepth", { min: 0, max: 2, step: 0.01 });
    books.addBinding(PARAMS, "bobAmount", { min: 0, max: 0.4, step: 0.005 });
    books.addBinding(PARAMS, "bobSpeed", { min: 0, max: 4, step: 0.05 });

    const camera = pane.addFolder({ title: "Camera", expanded: false });
    camera.addBinding(PARAMS, "camX", { min: -6, max: 6, step: 0.05 });
    camera.addBinding(PARAMS, "camY", { min: -4, max: 6, step: 0.05 });
    camera.addBinding(PARAMS, "camZ", { min: 1, max: 12, step: 0.05 });
    camera.addBinding(PARAMS, "fov", { min: 10, max: 90, step: 0.5 });

    const scene = pane.addFolder({ title: "Scene", expanded: false });
    scene.addBinding(PARAMS, "fogNear", { min: 0, max: 30, step: 0.5 });
    scene.addBinding(PARAMS, "fogFar", { min: 4, max: 60, step: 0.5 });

    const lights = pane.addFolder({ title: "Lights", expanded: false });
    lights.addBinding(PARAMS, "ambient", { min: 0, max: 3, step: 0.05 });
    lights.addBinding(PARAMS, "keyIntensity", { min: 0, max: 5, step: 0.05 });
    lights.addBinding(PARAMS, "keyX", { min: -10, max: 10, step: 0.1 });
    lights.addBinding(PARAMS, "keyY", { min: -2, max: 12, step: 0.1 });
    lights.addBinding(PARAMS, "keyZ", { min: -10, max: 10, step: 0.1 });
    lights.addBinding(PARAMS, "fillIntensity", { min: 0, max: 3, step: 0.05 });
    lights.addBinding(PARAMS, "rimIntensity", { min: 0, max: 3, step: 0.05 });
    lights.addBinding(PARAMS, "envIntensity", { min: 0, max: 3, step: 0.05 });

    const compass = pane.addFolder({ title: "Compass", expanded: false });
    compass.addBinding(PARAMS, "compassEnabled");
    compass.addBinding(PARAMS, "compassScale", {
      min: 0.1,
      max: 3,
      step: 0.05,
    });
    compass.addBinding(PARAMS, "compassY", { min: -3, max: 3, step: 0.05 });
    compass.addBinding(PARAMS, "compassTilt", {
      min: -1.5,
      max: 1.5,
      step: 0.01,
    });
    compass.addBinding(PARAMS, "compassWobble", {
      min: 0,
      max: 0.6,
      step: 0.01,
    });
    compass.addBinding(PARAMS, "compassRingsSpeed", {
      min: -2,
      max: 2,
      step: 0.05,
    });
    compass.addBinding(PARAMS, "compassSpokesSpeed", {
      min: -2,
      max: 2,
      step: 0.05,
    });
    compass.addBinding(PARAMS, "compassPlanetSpeed", {
      min: -3,
      max: 3,
      step: 0.05,
    });

    const sparkle = pane.addFolder({ title: "Sparkles", expanded: false });
    sparkle.addBinding(PARAMS, "sparkleEnabled");
    sparkle.addBinding(PARAMS, "sparkleSpeed", {
      min: 0,
      max: 4,
      step: 0.05,
    });
    sparkle.addBinding(PARAMS, "sparkleLifetime", {
      min: 0.3,
      max: 5,
      step: 0.05,
    });
    sparkle.addBinding(PARAMS, "sparkleSize", {
      min: 0.005,
      max: 0.15,
      step: 0.005,
    });

    const post = pane.addFolder({ title: "Post", expanded: true });
    post.addBinding(PARAMS, "toonShading");
    post.addBinding(PARAMS, "toonBands", { min: 2, max: 8, step: 1 });
    post
      .addBinding(PARAMS, "celOutline")
      .on("change", () => onPostToggle?.());
    post.addBinding(PARAMS, "outlineStrength", { min: 0.5, max: 10, step: 0.1 });
    post.addBinding(PARAMS, "outlineThickness", { min: 1, max: 8, step: 0.5 });

    return () => {
      pane.dispose();
      paneRef.current = null;
    };
  }, [onPostToggle, mounted]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={hostRef}
      // z-[2147483647] = the max safe int — guarantees the pane sits above
      // any ancestor stacking context introduced elsewhere on the page.
      className="fixed right-4 top-4 z-[2147483647] w-72 [&_.tp-rotv]:!font-mono"
    />,
    document.body,
  );
}
