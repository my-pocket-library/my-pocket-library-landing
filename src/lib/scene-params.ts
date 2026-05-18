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
  circleRadius: number; // radius of the horizontal carousel circle
  rotationY: number; // rotation offset added to each book's natural angle (rad)
  rotationVariance: number; // sin variance amplitude (rad)
  arcDepth: number; // y-axis sine modulation along the row
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

  // Cosmic compass (orbital diagram at the center of the carousel)
  compassEnabled: boolean;
  compassScale: number;
  compassY: number;
  compassTilt: number; // primary orbit tilt (rad)
  compassWobble: number; // wobble amplitude on tilted orbits
  compassRingsSpeed: number; // inner rings rotation (rad/s)
  compassSpokesSpeed: number; // spokes rotation (rad/s)
  compassPlanetSpeed: number; // multiplier on planet orbit speeds

  // Sparkle emitter (comet-like particles shooting outward from center)
  sparkleEnabled: boolean;
  sparkleSpeed: number; // speed multiplier
  sparkleLifetime: number; // average lifetime in seconds
  sparkleSize: number; // head sphere radius
};

export const PARAMS: SceneParams = {
  lerpFactor: 0.3,
  dragSensitivity: 0.02,
  scrollSensitivity: 3.3,
  speedDecay: 0.9,
  snap: false,
  scrollInput: true,

  bookWidth: 0.95,
  bookHeight: 1.46,
  bookDepth: 0.23,
  circleRadius: 2.85,
  rotationY: 1.43,
  rotationVariance: 0,
  arcDepth: 0,
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

  compassEnabled: true,
  compassScale: 1,
  compassY: -0.4,
  compassTilt: Math.PI / 5,
  compassWobble: 0.15,
  compassRingsSpeed: 0.12,
  compassSpokesSpeed: -0.05,
  compassPlanetSpeed: 1,

  sparkleEnabled: true,
  sparkleSpeed: 1,
  sparkleLifetime: 1.8,
  sparkleSize: 0.025,
};

