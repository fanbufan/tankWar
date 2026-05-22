import Phaser from "phaser";
import { SPRITE_FRAMES, SPRITE_SHEETS } from "../assets/spriteManifest";
import { CONFIG, GAME_HEIGHT, GAME_WIDTH } from "../config";
import { tileToCenter } from "../geometry";
import { reduceKeysToActions } from "../input";
import { createRuntime, getRuntimeSnapshot, stepRuntime, toggleRuntimePause, type Runtime } from "../runtime";
import type {
  RuntimeBulletSnapshot,
  RuntimeExplosionSnapshot,
  RuntimePowerUpSnapshot,
  RuntimeSnapshot,
  RuntimeTankSnapshot,
} from "../runtime/types";
import type { EnemyType, GridPoint, PowerUpType, TileType } from "../types";

interface GameSceneData {
  levelIndex?: number;
  score?: number;
}

interface HudTexts {
  stage: Phaser.GameObjects.Text;
  lives: Phaser.GameObjects.Text;
  enemies: Phaser.GameObjects.Text;
  score: Phaser.GameObjects.Text;
  power: Phaser.GameObjects.Text;
  item: Phaser.GameObjects.Text;
  help: Phaser.GameObjects.Text;
}

const POWER_UP_COLORS: Record<PowerUpType, number> = {
  star: 0xffdf5d,
  bomb: 0xff6b6b,
  clock: 0x6bd5ff,
  shovel: 0xc08457,
  helmet: 0x94f0a9,
  tank: 0xf8fafc,
};

const POWER_UP_LABELS: Record<PowerUpType, string> = {
  star: "STAR",
  bomb: "BOMB",
  clock: "TIME",
  shovel: "BASE",
  helmet: "SAFE",
  tank: "LIFE",
};

const tanksUrl = new URL("../../assets/sprites/tanks.png", import.meta.url).href;
const terrainUrl = new URL("../../assets/sprites/terrain.png", import.meta.url).href;
const effectsUrl = new URL("../../assets/sprites/effects.png", import.meta.url).href;
const powerupsUrl = new URL("../../assets/sprites/powerups.png", import.meta.url).href;

