import Phaser from "phaser";
import { SPRITE_FRAMES, SPRITE_SHEETS, type PlayerPowerLevel } from "../assets/spriteManifest";
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
  RuntimeTerrainDamageSnapshot,
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

const PLAYFIELD_WIDTH = CONFIG.gridColumns * CONFIG.tileSize;
const NES_COLORS = {
  black: 0x000000,
  hudGray: 0x7b7b7b,
  hudDark: 0x111111,
  hudLight: 0xd9d9d9,
  white: 0xfcfcfc,
  red: 0xd82800,
  yellow: 0xf8d878,
} as const;

const POWER_UP_COLORS: Record<PowerUpType, number> = {
  star: 0xffdf5d,
  bomb: 0xff6b6b,
  clock: 0x6bd5ff,
  shovel: 0xc08457,
  helmet: 0x94f0a9,
  tank: 0xf8fafc,
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
    this.pauseText = this.add.text(PLAYFIELD_WIDTH / 2, GAME_HEIGHT / 2, "PAUSE", {
      fontFamily: '"Courier New", monospace',
      fontSize: "22px",
      color: "#fcfcfc",
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
    const panelX = PLAYFIELD_WIDTH;
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: '"Courier New", monospace',
      fontSize: "16px",
      color: "#111111",
    };

    return {
      stage: this.add.text(panelX + 54, 326, "", textStyle).setOrigin(0.5, 0).setDepth(10),
      lives: this.add.text(panelX + 54, 252, "", textStyle).setOrigin(0.5, 0).setDepth(10),
      enemies: this.add.text(panelX, 0, "", textStyle).setVisible(false).setDepth(10),
      score: this.add.text(panelX + 10, 386, "", { ...textStyle, fontSize: "10px" }).setDepth(10),
      power: this.add.text(panelX, 0, "", textStyle).setVisible(false).setDepth(10),
      item: this.add.text(panelX, 0, "", textStyle).setVisible(false).setDepth(10),
      help: this.add.text(panelX + 22, 218, "1P", textStyle).setDepth(10),
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
      stageStats: snapshot.stageStats,
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
    this.drawHudPanel(snapshot);
    this.updateHudText(snapshot);
    this.pauseText.setVisible(snapshot.status === "paused");

    if (snapshot.status === "paused") {
      this.graphics.fillStyle(NES_COLORS.black, 0.72);
      this.graphics.fillRect(0, 0, PLAYFIELD_WIDTH, GAME_HEIGHT);
    }
  }

  private drawBackdrop(): void {
    this.graphics.fillStyle(NES_COLORS.hudGray, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.graphics.fillStyle(NES_COLORS.black, 1);
    this.graphics.fillRect(0, 0, PLAYFIELD_WIDTH, GAME_HEIGHT);
  }

  private drawTiles(snapshot: RuntimeSnapshot, grassPass: boolean): void {
    for (let y = 0; y < CONFIG.gridRows; y += 1) {
      for (let x = 0; x < CONFIG.gridColumns; x += 1) {
        const tile = this.visibleTile(snapshot, { x, y });

        if (grassPass !== (tile === "grass")) {
          continue;
        }

        this.drawTile(tile, x, y, snapshot.terrainDamage.find((damage) => damage.tile.x === x && damage.tile.y === y));
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

  private drawTile(tile: TileType, x: number, y: number, damage?: RuntimeTerrainDamageSnapshot): void {
    if (tile === "empty") {
      return;
    }

    if (tile === "brick" && damage?.kind === "brick" && damage.brickMask !== undefined && damage.brickMask !== 0b1111) {
      this.drawDamagedBrick(x, y, damage.brickMask);
      return;
    }

    const center = tileToCenter({ x, y });
    this.spriteLayer.add(
      this.add
        .image(center.x, center.y, SPRITE_SHEETS.terrain.key, SPRITE_FRAMES.terrain[tile])
        .setOrigin(0.5)
        .setDepth(tile === "grass" ? 6 : 1),
    );
  }

  private drawDamagedBrick(x: number, y: number, mask: number): void {
    const center = tileToCenter({ x, y });
    this.spriteLayer.add(
      this.add
        .image(center.x, center.y, SPRITE_SHEETS.terrain.key, SPRITE_FRAMES.terrain.brick)
        .setOrigin(0.5)
        .setDepth(1),
    );

    const originX = x * CONFIG.tileSize;
    const originY = y * CONFIG.tileSize;
    const half = CONFIG.tileSize / 2;
    const fragments = [
      { bit: 0b0001, x: originX, y: originY },
      { bit: 0b0010, x: originX + half, y: originY },
      { bit: 0b0100, x: originX, y: originY + half },
      { bit: 0b1000, x: originX + half, y: originY + half },
    ];

    for (const fragment of fragments) {
      if ((mask & fragment.bit) !== 0) {
        continue;
      }

      this.spriteLayer.add(
        this.add
          .rectangle(fragment.x + half / 2, fragment.y + half / 2, half, half, NES_COLORS.black)
          .setOrigin(0.5)
          .setDepth(2),
      );
    }
  }

  private drawTank(tank: RuntimeTankSnapshot, elapsedMs: number): void {
    const frame =
      tank.owner === "player"
        ? SPRITE_FRAMES.tanks.player[this.playerPowerFrame(tank.powerLevel)][tank.direction]
        : SPRITE_FRAMES.tanks[tank.type as EnemyType][tank.direction];
    const blinkFrame = Math.floor(elapsedMs / 120) % 2 === 0;
    const invulnerableBlink = tank.invulnerableUntil > elapsedMs && blinkFrame;
    const powerUpBlink = tank.owner === "enemy" && tank.carriesPowerUp && blinkFrame;
    const spawningBlink = tank.owner === "enemy" && tank.spawningUntil > elapsedMs && blinkFrame;
    const sprite = this.add.image(tank.position.x, tank.position.y, SPRITE_SHEETS.tanks.key, frame).setOrigin(0.5).setDepth(4);

    if (powerUpBlink) {
      sprite.setTint(0xf5c451);
    }

    if (spawningBlink) {
      sprite.setAlpha(0.38);
    } else if (invulnerableBlink) {
      sprite.setAlpha(0.42);
    }

    this.spriteLayer.add(sprite);
  }

  private playerPowerFrame(powerLevel: number): PlayerPowerLevel {
    return Math.min(Math.max(Math.trunc(powerLevel), 1), CONFIG.maxPlayerPowerLevel) as PlayerPowerLevel;
  }

  private drawBullets(bullets: RuntimeBulletSnapshot[]): void {
    for (const bullet of bullets) {
      const sprite = this.add
        .image(bullet.position.x, bullet.position.y, SPRITE_SHEETS.effects.key, SPRITE_FRAMES.effects.bullet)
        .setOrigin(0.5)
        .setDepth(5);
      sprite.setTint(NES_COLORS.white);
      this.spriteLayer.add(sprite);
    }
  }

  private drawPowerUps(powerUps: RuntimePowerUpSnapshot[], elapsedMs: number): void {
    for (const powerUp of powerUps) {
      const center = tileToCenter(powerUp.tile);
      const pulse = Math.floor(elapsedMs / 180) % 2 === 0 ? 1 : 0.72;
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

  private drawHudPanel(snapshot: RuntimeSnapshot): void {
    const panelX = PLAYFIELD_WIDTH;
    this.graphics.fillStyle(NES_COLORS.hudGray, 1);
    this.graphics.fillRect(panelX, 0, CONFIG.sidePanelWidth, GAME_HEIGHT);
    this.graphics.lineStyle(2, NES_COLORS.hudDark, 1);
    this.graphics.lineBetween(panelX, 0, panelX, GAME_HEIGHT);
    this.drawRemainingEnemyIcons(panelX, snapshot.hud.enemies);
    this.drawMiniTank(panelX + 26, 250, NES_COLORS.hudDark);
    this.drawFlag(panelX + 25, 318);
  }

  private drawRemainingEnemyIcons(panelX: number, remaining: number): void {
    for (let index = 0; index < remaining; index += 1) {
      const x = panelX + 22 + (index % 2) * 24;
      const y = 20 + Math.floor(index / 2) * 16;
      this.drawMiniTank(x, y, NES_COLORS.hudDark);
    }
  }

  private drawMiniTank(x: number, y: number, color: number): void {
    this.graphics.fillStyle(color, 1);
    this.graphics.fillRect(x - 7, y - 6, 4, 12);
    this.graphics.fillRect(x + 3, y - 6, 4, 12);
    this.graphics.fillRect(x - 4, y - 4, 8, 8);
    this.graphics.fillRect(x - 1, y - 9, 2, 5);
    this.graphics.fillRect(x - 2, y - 2, 4, 4);
  }

  private drawFlag(x: number, y: number): void {
    this.graphics.fillStyle(NES_COLORS.hudDark, 1);
    this.graphics.fillRect(x - 5, y - 11, 3, 24);
    this.graphics.fillRect(x - 2, y - 11, 18, 12);
    this.graphics.fillStyle(NES_COLORS.hudLight, 1);
    this.graphics.fillRect(x + 2, y - 8, 8, 6);
  }

  private updateHudText(snapshot: RuntimeSnapshot): void {
    this.hud.stage.setText(`${snapshot.levelIndex + 1}`);
    this.hud.lives.setText(`${snapshot.hud.lives}`);
    this.hud.score.setText(`${snapshot.hud.score.toString().padStart(6, "0")}`);
  }
}
