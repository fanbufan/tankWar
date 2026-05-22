import Phaser from "phaser";
import { LEVELS } from "../../levels";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";

type ResultOutcome = "level-complete" | "victory" | "defeat";

interface ResultSceneData {
  outcome: ResultOutcome;
  levelIndex: number;
  score: number;
}

export class ResultScene extends Phaser.Scene {
  private dataModel: ResultSceneData = { outcome: "defeat", levelIndex: 0, score: 0 };

  public constructor() {
    super("ResultScene");
  }

  public init(data: Partial<ResultSceneData>): void {
    this.dataModel = {
      outcome: data.outcome ?? "defeat",
      levelIndex: data.levelIndex ?? 0,
      score: data.score ?? 0,
    };
  }

  public create(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x101418, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(0x17212b, 1);
    graphics.fillRect(42, 48, GAME_WIDTH - 84, GAME_HEIGHT - 96);
    graphics.lineStyle(3, this.dataModel.outcome === "defeat" ? 0xff6b6b : 0x6bd5ff, 1);
    graphics.strokeRect(42, 48, GAME_WIDTH - 84, GAME_HEIGHT - 96);

    const title = this.getTitle();
    const prompt = this.getPrompt();

    this.add.text(GAME_WIDTH / 2, 128, title, {
      fontFamily: '"Courier New", monospace',
      fontSize: "34px",
      color: this.dataModel.outcome === "defeat" ? "#ffb1b1" : "#f8fafc",
      stroke: "#0a0f14",
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 194, `SCORE ${this.dataModel.score}`, {
      fontFamily: '"Courier New", monospace',
      fontSize: "22px",
      color: "#f5c451",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 264, prompt, {
      fontFamily: '"Courier New", monospace',
      fontSize: "16px",
      color: "#d7e2ea",
      align: "center",
    }).setOrigin(0.5);

    this.input.keyboard?.on("keydown-ENTER", () => {
      if (this.dataModel.outcome === "level-complete") {
        this.scene.start("GameScene", { levelIndex: this.dataModel.levelIndex + 1, score: this.dataModel.score });
        return;
      }

      this.scene.start("MenuScene");
    });

    this.input.keyboard?.on("keydown-R", () => {
      this.scene.start("GameScene", { levelIndex: this.dataModel.levelIndex, score: 0 });
    });
  }

  private getTitle(): string {
    if (this.dataModel.outcome === "victory") {
      return "ALL STAGES CLEAR";
    }

    if (this.dataModel.outcome === "level-complete") {
      return `${LEVELS[this.dataModel.levelIndex].name} CLEAR`;
    }

    return "BASE LOST";
  }

  private getPrompt(): string {
    if (this.dataModel.outcome === "level-complete") {
      return "ENTER 进入下一关";
    }

    if (this.dataModel.outcome === "victory") {
      return "ENTER 返回菜单 · R 重新挑战";
    }

    return "ENTER 返回菜单 · R 重试本关";
  }
}

