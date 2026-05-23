import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";

const BLACK = 0x000000;
const GRAY = 0x7b7b7b;
const ORANGE = 0xe87818;
const RED = 0xd82800;

export class MenuScene extends Phaser.Scene {
  public constructor() {
    super("MenuScene");
  }

  public create(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(BLACK, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.drawTitleBlocks(graphics);

    this.add.text(GAME_WIDTH / 2, 152, "TANK WAR", {
      fontFamily: '"Courier New", monospace',
      fontSize: "44px",
      color: "#fcfcfc",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2 - 88, 226, ">", {
      fontFamily: '"Courier New", monospace',
      fontSize: "22px",
      color: "#fcfcfc",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 226, "1 PLAYER", {
      fontFamily: '"Courier New", monospace',
      fontSize: "22px",
      color: "#fcfcfc",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 264, "2 PLAYERS", {
      fontFamily: '"Courier New", monospace',
      fontSize: "22px",
      color: "#7b7b7b",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 302, "CONSTRUCTION", {
      fontFamily: '"Courier New", monospace',
      fontSize: "22px",
      color: "#7b7b7b",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 368, "1985  ARCADE  RULES", {
      fontFamily: '"Courier New", monospace',
      fontSize: "14px",
      color: "#fcfcfc",
    }).setOrigin(0.5);

    this.input.keyboard?.on("keydown-ENTER", () => {
      this.scene.start("GameScene", { levelIndex: 0 });
    });
  }

  private drawTitleBlocks(graphics: Phaser.GameObjects.Graphics): void {
    const startX = GAME_WIDTH / 2 - 124;
    const startY = 60;

    for (let index = 0; index < 14; index += 1) {
      const x = startX + (index % 7) * 36;
      const y = startY + Math.floor(index / 7) * 32;
      graphics.fillStyle(index % 3 === 0 ? RED : ORANGE, 1);
      graphics.fillRect(x, y, 30, 24);
      graphics.fillStyle(GRAY, 1);
      graphics.fillRect(x + 2, y + 10, 26, 3);
      graphics.fillRect(x + 13, y + 2, 3, 20);
    }
  }
}
