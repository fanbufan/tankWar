export function stageIntroLabel(levelIndex: number, isCustomStage = false): string {
  if (isCustomStage) {
    return "STAGE EDIT";
  }

  return `STAGE ${levelIndex + 1}`;
}

