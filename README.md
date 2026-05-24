# Tank War

A browser-based modern-pixel tank battle game inspired by the classic 8-bit
base-defense loop. This project uses original visuals and does not include ROM
assets, extracted sprites, original music, or original sound effects.

## Current V1

- Vite + TypeScript + Phaser 3.
- Single-player and two-player co-op modes across a 35-stage arcade-length run.
- Construction mode for editing a 13x13 custom battlefield and launching it
  through the normal runtime rules.
- Arcade-style stage intro screen before each standard or construction battle.
- 13x13 battlefield and compact right-side HUD.
- Player tank, enemy waves, bullets, terrain collision, base defense, lives,
  explosions, pause, victory, defeat, and retry flow.
- Two-player friendly fire stuns the other player briefly without removing a
  life; the stunned player can still turn and fire.
- Terrain: brick, steel, grass, water, ice, base, destroyed base.
- Power-ups: star, bomb, clock, shovel, helmet, and extra life.
- Enemies: normal, fast, and armor tanks.
- Original synthesized arcade-style sound effects for shooting, impacts,
  explosions, power-ups, player loss, base destruction, and stage outcomes.

## Controls

- 1P move: Arrow keys.
- 1P fire: Space.
- 2P move: WASD.
- 2P fire: J.
- Single-player mode also accepts either control set.
- Pause: P or Escape.
- Menu/result screens: Enter.
- Menu selection: Up/Down or W/S.
- Retry from result screen: R.
- Construction: move cursor with Arrow keys or WASD, cycle terrain with Space or
  J, launch with Enter, return with Escape.

## Development

```bash
npm install
npm run assets:generate
npm test
npm run build
npm run dev
```

Open the Vite URL shown by `npm run dev` in a browser.

## Notes

- Core runtime rules live in `src/game/runtime` and are covered by Vitest where practical.
- Level data lives in `src/levels`.
- Sprite sheets live in `src/assets/sprites` and are mapped through
  `src/game/assets/spriteManifest.ts`.
- `npm run assets:generate` regenerates the original grid-aligned PNG sheets.
- `GameScene` consumes runtime snapshots and keeps Phaser focused on input,
  rendering, and scene transitions.
