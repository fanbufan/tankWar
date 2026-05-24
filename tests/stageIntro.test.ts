import { describe, expect, it } from "vitest";
import { stageIntroLabel } from "../src/game/stageIntro";

describe("stage intro", () => {
  it("formats arcade stage labels with one-based numbering", () => {
    expect(stageIntroLabel(0)).toBe("STAGE 1");
    expect(stageIntroLabel(34)).toBe("STAGE 35");
  });

  it("uses a distinct label for construction stages", () => {
    expect(stageIntroLabel(0, true)).toBe("STAGE EDIT");
  });
});

