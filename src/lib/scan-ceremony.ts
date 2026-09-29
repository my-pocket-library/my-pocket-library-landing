/**
 * The hero phone plays the app's ISBN scan ceremony on a loop — the same
 * beats as ScanCeremony.swift / BookApprovalSheet.swift in the pocket-library
 * repo: aim at a book's barcode ("Point at a barcode"), "Looking up 9780…",
 * "Got it!", then the approval sheet rises black while a glowing wireframe
 * book turns where the cover will sit, and the cover, its title and
 * "Add to library" fade up.
 *
 * t is seconds into the current cycle. t = 0 is when the carousel starts
 * turning to the next book and the previous book's sheet slides away.
 */

// The app's beats (ScanBeat).
export const MINIMUM_LOOK = 0.95;
export const ACKNOWLEDGEMENT = 0.42;
export const SHEET_RISE = 0.3;
export const SPIN = 1.4;
export const CROSSFADE = 0.45;
/** Whole turns, so the box is frontal when the cover takes over. */
const TURNS = 2;

// The loop around them.
export const SHEET_DISMISS = 0.3;
/** The carousel has settled on the next book; the barcode reads. */
export const DETECT_AT = 1.15;
export const ACK_AT = DETECT_AT + MINIMUM_LOOK;
export const RISE_AT = ACK_AT + ACKNOWLEDGEMENT;
export const SPIN_AT = RISE_AT + SHEET_RISE;
export const REVEAL_AT = SPIN_AT + SPIN;
export const RESULT_AT = REVEAL_AT + CROSSFADE;
export const PRESS_AT = RESULT_AT + 0.7;
const PRESS_LENGTH = 0.22;
export const CYCLE = 6;

/** After a drag or a tap, the scan starts this long before the read. */
export const AIM_DWELL = 0.35;

const RETICLE_DIM = 0.28;
const PULSE_LENGTH = 0.28;
const PILL_ENTRANCE = 0.24;

export type PillState = "aim" | "looking" | "got";

export type ScreenState = {
  pill: PillState;
  /** 0 → 1 entrance of the current pill (fade + slight scale). */
  pillIn: number;
  reticle: number;
  /** 0 → 1 → 0 bump of the reticle at the read. */
  pulse: number;
  spinner: boolean;
  /** 0 = below the screen, 1 = fully risen. */
  sheet: number;
  /** Black over the sheet while the wireframe turns. */
  black: number;
  /** The sheet's cover, title and buttons. */
  content: number;
  /** The turning wireframe, when it is on screen. */
  spin: { angle: number; opacity: number } | null;
  /** 0 → 1 pressed state of "Add to library". */
  press: number;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;
const easeInOut = (x: number) => {
  const p = clamp01(x);
  return p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
};

/** The phone screen at t seconds into a cycle. */
export function screenAt(t: number): ScreenState {
  const pill: PillState = t < DETECT_AT ? "aim" : t < ACK_AT ? "looking" : "got";
  const pillSince = pill === "aim" ? 0 : pill === "looking" ? DETECT_AT : ACK_AT;

  const dismissing = 1 - easeInOut(t / SHEET_DISMISS);
  const rising = easeOut((t - RISE_AT) / SHEET_RISE);
  const sheet = t < RISE_AT ? dismissing : rising;

  const turn = clamp01((t - SPIN_AT) / (SPIN + CROSSFADE));
  const fade = clamp01((t - REVEAL_AT) / CROSSFADE);
  const spinning = t >= SPIN_AT && t < RESULT_AT;

  const pressT = (t - PRESS_AT) / PRESS_LENGTH;

  return {
    pill,
    pillIn: pill === "aim" ? 1 : easeOut((t - pillSince) / PILL_ENTRANCE),
    reticle: 0.95 - 0.7 * easeOut((t - DETECT_AT) / RETICLE_DIM),
    pulse: t >= DETECT_AT && t < DETECT_AT + PULSE_LENGTH
      ? Math.sin(((t - DETECT_AT) / PULSE_LENGTH) * Math.PI)
      : 0,
    spinner: pill === "looking",
    sheet,
    // Content shows through the black once the turn is done; before the
    // sheet next rises (t < RISE_AT) it is still the previous book's
    // finished sheet sliding away.
    black: t < RISE_AT ? 0 : 1 - fade,
    content: t < RISE_AT ? 1 : fade,
    spin: spinning
      ? { angle: 2 * Math.PI * TURNS * (1 - turn) ** 3, opacity: 1 - fade }
      : null,
    press: pressT > 0 && pressT < 1 ? Math.sin(pressT * Math.PI) : 0,
  };
}

/** While the visitor spins the shelf: camera up, aiming, no sheet. */
export const AIMING: ScreenState = {
  pill: "aim",
  pillIn: 1,
  reticle: 0.95,
  pulse: 0,
  spinner: false,
  sheet: 0,
  black: 0,
  content: 1,
  spin: null,
  press: 0,
};

// Stretches of the cycle where something on screen moves. Outside them the
// scene can idle until the next boundary.
const MOVING: [number, number][] = [
  [0, SHEET_DISMISS],
  [DETECT_AT, ACK_AT],
  [ACK_AT, ACK_AT + PILL_ENTRANCE],
  [RISE_AT, RESULT_AT],
  [PRESS_AT, PRESS_AT + PRESS_LENGTH],
];

/** Whether the screen is animating at t, and if not, how long until it
 *  next does in this cycle (Infinity once the cycle's beats are over). */
export function screenActivity(t: number): { moving: boolean; wakeIn: number } {
  for (const [start, end] of MOVING) {
    if (t >= start && t < end) return { moving: true, wakeIn: 0 };
  }
  const next = MOVING.map(([start]) => start).find((start) => start > t);
  return { moving: false, wakeIn: next === undefined ? Infinity : next - t };
}

/** "9780…3565" — the ends are what a reader recognises (the app's own rule). */
export function abbreviatedIsbn(isbn: string) {
  return isbn.length > 9 ? `${isbn.slice(0, 4)}…${isbn.slice(-4)}` : isbn;
}

// ---------------------------------------------------------------------------
// EAN-13 — the barcode on the back of every book, drawn from the ISBN.
// ---------------------------------------------------------------------------

const L_CODES = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const R_CODES = L_CODES.map((code) => [...code].map((bit) => (bit === "1" ? "0" : "1")).join(""));
const G_CODES = R_CODES.map((code) => [...code].reverse().join(""));
/** Parity of digits 2–7, chosen by the first digit. */
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

/** The 95 modules of an EAN-13 symbol, "1" = bar. */
export function ean13Modules(isbn: string): string {
  const digits = [...isbn].map(Number);
  const parity = PARITY[digits[0]];
  let bits = "101";
  for (let i = 1; i <= 6; i++) {
    bits += (parity[i - 1] === "L" ? L_CODES : G_CODES)[digits[i]];
  }
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += R_CODES[digits[i]];
  return bits + "101";
}
