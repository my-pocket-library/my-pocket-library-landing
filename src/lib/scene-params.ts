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
  bloomEnabled: boolean;
  bloomIntensity: number; // additive strength of the bloom pass
  bloomThreshold: number; // luminance above which bloom kicks in
  bloomSmoothing: number; // softness of the threshold transition

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

  // Scan sparkles — rust-dust flecks emitted by the scan line on the centered book.
  scanSparklesEnabled: boolean;
  scanSparkleRate: number; // spawn rate (particles per second)
  scanSparkleSize: number; // base point size (px at depth 1)
  scanSparkleGravity: number; // downward acceleration (units/s²)
  scanSparkleSpeed: number; // mean speed (units/s); jittered ±50%
  scanSparkleLife: number; // mean lifetime (s); jittered ±30%
  scanSparkleKick: number; // scan-direction kick strength (0..1)
  scanSparkleSpread: number; // cone spread (0 = forward, 1 = full hemisphere)
  scanSparkleSpiral: number; // firework-spiral intensity (0 = ballistic only)

  // Phone (3D smartphone with render-target screen showing the active book).
  phoneEnabled: boolean;
  phoneX: number;
  phoneY: number;
  phoneZ: number;
  phoneRotX: number; // rad
  phoneRotY: number; // rad
  phoneRotZ: number; // rad
  phoneScale: number; // uniform scale multiplier on the phone group

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

  bookWidth: 0.99,
  bookHeight: 1.54,
  bookDepth: 0.23,
  circleRadius: 3.45,
  rotationY: 0,
  rotationVariance: 0.06,
  arcDepth: 0.3,
  bobAmount: 0.025,
  bobSpeed: 0.6,

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
  envIntensity: 3.0,

  toonShading: true,
  toonBands: 8,
  celOutline: false,
  outlineStrength: 3.6,
  outlineThickness: 2.0,
  bloomEnabled: true,
  bloomIntensity: 1.0,
  bloomThreshold: 0.85,
  bloomSmoothing: 0.4,

  compassEnabled: true,
  compassScale: 0.55,
  compassY: -0.85,
  compassTilt: 0.26,
  compassWobble: 0.6,
  compassRingsSpeed: 2.0,
  compassSpokesSpeed: 2.0,
  compassPlanetSpeed: 3.0,

  sparkleEnabled: true,
  sparkleSpeed: 1.1,
  sparkleLifetime: 0.9,
  sparkleSize: 0.01,

  scanSparklesEnabled: true,
  scanSparkleRate: 380,
  scanSparkleSize: 60,
  scanSparkleGravity: 0.55,
  scanSparkleSpeed: 0.6,
  scanSparkleLife: 0.8,
  scanSparkleKick: 0.35,
  scanSparkleSpread: 0.75,
  scanSparkleSpiral: 0.6,

  phoneEnabled: true,
  phoneX: 0,
  phoneY: 0.15,
  phoneZ: 4.15,
  phoneRotX: -0.20,
  phoneRotY: -0.34,
  phoneRotZ: 0,
  phoneScale: 0.83,

  carouselX: 0,
  carouselY: 0.90,
  carouselZ: 0.15,
  carouselRotX: 0,
  carouselRotY: 0,
  carouselRotZ: 0,
  carouselScale: 0.99,
};

