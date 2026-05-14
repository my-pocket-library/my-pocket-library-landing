"use client";

import { useEffect, useRef } from "react";
import { Pane } from "tweakpane";
import { PARAMS, type SceneParams } from "@/lib/scene-params";

// Tweakpane v4 ships incomplete public types for addFolder / addBinding
// (the methods exist at runtime via FolderApi). Cast at the boundary.
type BindingOpts = { min?: number; max?: number; step?: number };
type Folder = {
  addBinding: (target: object, key: string, opts?: BindingOpts) => unknown;
};
type PaneLike = Folder & {
  addFolder: (cfg: { title: string; expanded?: boolean }) => Folder;
  dispose: () => void;
};

export function Tweakpane() {
  const hostRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<PaneLike | null>(null);

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
    books.addBinding(PARAMS, "spacing", { min: 0.1, max: 2, step: 0.01 });
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

    return () => {
      pane.dispose();
      paneRef.current = null;
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="fixed right-4 top-4 z-50 w-72 [&_.tp-rotv]:!font-mono"
    />
  );
}
