import { describe, expect, it } from "vitest";
import { createInputState, reduceKeysToActions, reduceKeysToPlayerOneActions, reduceKeysToPlayerTwoActions } from "../src/game/input";

describe("input mapping", () => {
  it("maps arrow-space and WASD-J controls to the same action state", () => {
    const arrowState = reduceKeysToActions(new Set(["ArrowUp", "Space"]));
    const wasdState = reduceKeysToActions(new Set(["KeyW", "KeyJ"]));

    expect(arrowState).toEqual({ ...createInputState(), up: true, fire: true });
    expect(wasdState).toEqual({ ...createInputState(), up: true, fire: true });
  });

  it("maps P and Escape to pause", () => {
    expect(reduceKeysToActions(new Set(["KeyP"])).pause).toBe(true);
    expect(reduceKeysToActions(new Set(["Escape"])).pause).toBe(true);
  });

  it("splits controls for two-player mode", () => {
    const keys = new Set(["ArrowLeft", "Space", "KeyW", "KeyJ"]);

    expect(reduceKeysToPlayerOneActions(keys)).toEqual({ ...createInputState(), left: true, fire: true });
    expect(reduceKeysToPlayerTwoActions(keys)).toEqual({ ...createInputState(), up: true, fire: true });
  });
});
