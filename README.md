# Tank War

A browser-based modern-pixel tank battle game inspired by the classic 8-bit
base-defense loop. This project uses original visuals and does not include ROM
assets, extracted sprites, original music, or original sound effects.

## Current V1

- Vite + TypeScript + Phaser 3.
- Single-player mode with three handcrafted stages.
- 13x13 battlefield and compact right-side HUD.
- Player tank, enemy waves, bullets, terrain collision, base defense, lives,
  explosions, pause, victory, defeat, and retry flow.
- Terrain: brick, steel, grass, water, ice, base, destroyed base.
- Power-ups: star, bomb, clock, shovel, helmet, and extra life.
- Enemies: normal, fast, and armor tanks.

## Controls

- Move: Arrow keys or WASD.
- Fire: Space or J.
- Pause: P or Escape.
- Menu/result screens: Enter.
- Retry from result screen: R.

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
