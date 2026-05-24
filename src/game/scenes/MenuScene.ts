import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";

const BLACK = 0x000000;
const GRAY = 0x7b7b7b;
const ORANGE = 0xe87818;
const RED = 0xd82800;

export class MenuScene extends Phaser.Scene {
  private selectedIndex = 0;
  private pointerText?: Phaser.GameObjects.Text;
  private optionTexts: Phaser.GameObjects.Text[] = [];

  public constructor() {
    super("MenuScene");
  }

  public create(): void {
    this.selectedIndex = 0;
    this.optionTexts = [];
    const graphics = this.add.graphics();
    graphics.fillStyle(BLACK, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.drawTitleBlocks(graphics);

    this.add.text(GAME_WIDTH / 2, 152, "TANK WAR", {
      fontFamily: '"Courier New", monospace',
      fontSize: "44px",
      color: "#fcfcfc",
    }).setOrigin(0.5);

    this.pointerText = this.add.text(GAME_WIDTH / 2 - 88, 226, ">", {
      fontFamily: '"Courier New", monospace',
      fontSize: "22px",
      color: "#fcfcfc",
    }).setOrigin(0.5);

    this.optionTexts.push(this.add.text(GAME_WIDTH / 2, 226, "1 PLAYER", {
      fontFamily: '"Courier New", monospace',
      fontSize: "22px",
      color: "#fcfcfc",
    }).setOrigin(0.5));

    this.optionTexts.push(this.add.text(GAME_WIDTH / 2, 264, "2 PLAYERS", {
      fontFamily: '"Courier New", monospace',
      fontSize: "22px",
      color: "#fcfcfc",
    }).setOrigin(0.5));

    this.optionTexts.push(this.add.text(GAME_WIDTH / 2, 302, "CONSTRUCTION", {
      fontFamily: '"Courier New", monospace',
      fontSize: "22px",
      color: "#fcfcfc",
    }).setOrigin(0.5));

    this.add.text(GAME_WIDTH / 2, 368, "1985  ARCADE  RULES", {
      fontFamily: '"Courier New", monospace',
      fontSize: "14px",
      color: "#fcfcfc",
    }).setOrigin(0.5);

    this.input.keyboard?.on("keydown-UP", () => this.moveSelection(-1));
    this.input.keyboard?.on("keydown-W", () => this.moveSelection(-1));
    this.input.keyboard?.on("keydown-DOWN", () => this.moveSelection(1));
    this.input.keyboard?.on("keydown-S", () => this.moveSelection(1));
    this.input.keyboard?.on("keydown-ENTER", () => this.startSelectedMode());
    this.updateSelection();
  }

  private moveSelection(delta: number): void {
    this.selectedIndex = (this.selectedIndex + delta + this.optionTexts.length) % this.optionTexts.length;
    this.updateSelection();
  }

  private updateSelection(): void {
    this.pointerText?.setY(226 + this.selectedIndex * 38);

    this.optionTexts.forEach((text, index) => {
      text.setColor(index === this.selectedIndex ? "#f8d878" : "#fcfcfc");
    });
  }

  private startSelectedMode(): void {
    if (this.selectedIndex === 2) {
      this.scene.start("ConstructionScene");
      return;
    }

    this.scene.start("StageIntroScene", { levelIndex: 0, players: this.selectedIndex === 1 ? 2 : 1 });
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
