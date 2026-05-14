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

  // Books
  bookWidth: number;
  bookHeight: number;
  bookDepth: number;
  spacing: number;
  rotationY: number; // base rotation (rad)
  rotationVariance: number; // sin variance amplitude (rad)
  arcDepth: number; // forward/back curve amplitude
  bobAmount: number;
  bobSpeed: number;

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
  envIntensity: number;

  // Post / stylization
  toonShading: boolean;
  toonBands: number;
  celOutline: boolean;
  outlineStrength: number;
  outlineThickness: number;
};

export const PARAMS: SceneParams = {
  lerpFactor: 0.3,
  dragSensitivity: 0.02,
  scrollSensitivity: 3.3,
  speedDecay: 0.9,
  snap: false,
  scrollInput: true,

  bookWidth: 1.3,
  bookHeight: 1.95,
  bookDepth: 0.32,
  spacing: 1.01,
  rotationY: 0.55,
  rotationVariance: 0.49,
  arcDepth: 2.0,
  bobAmount: 0.05,
  bobSpeed: 0.6,

  camX: 0,
  camY: 0.6,
  camZ: 8.9,
  fov: 31.5,

  fogNear: 9,
  fogFar: 22,

  ambient: 2.5,
  keyIntensity: 3.4,
  keyX: -5.7,
  keyY: 6,
  keyZ: 10,
  fillIntensity: 0.6,
  rimIntensity: 0.9,
  envIntensity: 0.95,

  toonShading: false,
  toonBands: 4,
  celOutline: false,
  outlineStrength: 3,
  outlineThickness: 2,
};

