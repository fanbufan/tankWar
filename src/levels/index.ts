import type { EnemyType, LevelDefinition } from "../game/types";

const enemyQueue: EnemyType[] = Array.from({ length: 20 }, (_, index) => {
  if (index % 7 === 0) return "armor";
  if (index % 3 === 0) return "fast";
  return "normal";
});

export const LEVELS: LevelDefinition[] = [
  {
    id: 1,
    name: "Iron Canal",
    map: [
      "..#...#...#..",
      "###..###..###",
      "...~~...~~...",
      "##..##.##..##",
      "..%%..=..%%..",
      "....##.##....",
      "==..##.##..==",
      "....%%.%%....",
      "##..##.##..##",
      "...~~...~~...",
      "..#...#...#..",
      "....##.##....",
      ".....###.....",
    ],
    playerSpawn: { x: 4, y: 12 },
    base: { x: 6, y: 12 },
    enemySpawnPoints: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 12, y: 0 }],
    enemyQueue,
  },
  {
    id: 2,
    name: "Frozen Brickline",
    map: [
      ".._..#.._..#.",
      "##..===..##..",
      "...~~...~~...",
      ".#..##.##..#.",
      "..%%..#..%%..",
      "___..#.#..___",
      "==..##.##..==",
      "___..#.#..___",
      "..%%..#..%%..",
      ".#..##.##..#.",
      "...~~...~~...",
      "##..===..##..",
      ".....###.....",
    ],
    playerSpawn: { x: 4, y: 12 },
    base: { x: 6, y: 12 },
    enemySpawnPoints: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 12, y: 0 }],
    enemyQueue,
  },
  {
    id: 3,
    name: "Grass Citadel",
    map: [
      ".#..%%.%%..#.",
      "###..===..###",
      "..%%.....%%..",
      "~~..##.##..~~",
      "..%%..=..%%..",
      ".##..#.#..##.",
      "==..##.##..==",
      ".##..#.#..##.",
      "..%%..=..%%..",
      "~~..##.##..~~",
      "..%%.....%%..",
      "###..===..###",
      ".....###.....",
    ],
    playerSpawn: { x: 4, y: 12 },
    base: { x: 6, y: 12 },
    enemySpawnPoints: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 12, y: 0 }],
    enemyQueue,
  },
];
