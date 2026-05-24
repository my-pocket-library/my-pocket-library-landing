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

/**
 * Floating dev-only controls for live-tuning PARAMS at runtime. Only fields
 * the active scene actually reads are bound — bloom, toon shading, compass,
 * sparkle and outline have all been removed along with their consumers, so
 * they don't appear here either.
 */
export function Tweakpane() {
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
      // Boot collapsed — keeps the dev panel out of the way until the
      // user actually wants to tweak something. Click the title bar to
      // expand. Every sub-folder is collapsed too (`expanded: false`).
      expanded: false,
    }) as unknown as PaneLike;
    paneRef.current = pane;

    const carousel = pane.addFolder({ title: "Carousel", expanded: false });
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
    carousel.addBinding(PARAMS, "autoCarousel");
    carousel.addBinding(PARAMS, "autoCarouselSpeed", {
      min: -2,
      max: 2,
      step: 0.02,
    });

    const carouselTransform = pane.addFolder({
      title: "Carousel Transform",
      expanded: false,
    });
    carouselTransform.addBinding(PARAMS, "carouselX", {
      min: -6,
      max: 6,
      step: 0.05,
    });
    carouselTransform.addBinding(PARAMS, "carouselY", {
      min: -6,
      max: 6,
      step: 0.05,
    });
    carouselTransform.addBinding(PARAMS, "carouselZ", {
      min: -6,
      max: 6,
      step: 0.05,
    });
    carouselTransform.addBinding(PARAMS, "carouselRotX", {
      min: -Math.PI,
      max: Math.PI,
      step: 0.01,
    });
    carouselTransform.addBinding(PARAMS, "carouselRotY", {
      min: -Math.PI,
      max: Math.PI,
      step: 0.01,
    });
    carouselTransform.addBinding(PARAMS, "carouselRotZ", {
      min: -Math.PI,
      max: Math.PI,
      step: 0.01,
    });
    carouselTransform.addBinding(PARAMS, "carouselScale", {
      min: 0.1,
      max: 4,
      step: 0.01,
    });

    const books = pane.addFolder({ title: "Books", expanded: false });
    const sizeKeys: (keyof SceneParams)[] = [
      "bookWidth",
      "bookHeight",
      "bookDepth",
    ];
    sizeKeys.forEach((k) => {
      books.addBinding(PARAMS, k, { min: 0.1, max: 4, step: 0.01 });
    });
    books.addBinding(PARAMS, "bookPagesEnabled");
    books.addBinding(PARAMS, "bookPagesScaleX", {
      min: 0.1,
      max: 3,
      step: 0.01,
    });
    books.addBinding(PARAMS, "bookPagesScaleY", {
      min: 0.1,
      max: 3,
      step: 0.01,
    });
    books.addBinding(PARAMS, "bookPagesScaleZ", {
      min: 0.1,
      max: 3,
      step: 0.01,
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

    const phone = pane.addFolder({ title: "Phone", expanded: false });
    phone.addBinding(PARAMS, "phoneEnabled");
    phone.addBinding(PARAMS, "phoneX", { min: -6, max: 6, step: 0.05 });
    phone.addBinding(PARAMS, "phoneY", { min: -6, max: 6, step: 0.05 });
    phone.addBinding(PARAMS, "phoneZ", { min: -2, max: 10, step: 0.05 });
    phone.addBinding(PARAMS, "phoneRotX", {
      min: -Math.PI,
      max: Math.PI,
      step: 0.01,
    });
    phone.addBinding(PARAMS, "phoneRotY", {
      min: -Math.PI,
      max: Math.PI,
      step: 0.01,
    });
    phone.addBinding(PARAMS, "phoneRotZ", {
      min: -Math.PI,
      max: Math.PI,
      step: 0.01,
    });
    phone.addBinding(PARAMS, "phoneScale", {
      min: 0.1,
      max: 3,
      step: 0.01,
    });

    phone.addBinding(PARAMS, "phoneMouseRotation");
    phone.addBinding(PARAMS, "phoneMouseStrengthX", {
      min: -1,
      max: 1,
      step: 0.01,
    });
    phone.addBinding(PARAMS, "phoneMouseStrengthY", {
      min: -1,
      max: 1,
      step: 0.01,
    });
    phone.addBinding(PARAMS, "phoneMouseLerp", {
      min: 0.01,
      max: 1,
      step: 0.01,
    });

    return () => {
      pane.dispose();
      paneRef.current = null;
    };
  }, [mounted]);

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
