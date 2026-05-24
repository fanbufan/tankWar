import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { stageIntroLabel } from "../stageIntro";
import type { LevelDefinition } from "../types";

interface StageIntroSceneData {
  levelIndex?: number;
  score?: number;
  players?: 1 | 2;
  customLevel?: LevelDefinition;
}

const BLACK = 0x000000;

export class StageIntroScene extends Phaser.Scene {
  private dataModel: StageIntroSceneData = { levelIndex: 0, score: 0, players: 1 };
  private started = false;

  public constructor() {
    super("StageIntroScene");
  }

  public init(data: StageIntroSceneData): void {
    this.dataModel = {
      levelIndex: data.levelIndex ?? 0,
      score: data.score ?? 0,
      players: data.players ?? 1,
      customLevel: data.customLevel,
    };
    this.started = false;
  }

  public create(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(BLACK, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 8, stageIntroLabel(this.dataModel.levelIndex ?? 0, this.dataModel.customLevel !== undefined), {
      fontFamily: '"Courier New", monospace',
      fontSize: "24px",
      color: "#fcfcfc",
    }).setOrigin(0.5);

    this.input.keyboard?.on("keydown-ENTER", this.startGame, this);
    this.input.keyboard?.on("keydown-SPACE", this.startGame, this);
    this.time.delayedCall(900, this.startGame, undefined, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown-ENTER", this.startGame, this);
      this.input.keyboard?.off("keydown-SPACE", this.startGame, this);
    });
  }

  private startGame(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.scene.start("GameScene", this.dataModel);
  }
}

