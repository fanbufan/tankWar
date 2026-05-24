import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import type { RuntimeStageStatsSnapshot } from "../runtime/types";
import type { EnemyType, LevelDefinition } from "../types";

const BLACK = 0x000000;
const RED = 0xd82800;
const YELLOW = 0xf8d878;

type ResultOutcome = "level-complete" | "victory" | "defeat";

interface ResultSceneData {
  outcome: ResultOutcome;
  levelIndex: number;
  score: number;
  players?: 1 | 2;
  customLevel?: LevelDefinition;
  stageStats?: RuntimeStageStatsSnapshot;
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
      players: data.players ?? 1,
      customLevel: data.customLevel,
      stageStats: data.stageStats,
    };
  }

  public create(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(BLACK, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const title = this.getTitle();
    const prompt = this.getPrompt();

    this.add.text(GAME_WIDTH / 2, 128, title, {
      fontFamily: '"Courier New", monospace',
      fontSize: "24px",
      color: this.dataModel.outcome === "defeat" ? "#d82800" : "#fcfcfc",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 196, "I-PLAYER", {
      fontFamily: '"Courier New", monospace',
      fontSize: "18px",
      color: "#fcfcfc",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 226, `${this.dataModel.score.toString().padStart(6, "0")} PTS`, {
      fontFamily: '"Courier New", monospace',
      fontSize: "18px",
      color: "#f8d878",
    }).setOrigin(0.5);

    this.drawStageStats();

    this.add.text(GAME_WIDTH / 2, this.dataModel.stageStats && this.dataModel.outcome !== "defeat" ? 382 : 312, prompt, {
      fontFamily: '"Courier New", monospace',
      fontSize: "16px",
      color: "#fcfcfc",
      align: "center",
    }).setOrigin(0.5);

    if (this.dataModel.outcome === "defeat") {
      this.drawGameOverMarker(graphics);
    }

    this.input.keyboard?.on("keydown-ENTER", () => {
      if (this.dataModel.outcome === "level-complete") {
        this.scene.start("StageIntroScene", { levelIndex: this.dataModel.levelIndex + 1, score: this.dataModel.score, players: this.dataModel.players });
        return;
      }

      this.scene.start("MenuScene");
    });

    this.input.keyboard?.on("keydown-R", () => {
      this.scene.start("StageIntroScene", {
        levelIndex: this.dataModel.levelIndex,
        score: 0,
        players: this.dataModel.players,
        customLevel: this.dataModel.customLevel,
      });
    });
  }

  private getTitle(): string {
    if (this.dataModel.customLevel && this.dataModel.outcome !== "defeat") {
      return "CONSTRUCTION CLEAR";
    }

    if (this.dataModel.outcome === "victory") {
      return "ALL STAGES CLEAR";
    }

    if (this.dataModel.outcome === "level-complete") {
      if (this.dataModel.customLevel) {
        return "CONSTRUCTION CLEAR";
      }

      return `STAGE ${this.dataModel.levelIndex + 1} CLEAR`;
    }

    return "GAME OVER";
  }

  private getPrompt(): string {
    if (this.dataModel.outcome === "level-complete") {
      return "PUSH ENTER";
    }

    if (this.dataModel.outcome === "victory") {
      return "PUSH ENTER";
    }

    return "PUSH ENTER";
  }

  private drawStageStats(): void {
    if (!this.dataModel.stageStats || this.dataModel.outcome === "defeat") {
      return;
    }

    const enemyTypes: EnemyType[] = ["normal", "fast", "power", "armor"];
    const labels: Record<EnemyType, string> = {
      normal: "BASIC",
      fast: "FAST",
      power: "POWER",
      armor: "ARMOR",
    };

    enemyTypes.forEach((type, index) => {
      const y = 254 + index * 18;
      const count = this.dataModel.stageStats?.destroyedEnemies[type] ?? 0;
      const score = this.dataModel.stageStats?.enemyScore[type] ?? 0;

      this.add.text(GAME_WIDTH / 2 - 118, y, labels[type], {
        fontFamily: '"Courier New", monospace',
        fontSize: "13px",
        color: "#fcfcfc",
      }).setOrigin(0, 0.5);

      this.add.text(GAME_WIDTH / 2 + 14, y, `${count.toString().padStart(2, "0")}  ${score.toString().padStart(4, "0")}`, {
        fontFamily: '"Courier New", monospace',
        fontSize: "13px",
        color: "#f8d878",
      }).setOrigin(0, 0.5);
    });

    this.drawSupplementalStageStat("ITEM", this.dataModel.stageStats.powerUpScore, 330);
    this.drawSupplementalStageStat("BONUS", this.dataModel.stageStats.bonusLives, 348);
  }

  private drawSupplementalStageStat(label: string, value: number, y: number): void {
    this.add.text(GAME_WIDTH / 2 - 118, y, label, {
      fontFamily: '"Courier New", monospace',
      fontSize: "13px",
      color: "#fcfcfc",
    }).setOrigin(0, 0.5);

    this.add.text(GAME_WIDTH / 2 + 14, y, value.toString().padStart(4, "0"), {
      fontFamily: '"Courier New", monospace',
      fontSize: "13px",
      color: "#f8d878",
    }).setOrigin(0, 0.5);
  }

  private drawGameOverMarker(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(RED, 1);
    graphics.fillRect(GAME_WIDTH / 2 - 54, 268, 108, 4);
    graphics.fillStyle(YELLOW, 1);
    graphics.fillRect(GAME_WIDTH / 2 - 54, 276, 108, 4);
  }
}
