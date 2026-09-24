// The hero scene renders on demand: only while something moves. Changes made
// outside React Three Fiber's frame loop — a cover image arriving, a spine
// repainted once fonts load, a tweakpane knob — ask for a frame here, and
// BookScene subscribes its invalidate().

const listeners = new Set<() => void>();

export function onFrameRequest(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestFrame() {
  for (const listener of listeners) listener();
}
