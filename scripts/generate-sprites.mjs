import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";

const outDir = resolve("src/assets/sprites");
mkdirSync(outDir, { recursive: true });

const COLOR = {
  transparent: [0, 0, 0, 0],
  black: [8, 13, 18, 255],
  dark: [18, 25, 33, 255],
  grid: [31, 44, 55, 255],
  white: [248, 250, 252, 255],
  shadow: [5, 8, 12, 180],
  player: [34, 197, 94, 255],
  playerDark: [20, 83, 45, 255],
  normal: [245, 196, 81, 255],
  fast: [107, 213, 255, 255],
  armor: [255, 138, 61, 255],
  armorDark: [126, 61, 38, 255],
  brick: [180, 107, 60, 255],
  brickDark: [91, 49, 35, 255],
  steel: [148, 163, 184, 255],
  steelDark: [71, 85, 105, 255],
  grass: [49, 95, 70, 220],
  grassLight: [89, 166, 111, 230],
  water: [28, 79, 122, 245],
  waterLight: [107, 213, 255, 230],
  ice: [199, 240, 255, 240],
  iceLine: [101, 181, 217, 255],
  base: [248, 250, 252, 255],
  baseCore: [245, 196, 81, 255],
  red: [255, 107, 107, 255],
  orange: [255, 184, 77, 255],
  yellow: [255, 223, 93, 255],
  magenta: [255, 97, 216, 255],
  cyan: [107, 213, 255, 255],
};

function createCanvas(width, height) {
  return {
    width,
    height,
    data: new Uint8Array(width * height * 4),
  };
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const i = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
  canvas.data[i] = color[0];
  canvas.data[i + 1] = color[1];
  canvas.data[i + 2] = color[2];
  canvas.data[i + 3] = color[3];
}

function rect(canvas, x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      setPixel(canvas, xx, yy, color);
    }
  }
}