export class GameScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private spriteLayer!: Phaser.GameObjects.Container;
  private hud!: HudTexts;
  private pauseText!: Phaser.GameObjects.Text;
  private runtime!: Runtime;
  private levelIndex = 0;
  private startingScore = 0;
  private keysDown = new Set<string>();
  private sceneEnded = false;

  public constructor() {
    super("GameScene");
  }

  public init(data: GameSceneData): void {
    this.levelIndex = data.levelIndex ?? 0;
    this.startingScore = data.score ?? 0;
  }

  public preload(): void {
    this.load.spritesheet(SPRITE_SHEETS.tanks.key, tanksUrl, {
      frameWidth: SPRITE_SHEETS.tanks.frameWidth,
      frameHeight: SPRITE_SHEETS.tanks.frameHeight,
    });
    this.load.spritesheet(SPRITE_SHEETS.terrain.key, terrainUrl, {
      frameWidth: SPRITE_SHEETS.terrain.frameWidth,
      frameHeight: SPRITE_SHEETS.terrain.frameHeight,
    });
    this.load.spritesheet(SPRITE_SHEETS.effects.key, effectsUrl, {
      frameWidth: SPRITE_SHEETS.effects.frameWidth,
      frameHeight: SPRITE_SHEETS.effects.frameHeight,
    });
    this.load.spritesheet(SPRITE_SHEETS.powerups.key, powerupsUrl, {
      frameWidth: SPRITE_SHEETS.powerups.frameWidth,
      frameHeight: SPRITE_SHEETS.powerups.frameHeight,
    });
  }

  public create(): void {
    this.runtime = createRuntime(this.levelIndex, this.startingScore);
    this.keysDown.clear();
    this.sceneEnded = false;
    this.graphics = this.add.graphics();
    this.spriteLayer = this.add.container(0, 0).setDepth(2);
    this.hud = this.createHudTexts();
    this.pauseText = this.add.text(CONFIG.gridColumns * CONFIG.tileSize / 2, GAME_HEIGHT / 2, "PAUSED", {
      fontFamily: '"Courier New", monospace',
      fontSize: "34px",
      color: "#f8fafc",
      stroke: "#0a0f14",
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.input.keyboard?.on("keyup", this.handleKeyUp, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown", this.handleKeyDown, this);
      this.input.keyboard?.off("keyup", this.handleKeyUp, this);
    });

    this.render(getRuntimeSnapshot(this.runtime));
  }

  public update(_time: number, delta: number): void {
    if (this.sceneEnded) {
      return;
    }

    const input = reduceKeysToActions(this.keysDown);
    stepRuntime(this.runtime, { ...input, pause: false }, delta);
    const snapshot = getRuntimeSnapshot(this.runtime);

    this.render(snapshot);
    this.maybeTransition(snapshot);
  }

  private createHudTexts(): HudTexts {
    const panelX = CONFIG.gridColumns * CONFIG.tileSize + 16;
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: '"Courier New", monospace',
      fontSize: "15px",
      color: "#d7e2ea",
    };

    return {
      stage: this.add.text(panelX, 24, "", { ...textStyle, color: "#6bd5ff" }).setDepth(10),
      lives: this.add.text(panelX, 66, "", textStyle).setDepth(10),
      enemies: this.add.text(panelX, 108, "", textStyle).setDepth(10),
      score: this.add.text(panelX, 150, "", textStyle).setDepth(10),
      power: this.add.text(panelX, 192, "", textStyle).setDepth(10),
      item: this.add.text(panelX, 236, "", { ...textStyle, color: "#f5c451" }).setDepth(10),
      help: this.add.text(panelX, 332, "P/ESC\n暂停", { ...textStyle, fontSize: "13px", color: "#93a4b5" }).setDepth(10),
    };
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.isGameKey(event.code)) {
      event.preventDefault();
    }

    if (event.code === "KeyP" || event.code === "Escape") {
      toggleRuntimePause(this.runtime);
      this.render(getRuntimeSnapshot(this.runtime));
      return;
    }

    this.keysDown.add(event.code);
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (this.isGameKey(event.code)) {
      event.preventDefault();
    }

    this.keysDown.delete(event.code);
  }

  private isGameKey(code: string): boolean {
    return [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Space",
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "KeyJ",
      "KeyP",
      "Escape",
    ].includes(code);
  }

  private maybeTransition(snapshot: RuntimeSnapshot): void {
    if (snapshot.status === "playing" || snapshot.status === "paused") {
      return;
    }

    this.sceneEnded = true;
    this.scene.start("ResultScene", {
      outcome: snapshot.status,
      levelIndex: snapshot.levelIndex,
      score: snapshot.hud.score,
    });
  }

  private render(snapshot: RuntimeSnapshot): void {
    this.graphics.clear();
    this.spriteLayer.removeAll(true);
    this.drawBackdrop();
    this.drawTiles(snapshot, false);
    this.drawPowerUps(snapshot.powerUps, snapshot.elapsedMs);
    this.drawTank(snapshot.player, snapshot.elapsedMs);

    for (const enemy of snapshot.enemies) {
      this.drawTank(enemy, snapshot.elapsedMs);
    }

    this.drawBullets(snapshot.bullets);
    this.drawExplosions(snapshot.explosions, snapshot.elapsedMs);
    this.drawTiles(snapshot, true);
    this.drawHudPanel();
    this.updateHudText(snapshot);
    this.pauseText.setVisible(snapshot.status === "paused");

    if (snapshot.status === "paused") {
      this.graphics.fillStyle(0x05080c, 0.68);
      this.graphics.fillRect(0, 0, CONFIG.gridColumns * CONFIG.tileSize, GAME_HEIGHT);
    }
  }

  private drawBackdrop(): void {
    this.graphics.fillStyle(0x0b0f14, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.graphics.fillStyle(0x111820, 1);
    this.graphics.fillRect(0, 0, CONFIG.gridColumns * CONFIG.tileSize, GAME_HEIGHT);
    this.graphics.lineStyle(1, 0x1c2a35, 0.55);

    for (let x = 0; x <= CONFIG.gridColumns; x += 1) {
      this.graphics.lineBetween(x * CONFIG.tileSize, 0, x * CONFIG.tileSize, GAME_HEIGHT);
    }

    for (let y = 0; y <= CONFIG.gridRows; y += 1) {
      this.graphics.lineBetween(0, y * CONFIG.tileSize, CONFIG.gridColumns * CONFIG.tileSize, y * CONFIG.tileSize);
    }
  }

  private drawTiles(snapshot: RuntimeSnapshot, grassPass: boolean): void {
    for (let y = 0; y < CONFIG.gridRows; y += 1) {
      for (let x = 0; x < CONFIG.gridColumns; x += 1) {
        const tile = this.visibleTile(snapshot, { x, y });

        if (grassPass !== (tile === "grass")) {
          continue;
        }

        this.drawTile(tile, x, y);
      }
    }
  }

  private visibleTile(snapshot: RuntimeSnapshot, tile: GridPoint): TileType {
    if (snapshot.elapsedMs < snapshot.baseFortifiedUntil && this.isBaseGuardTile(snapshot.base, tile)) {
      return "steel";
    }

    return snapshot.grid[tile.y][tile.x];
  }

  private isBaseGuardTile(base: GridPoint, tile: GridPoint): boolean {
    return [
      { x: base.x - 1, y: base.y },
      { x: base.x + 1, y: base.y },
      { x: base.x - 1, y: base.y - 1 },
      { x: base.x, y: base.y - 1 },
      { x: base.x + 1, y: base.y - 1 },
    ].some((guard) => guard.x === tile.x && guard.y === tile.y);
  }

  private drawTile(tile: TileType, x: number, y: number): void {
    const center = tileToCenter({ x, y });
    this.spriteLayer.add(
      this.add
        .image(center.x, center.y, SPRITE_SHEETS.terrain.key, SPRITE_FRAMES.terrain[tile])
        .setOrigin(0.5)
        .setDepth(tile === "grass" ? 6 : 1),
    );
  }

  private drawTank(tank: RuntimeTankSnapshot, elapsedMs: number): void {
    const frame = SPRITE_FRAMES.tanks[tank.type as "player" | EnemyType][tank.direction];
    const blink = tank.invulnerableUntil > elapsedMs && Math.floor(elapsedMs / 120) % 2 === 0;
    const sprite = this.add.image(tank.position.x, tank.position.y, SPRITE_SHEETS.tanks.key, frame).setOrigin(0.5).setDepth(4);

    if (blink) {
      sprite.setAlpha(0.7);
      this.graphics.lineStyle(2, 0xf8fafc, 1);
      this.graphics.strokeRect(tank.position.x - 15, tank.position.y - 15, 30, 30);
    }

    this.spriteLayer.add(sprite);

    if (tank.owner === "enemy" && tank.type === "armor") {
      this.graphics.fillStyle(0xf8fafc, 1);

      for (let index = 0; index < tank.armor; index += 1) {
        this.graphics.fillRect(tank.position.x - 11 + index * 6, tank.position.y - 18, 4, 3);
      }
    }
  }

  private drawBullets(bullets: RuntimeBulletSnapshot[]): void {
    for (const bullet of bullets) {
      const sprite = this.add
        .image(bullet.position.x, bullet.position.y, SPRITE_SHEETS.effects.key, SPRITE_FRAMES.effects.bullet)
        .setOrigin(0.5)
        .setDepth(5);
      sprite.setTint(bullet.owner === "player" ? 0xf8fafc : 0xff6b6b);
      this.spriteLayer.add(sprite);
    }
  }

  private drawPowerUps(powerUps: RuntimePowerUpSnapshot[], elapsedMs: number): void {
    for (const powerUp of powerUps) {
      const center = tileToCenter(powerUp.tile);
      const pulse = Math.floor(elapsedMs / 180) % 2 === 0 ? 1 : 0.72;
      this.graphics.lineStyle(2, 0xf8fafc, 0.8);
      this.graphics.strokeRect(center.x - 11, center.y - 11, 22, 22);
      const sprite = this.add
        .image(center.x, center.y, SPRITE_SHEETS.powerups.key, SPRITE_FRAMES.powerups[powerUp.type])
        .setOrigin(0.5)
        .setAlpha(pulse)
        .setDepth(3);
      sprite.setTint(POWER_UP_COLORS[powerUp.type]);
      this.spriteLayer.add(sprite);
    }
  }

  private drawExplosions(explosions: RuntimeExplosionSnapshot[], elapsedMs: number): void {
    for (const explosion of explosions) {
      const progress = 1 - (explosion.until - elapsedMs) / 260;
      const frame =
        progress < 0.25
          ? SPRITE_FRAMES.effects.explosion1
          : progress < 0.5
            ? SPRITE_FRAMES.effects.explosion2
            : progress < 0.75
              ? SPRITE_FRAMES.effects.explosion3
              : SPRITE_FRAMES.effects.explosion4;
      this.spriteLayer.add(
        this.add.image(explosion.position.x, explosion.position.y, SPRITE_SHEETS.effects.key, frame).setOrigin(0.5).setDepth(7),
      );
    }
  }

  private drawHudPanel(): void {
    const panelX = CONFIG.gridColumns * CONFIG.tileSize;
    this.graphics.fillStyle(0x202833, 1);
    this.graphics.fillRect(panelX, 0, CONFIG.sidePanelWidth, GAME_HEIGHT);
    this.graphics.lineStyle(2, 0x3a4652, 1);
    this.graphics.lineBetween(panelX, 0, panelX, GAME_HEIGHT);
    this.graphics.fillStyle(0x121922, 1);
    this.graphics.fillRect(panelX + 12, 14, CONFIG.sidePanelWidth - 24, GAME_HEIGHT - 28);
  }

  private updateHudText(snapshot: RuntimeSnapshot): void {
    this.hud.stage.setText(`STAGE\n${snapshot.hud.stageLabel}`);
    this.hud.lives.setText(`LIVES\n${snapshot.hud.lives}`);
    this.hud.enemies.setText(`ENEMY\n${snapshot.hud.enemies}`);
    this.hud.score.setText(`SCORE\n${snapshot.hud.score}`);
    this.hud.power.setText(`POWER\n${snapshot.hud.power}`);
    this.hud.item.setText(`ITEM\n${snapshot.hud.item ? POWER_UP_LABELS[snapshot.hud.item] : "--"}`);
  }
}
