// Mutable shared parameters. Tweakpane mutates these; the scene reads them
// every frame so most edits are reflected without a React re-render.
// Values that change geometry (book width/height/depth, spacing) trigger a
// React re-render via the bumpRevision callback.

export type SceneParams = {
  // Carousel motion
  lerpFactor: number;
  dragSensitivity: number;
  scrollSensitivity: number;
  speedDecay: number;
  snap: boolean;
  scrollInput: boolean;
  autoCarousel: boolean; // continuous auto-rotation when idle
  autoCarouselSpeed: number; // items advanced per second

  // Books
  bookWidth: number;
  bookHeight: number;
  bookDepth: number;
  /** Toggle the inner paper mesh (the page block visible at top/bottom/open
   *  edge of each book). Off makes books read as solid boxes. */
  bookPagesEnabled: boolean;
  /** Per-axis scale multipliers on the paper block, applied via mesh.scale
   *  on top of the cover-derived paperLayout dimensions. 1 = natural size,
   *  >1 makes the pages stick out further, <1 hides them inside the cover. */
  bookPagesScaleX: number;
  bookPagesScaleY: number;
  bookPagesScaleZ: number;
  circleRadius: number; // radius of the horizontal carousel circle
  rotationY: number; // rotation offset added to each book's natural angle (rad)
  rotationVariance: number; // sin variance amplitude (rad)

  // Camera
  camX: number;
  camY: number;
  camZ: number;
  fov: number;

  // Fog
  fogNear: number;
  fogFar: number;

  // Lights
  ambient: number;
  keyIntensity: number;
  keyX: number;
  keyY: number;
  keyZ: number;
  fillIntensity: number;
  rimIntensity: number;

  // Phone (3D smartphone with render-target screen showing the active book).
  phoneEnabled: boolean;
  phoneX: number;
  phoneY: number;
  phoneZ: number;
  phoneRotX: number; // rad
  phoneRotY: number; // rad
  phoneRotZ: number; // rad
  phoneScale: number; // uniform scale multiplier on the phone group

  // Mouse-driven parallax rotation on the phone. Normalized mouse coords
  // (in [-1, +1] from viewport centre) are multiplied by Strength to produce
  // a target rotation offset, then lerped each frame toward it. Added on
  // top of the base phoneRot* values, not overriding them.
  phoneMouseRotation: boolean;
  phoneMouseStrengthX: number; // rad, max pitch offset at max |mouseY|
  phoneMouseStrengthY: number; // rad, max yaw   offset at max |mouseX|
  phoneMouseLerp: number;      // 0..1, smoothing per frame (higher = snappier)

  // Carousel transform — translate / rotate / scale the entire ring of
  // books as a rigid body. Applied on the outer <group> wrapping all 14
  // book nodes (so per-book layout still happens in carousel-local space).
  carouselX: number;
  carouselY: number;
  carouselZ: number;
  carouselRotX: number; // rad
  carouselRotY: number; // rad
  carouselRotZ: number; // rad
  carouselScale: number; // uniform scale multiplier
};

export const PARAMS: SceneParams = {
  lerpFactor: 0.3,
  dragSensitivity: 0.02,
  scrollSensitivity: 3.3,
  speedDecay: 0.9,
  snap: false,
  scrollInput: false,
  autoCarousel: true,
  autoCarouselSpeed: 0.3,

  bookWidth: 1.20,
  bookHeight: 1.75,
  bookDepth: 0.31,
  bookPagesEnabled: true,
  bookPagesScaleX: 1,
  bookPagesScaleY: 1,
  bookPagesScaleZ: 1,
  circleRadius: 3.90,
  rotationY: 0.26,
  rotationVariance: 0,

  camX: 0,
  camY: 0.5,
  camZ: 10,
  fov: 30,

  fogNear: 13.5,
  fogFar: 22,

  ambient: 2.5,
  keyIntensity: 5.0,
  keyX: -3.5,
  keyY: 12.0,
  keyZ: 10.0,
  fillIntensity: 1.65,
  rimIntensity: 0,

  phoneEnabled: true,
  phoneX: 0,
  phoneY: 0.15,
  phoneZ: 4.15,
  phoneRotX: -0.20,
  phoneRotY: -0.34,
  phoneRotZ: 0,
  phoneScale: 0.83,

  phoneMouseRotation: true,
  phoneMouseStrengthX: 0.15,
  phoneMouseStrengthY: 0.20,
  phoneMouseLerp: 0.08,

  carouselX: 0,
  carouselY: 1.00,
  carouselZ: -1.30,
  carouselRotX: 0.07,
  carouselRotY: 0,
  carouselRotZ: 0,
  carouselScale: 1.07,
};