function line(canvas, x1, y1, x2, y2, color) {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  let x = x1;
  let y = y1;

  while (true) {
    setPixel(canvas, x, y, color);
    if (x === x2 && y === y2) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function circle(canvas, cx, cy, r, color) {
  for (let y = -r; y <= r; y += 1) {
    for (let x = -r; x <= r; x += 1) {
      if (x * x + y * y <= r * r) setPixel(canvas, cx + x, cy + y, color);
    }
  }
}

function frameOrigin(index, columns = 4) {
  return { x: (index % columns) * 32, y: Math.floor(index / columns) * 32 };
}

function drawTank(canvas, index, direction, body, dark, accent = COLOR.white) {
  const { x, y } = frameOrigin(index, 4);
  rect(canvas, x + 6, y + 7, 20, 19, COLOR.shadow);

  if (direction === "up" || direction === "down") {
    rect(canvas, x + 4, y + 5, 5, 23, dark);
    rect(canvas, x + 23, y + 5, 5, 23, dark);
    rect(canvas, x + 9, y + 7, 14, 19, body);
    rect(canvas, x + 12, y + 10, 8, 11, dark);
    rect(canvas, x + 14, y + (direction === "up" ? 1 : 20), 4, 11, body);
    rect(canvas, x + 13, y + (direction === "up" ? 1 : 27), 6, 3, accent);
    for (let yy = 7; yy <= 25; yy += 6) {
      rect(canvas, x + 5, y + yy, 3, 2, COLOR.black);
      rect(canvas, x + 24, y + yy, 3, 2, COLOR.black);
    }
  } else {
    rect(canvas, x + 5, y + 4, 23, 5, dark);
    rect(canvas, x + 5, y + 23, 23, 5, dark);
    rect(canvas, x + 7, y + 9, 19, 14, body);
    rect(canvas, x + 11, y + 12, 11, 8, dark);
    rect(canvas, x + (direction === "left" ? 1 : 20), y + 14, 11, 4, body);
    rect(canvas, x + (direction === "left" ? 1 : 27), y + 13, 3, 6, accent);
    for (let xx = 7; xx <= 25; xx += 6) {
      rect(canvas, x + xx, y + 5, 2, 3, COLOR.black);
      rect(canvas, x + xx, y + 24, 2, 3, COLOR.black);
    }
  }
}

function makeTanks() {
  const canvas = createCanvas(128, 128);
  const rows = [
    [COLOR.player, COLOR.playerDark],
    [COLOR.normal, COLOR.brickDark],
    [COLOR.fast, COLOR.steelDark],
    [COLOR.armor, COLOR.armorDark],
  ];
  const directions = ["up", "right", "down", "left"];

  rows.forEach(([body, dark], row) => {
    directions.forEach((direction, col) => drawTank(canvas, row * 4 + col, direction, body, dark));
  });

  return canvas;
}

function makeTerrain() {
  const canvas = createCanvas(256, 32);
  for (let x = 0; x < 32; x += 4) {
    for (let y = 0; y < 32; y += 4) {
      if ((x + y) % 8 === 0) rect(canvas, x + 1, y + 1, 1, 1, COLOR.grid);
    }
  }

  const brickX = 32;
  rect(canvas, brickX + 2, 2, 28, 28, COLOR.brickDark);
  for (let by = 3; by < 28; by += 7) {
    for (let bx = 3 + ((by / 7) % 2) * 6; bx < 28; bx += 12) {
      rect(canvas, brickX + bx, by, 10, 5, COLOR.brick);
    }
  }

  const steelX = 64;
  rect(canvas, steelX + 3, 3, 26, 26, COLOR.steel);
  rect(canvas, steelX + 7, 7, 18, 18, COLOR.steelDark);
  rect(canvas, steelX + 6, 6, 5, 5, COLOR.white);
  rect(canvas, steelX + 21, 21, 5, 5, COLOR.grid);

  const grassX = 96;
  rect(canvas, grassX + 1, 1, 30, 30, COLOR.grass);
  for (let i = 0; i < 8; i += 1) {
    rect(canvas, grassX + 4 + i * 3, 3 + (i % 3), 2, 25 - (i % 4), i % 2 ? COLOR.grassLight : COLOR.grass);
  }

  const waterX = 128;
  rect(canvas, waterX + 2, 2, 28, 28, COLOR.water);
  line(canvas, waterX + 5, 12, waterX + 15, 8, COLOR.waterLight);
  line(canvas, waterX + 15, 20, waterX + 27, 15, COLOR.waterLight);
  line(canvas, waterX + 3, 25, waterX + 13, 22, COLOR.cyan);

  const iceX = 160;
  rect(canvas, iceX + 2, 2, 28, 28, COLOR.ice);
  line(canvas, iceX + 6, 24, iceX + 24, 6, COLOR.iceLine);
  line(canvas, iceX + 8, 9, iceX + 19, 4, COLOR.white);

  const baseX = 192;
  rect(canvas, baseX + 7, 8, 18, 19, COLOR.base);
  rect(canvas, baseX + 10, 12, 12, 12, COLOR.baseCore);
  rect(canvas, baseX + 14, 6, 4, 6, COLOR.base);
  rect(canvas, baseX + 12, 15, 8, 5, COLOR.steelDark);

  const brokenX = 224;
  rect(canvas, brokenX + 8, 10, 16, 16, COLOR.brickDark);
  rect(canvas, brokenX + 11, 13, 5, 5, COLOR.red);
  line(canvas, brokenX + 6, 25, brokenX + 25, 6, COLOR.black);
  line(canvas, brokenX + 8, 8, brokenX + 27, 27, COLOR.black);

  return canvas;
}

function makeEffects() {
  const canvas = createCanvas(256, 32);
  rect(canvas, 13, 13, 6, 6, COLOR.white);
  rect(canvas, 15, 8, 2, 16, COLOR.yellow);

  circle(canvas, 48, 16, 6, COLOR.yellow);
  circle(canvas, 48, 16, 3, COLOR.white);

  [4, 7, 11, 15].forEach((radius, idx) => {
    const cx = 80 + idx * 32;
    circle(canvas, cx, 16, radius, idx < 2 ? COLOR.yellow : COLOR.red);
    circle(canvas, cx - 2, 14, Math.max(2, radius - 5), COLOR.orange);
  });

  line(canvas, 200, 16, 218, 16, COLOR.white);
  line(canvas, 209, 7, 209, 25, COLOR.yellow);
  line(canvas, 202, 9, 216, 23, COLOR.orange);
  line(canvas, 216, 9, 202, 23, COLOR.orange);

  circle(canvas, 240, 16, 11, COLOR.cyan);
  circle(canvas, 240, 16, 6, COLOR.white);
  line(canvas, 229, 16, 251, 16, COLOR.yellow);
  line(canvas, 240, 5, 240, 27, COLOR.yellow);

  return canvas;
}

function makePowerups() {
  const canvas = createCanvas(192, 32);
  drawStar(canvas, 16, 16, COLOR.yellow);
  circle(canvas, 48, 16, 10, COLOR.red);
  rect(canvas, 45, 5, 6, 6, COLOR.white);
  line(canvas, 50, 6, 56, 2, COLOR.yellow);
  circle(canvas, 80, 16, 11, COLOR.cyan);
  rect(canvas, 79, 8, 2, 9, COLOR.white);
  rect(canvas, 80, 16, 7, 2, COLOR.white);
  rect(canvas, 103, 10, 18, 8, COLOR.brick);
  rect(canvas, 108, 18, 8, 8, COLOR.brickDark);
  rect(canvas, 137, 8, 14, 17, COLOR.player);
  rect(canvas, 132, 12, 24, 8, COLOR.playerDark);
  drawTank(canvas, 5, "up", COLOR.white, COLOR.steelDark, COLOR.player);
  return canvas;
}

function drawStar(canvas, cx, cy, color) {
  const points = [
    [cx, cy - 12],
    [cx + 3, cy - 3],
    [cx + 12, cy - 3],
    [cx + 5, cy + 3],
    [cx + 8, cy + 12],
    [cx, cy + 7],
    [cx - 8, cy + 12],
    [cx - 5, cy + 3],
    [cx - 12, cy - 3],
    [cx - 3, cy - 3],
  ];
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    line(canvas, x1, y1, x2, y2, color);
  }
  circle(canvas, cx, cy, 4, color);
}

function encodePng(canvas) {
  const raw = Buffer.alloc((canvas.width * 4 + 1) * canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    const rowStart = y * (canvas.width * 4 + 1);
    raw[rowStart] = 0;
    Buffer.from(canvas.data.slice(y * canvas.width * 4, (y + 1) * canvas.width * 4)).copy(raw, rowStart + 1);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr(canvas.width, canvas.height)),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function ihdr(width, height) {
  const buffer = Buffer.alloc(13);
  buffer.writeUInt32BE(width, 0);
  buffer.writeUInt32BE(height, 4);
  buffer[8] = 8;
  buffer[9] = 6;
  buffer[10] = 0;
  buffer[11] = 0;
  buffer[12] = 0;
  return buffer;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writePng(path, canvas) {
  const absolute = resolve(outDir, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, encodePng(canvas));
}

writePng("tanks.png", makeTanks());
writePng("terrain.png", makeTerrain());
writePng("effects.png", makeEffects());
writePng("powerups.png", makePowerups());

