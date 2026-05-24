import Phaser from "phaser";
import { SPRITE_FRAMES, SPRITE_SHEETS } from "../assets/spriteManifest";
import {
  buildConstructionLevel,
  CONSTRUCTION_TILE_ORDER,
  createConstructionGrid,
  cycleConstructionTile,
  isConstructionLockedTile,
} from "../construction";
import { CONFIG, GAME_HEIGHT, GAME_WIDTH } from "../config";
import { tileToCenter } from "../geometry";
import type { GridPoint, TileType } from "../types";

const PLAYFIELD_WIDTH = CONFIG.gridColumns * CONFIG.tileSize;
const BLACK = 0x000000;
const HUD_GRAY = 0x7b7b7b;
const HUD_DARK = 0x111111;
const WHITE = 0xfcfcfc;
const YELLOW = 0xf8d878;

const terrainUrl = new URL("../../assets/sprites/terrain.png", import.meta.url).href;

export class ConstructionScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private tileLayer!: Phaser.GameObjects.Container;
  private hudLayer!: Phaser.GameObjects.Container;
  private grid: TileType[][] = createConstructionGrid();
  private cursor: GridPoint = { x: 6, y: 6 };

  public constructor() {
    super("ConstructionScene");
  }

  public preload(): void {
    if (!this.textures.exists(SPRITE_SHEETS.terrain.key)) {
      this.load.spritesheet(SPRITE_SHEETS.terrain.key, terrainUrl, {
        frameWidth: SPRITE_SHEETS.terrain.frameWidth,
        frameHeight: SPRITE_SHEETS.terrain.frameHeight,
      });
    }
  }

  public create(): void {
    this.grid = createConstructionGrid();
    this.cursor = { x: 6, y: 6 };
    this.graphics = this.add.graphics();
    this.tileLayer = this.add.container(0, 0).setDepth(2);
    this.hudLayer = this.add.container(0, 0).setDepth(10);

    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown", this.handleKeyDown, this);
    });

    this.render();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.isEditorKey(event.code)) {
      event.preventDefault();
    }

    if (event.code === "Escape") {
      this.scene.start("MenuScene");
      return;
    }

    if (event.code === "Enter") {
      this.scene.start("StageIntroScene", { levelIndex: 0, players: 1, customLevel: buildConstructionLevel(this.grid) });
      return;
    }

    if (event.code === "Space" || event.code === "KeyJ") {
      this.grid = cycleConstructionTile(this.grid, this.cursor, event.shiftKey);
      this.render();
      return;
    }

    this.moveCursor(event.code);
  }

  private moveCursor(code: string): void {
    const next = { ...this.cursor };

    if (code === "ArrowUp" || code === "KeyW") next.y -= 1;
    if (code === "ArrowDown" || code === "KeyS") next.y += 1;
    if (code === "ArrowLeft" || code === "KeyA") next.x -= 1;
    if (code === "ArrowRight" || code === "KeyD") next.x += 1;

    next.x = Phaser.Math.Clamp(next.x, 0, CONFIG.gridColumns - 1);
    next.y = Phaser.Math.Clamp(next.y, 0, CONFIG.gridRows - 1);

    if (next.x !== this.cursor.x || next.y !== this.cursor.y) {
      this.cursor = next;
      this.render();
    }
  }

  private render(): void {
    this.graphics.clear();
    this.tileLayer.removeAll(true);
    this.hudLayer.removeAll(true);
    this.drawBackdrop();
    this.drawGrid();
    this.drawHud();
    this.drawCursor();
  }

  private drawBackdrop(): void {
    this.graphics.fillStyle(HUD_GRAY, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.graphics.fillStyle(BLACK, 1);
    this.graphics.fillRect(0, 0, PLAYFIELD_WIDTH, GAME_HEIGHT);
    this.graphics.lineStyle(2, HUD_DARK, 1);
    this.graphics.lineBetween(PLAYFIELD_WIDTH, 0, PLAYFIELD_WIDTH, GAME_HEIGHT);
  }

  private drawGrid(): void {
    for (let y = 0; y < CONFIG.gridRows; y += 1) {
      for (let x = 0; x < CONFIG.gridColumns; x += 1) {
        this.drawTile(this.grid[y][x], { x, y });
      }
    }
  }

  private drawTile(tile: TileType, point: GridPoint): void {
    if (tile === "empty") {
      return;
    }

    const center = tileToCenter(point);
    this.tileLayer.add(
      this.add
        .image(center.x, center.y, SPRITE_SHEETS.terrain.key, SPRITE_FRAMES.terrain[tile])
        .setOrigin(0.5)
        .setDepth(tile === "grass" ? 3 : 1),
    );
  }

  private drawHud(): void {
    this.addHudText(PLAYFIELD_WIDTH + 10, 24, "EDIT", 18, "#111111");
    this.addHudText(PLAYFIELD_WIDTH + 10, 62, this.tileLabel(this.grid[this.cursor.y][this.cursor.x]), 12, "#111111");

    CONSTRUCTION_TILE_ORDER.forEach((tile, index) => {
      const x = PLAYFIELD_WIDTH + 24 + (index % 2) * 32;
      const y = 104 + Math.floor(index / 2) * 42;
      this.graphics.lineStyle(2, tile === this.grid[this.cursor.y][this.cursor.x] ? YELLOW : HUD_DARK, 1);
      this.graphics.strokeRect(x - 14, y - 14, 28, 28);
      this.drawPaletteTile(tile, x, y);
    });

    this.addHudText(PLAYFIELD_WIDTH + 16, 342, "RUN", 16, "#111111");
  }

  private drawPaletteTile(tile: TileType, x: number, y: number): void {
    if (tile === "empty") {
      this.graphics.fillStyle(BLACK, 1);
      this.graphics.fillRect(x - 10, y - 10, 20, 20);
      return;
    }

    this.tileLayer.add(this.add.image(x, y, SPRITE_SHEETS.terrain.key, SPRITE_FRAMES.terrain[tile]).setOrigin(0.5).setScale(0.75).setDepth(4));
  }

  private drawCursor(): void {
    const x = this.cursor.x * CONFIG.tileSize;
    const y = this.cursor.y * CONFIG.tileSize;
    this.graphics.lineStyle(3, isConstructionLockedTile(this.cursor) ? WHITE : YELLOW, 1);
    this.graphics.strokeRect(x + 2, y + 2, CONFIG.tileSize - 4, CONFIG.tileSize - 4);
  }

  private addHudText(x: number, y: number, text: string, size: number, color: string): Phaser.GameObjects.Text {
    const label = this.add.text(x, y, text, {
      fontFamily: '"Courier New", monospace',
      fontSize: `${size}px`,
      color,
    }).setDepth(10);
    this.hudLayer.add(label);
    return label;
  }

  private tileLabel(tile: TileType): string {
    if (isConstructionLockedTile(this.cursor)) {
      return "LOCK";
    }

    if (tile === "empty") return "OPEN";
    if (tile === "brick") return "BRICK";
    if (tile === "steel") return "STEEL";
    if (tile === "grass") return "GRASS";
    if (tile === "water") return "WATER";
    if (tile === "ice") return "ICE";
    return "LOCK";
  }

  private isEditorKey(code: string): boolean {
    return [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Space",
      "Enter",
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "KeyJ",
      "Escape",
    ].includes(code);
  }
}
