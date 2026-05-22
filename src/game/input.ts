import type { InputState } from "./types";

export function createInputState(): InputState {
  return { up: false, down: false, left: false, right: false, fire: false, pause: false };
}

export function reduceKeysToActions(keys: Set<string>): InputState {
  return {
    up: keys.has("ArrowUp") || keys.has("KeyW"),
    down: keys.has("ArrowDown") || keys.has("KeyS"),
    left: keys.has("ArrowLeft") || keys.has("KeyA"),
    right: keys.has("ArrowRight") || keys.has("KeyD"),
    fire: keys.has("Space") || keys.has("KeyJ"),
    pause: keys.has("KeyP") || keys.has("Escape"),
  };
}
