# AGENTS.md

## Project Overview

Tank War is a browser-based, original "spiritual remake" of the classic
8-bit tank battle game. The goal is to preserve the familiar single-player
tank defense loop while using original modern-pixel visuals, original audio,
and browser-native delivery.

V1 target:

- Vite + TypeScript + Phaser 3.
- Single-player complete mode.
- Three handcrafted levels.
- 13x13 battlefield with a right-side status panel.
- Keyboard controls: Arrow keys + Space and WASD + J.
- Pause with P or Escape.
- Classic-inspired systems: player tank, enemy waves, base defense, terrain,
  bullets, explosions, lives, power-ups, and win/loss flow.

Do not use original ROMs, extracted sprites, music, sound effects, maps, or
other copyrighted game assets.

## Repository Shape

Use this structure unless a later design document supersedes it:

- `src/game/`: Phaser scenes, runtime logic, input, collision, simulation, and
  shared game config.
- `src/game/runtime/`: Pure TypeScript movement, combat, enemy AI, pacing,
  events, and snapshot contracts consumed by Phaser.
- `src/levels/`: TypeScript level definitions and map data.
- `src/ui/`: Menu, pause, HUD, result, and other non-canvas UI helpers.
- `src/assets/sprites/`: Original generated pixel PNG sprite sheets.
- `scripts/generate-sprites.mjs`: Deterministic generator for exact-size PNG
  sprite sheets used by tests and Phaser rendering.
- `tests/`: Vitest tests for pure game logic and behavior contracts.

Keep pure game rules testable outside Phaser whenever possible. Phaser-facing
code should adapt those rules to rendering, input, audio, and scene lifecycle.

## Commands

Run from the repository root:

```bash
npm install
npm test
npm run build
npm run dev
```

`npm run dev` starts the local Vite dev server. Use the Browser plugin or
Playwright-style browser verification for local smoke tests after meaningful
frontend or game-loop changes.

## Development Rules

- Preserve unrelated user changes. Do not reset, checkout, or delete work you
  did not create unless the user explicitly requests it.
- Prefer `rg` / `rg --files` for searching.
- Use `apply_patch` for manual edits.
- Keep implementation scoped to the current request; avoid broad refactors
  unless they are needed to complete the current behavior safely.
- Keep game constants centralized in `src/game/config.ts`.
- Keep level data declarative so new levels can be added without touching core
  logic.
- Keep input as an action-state layer (`up`, `down`, `left`, `right`, `fire`,
  `pause`) instead of reading keyboard state directly inside gameplay logic.
- Keep Phaser scenes as render/input adapters. Gameplay state changes should
  flow through `createRuntime`, `stepRuntime`, and `getRuntimeSnapshot`.
- Keep sprite sheets grid-aligned to 32x32 frames and update
  `src/game/assets/spriteManifest.ts` whenever sheet layouts change.
- Maintain grid coordinates and pixel coordinates as explicit concepts. Use
  grid data for terrain and map rules; use pixel interpolation for movement and
  rendering.

## Testing Expectations

Use test-first development for new gameplay behavior when practical:

1. Add or update a focused Vitest test that describes the desired behavior.
2. Run it and confirm it fails for the expected reason.
3. Implement the smallest useful code to pass.
4. Run `npm test`.
5. Run `npm run build` before claiming the app is ready.

Current tests may be intentionally red while TDD scaffolding is in progress.
Do not treat failing behavior-contract tests as acceptable final state.

Core scenarios that must stay covered:

- Level parsing creates a valid 13x13 grid and 20-enemy queue per v1 level.
- Tanks cannot occupy brick, steel, water, or base tiles.
- Grass is visual cover only; ice is passable.
- Player bullets destroy brick, stop on steel, pass through grass, and can
  destroy the base.
- Enemy spawning caps active enemies at four.
- Player firing respects cooldown.
- Star, bomb, clock, shovel, helmet, and tank power-ups mutate state correctly.
- Runtime tests should cover movement feel, combat events, enemy AI, spawn
  pacing, and snapshot contracts before Phaser integration changes.
- Asset tests should verify PNG dimensions and manifest frame mappings.
- Browser smoke test: start menu -> gameplay -> pause -> failure/retry or
  level completion flow.

## Visual Direction

Use the selected "modern pixel" direction:

- Crisp pixel blocks, not photorealistic art.
- Dark battlefield with clearer color contrast than the original console look.
- Right-side HUD with compact status information.
- Board and UI should feel playable and dense, not like a marketing landing
  page.
- Avoid generic purple gradients, decorative blobs, oversized hero sections,
  and card-heavy page layouts.

## Delivery Notes

- First playable version should prioritize game feel, collision correctness,
  readable state, and complete loop over decorative polish.
- Do not add double-player mode, level editor, online leaderboard, touch/mobile
  controls, or save system in v1 unless the user expands scope.
- Keep README and AGENTS.md aligned when commands, structure, or acceptance
  criteria change.
