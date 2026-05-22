import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";

export class MenuScene extends Phaser.Scene {
  public constructor() {
    super("MenuScene");
  }

  public create(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x101418, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(0x1d2732, 1);
    graphics.fillRect(34, 34, GAME_WIDTH - 68, GAME_HEIGHT - 68);
    graphics.lineStyle(3, 0x6bd5ff, 1);
    graphics.strokeRect(34, 34, GAME_WIDTH - 68, GAME_HEIGHT - 68);
    graphics.lineStyle(1, 0x314355, 1);

    for (let x = 58; x < GAME_WIDTH - 58; x += 24) {
      graphics.lineBetween(x, 62, x, GAME_HEIGHT - 62);
    }

    for (let y = 62; y < GAME_HEIGHT - 62; y += 24) {
      graphics.lineBetween(58, y, GAME_WIDTH - 58, y);
    }

    this.add.text(GAME_WIDTH / 2, 92, "TANK WAR", {
      fontFamily: '"Courier New", monospace',
      fontSize: "54px",
      color: "#f8fafc",
      stroke: "#0a0f14",
      strokeThickness: 8,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 154, "现代像素 · 单人守基地", {
      fontFamily: '"Courier New", monospace',
      fontSize: "18px",
      color: "#6bd5ff",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 224, "ENTER 开始", {
      fontFamily: '"Courier New", monospace',
      fontSize: "24px",
      color: "#f5c451",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 282, "方向键 + 空格    或    WASD + J", {
      fontFamily: '"Courier New", monospace',
      fontSize: "16px",
      color: "#d7e2ea",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 316, "P / ESC 暂停 · 守住基地 · 清空 20 辆敌坦克", {
      fontFamily: '"Courier New", monospace',
      fontSize: "14px",
      color: "#93a4b5",
    }).setOrigin(0.5);

    this.input.keyboard?.on("keydown-ENTER", () => {
      this.scene.start("GameScene", { levelIndex: 0 });
    });
  }
}

