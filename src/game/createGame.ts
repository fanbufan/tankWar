import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./config";
import { ConstructionScene } from "./scenes/ConstructionScene";
import { GameScene } from "./scenes/GameScene";
import { MenuScene } from "./scenes/MenuScene";
import { ResultScene } from "./scenes/ResultScene";
import { StageIntroScene } from "./scenes/StageIntroScene";

export function createGame(parent: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#000000",
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [MenuScene, StageIntroScene, ConstructionScene, GameScene, ResultScene],
  });
}
