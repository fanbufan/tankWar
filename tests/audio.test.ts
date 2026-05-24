import { describe, expect, it } from "vitest";
import { ArcadeAudio } from "../src/game/audio";

describe("arcade audio", () => {
  it("is safe to call in non-browser test environments", () => {
    const audio = new ArcadeAudio();

    expect(() => {
      audio.unlock();
      audio.playRuntimeEvents([{ type: "shot", owner: "player" }]);
      audio.playRuntimeEvents([{ type: "enemy-spawned", owner: "enemy" }]);
      audio.playRuntimeEvents([{ type: "enemy-destroyed", owner: "player", enemyType: "normal", score: 100 }]);
      audio.playRuntimeEvents([{ type: "powerup-spawned", powerUp: "star" }]);
      audio.playRuntimeEvents([{ type: "bonus-life", owner: "player", score: 20000 }]);
      audio.playOutcome("victory");
    }).not.toThrow();
  });
});
