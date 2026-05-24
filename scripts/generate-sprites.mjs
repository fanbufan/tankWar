import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";

const outDir = resolve("src/assets/sprites");
mkdirSync(outDir, { recursive: true });

const COLOR = {
  transparent: [0, 0, 0, 0],
  black: [0, 0, 0, 255],
  white: [236, 238, 236, 255],
  lightGray: [188, 188, 188, 255],
  gray: [116, 116, 116, 255],
  darkGray: [48, 48, 48, 255],
  player: [248, 216, 72, 255],
  playerDark: [128, 96, 0, 255],
  normal: [188, 188, 188, 255],
  normalDark: [72, 72, 72, 255],
  fast: [128, 208, 120, 255],
  fastDark: [32, 112, 48, 255],
  power: [232, 88, 32, 255],
  powerDark: [120, 40, 24, 255],
  armor: [176, 128, 64, 255],
  armorDark: [72, 64, 32, 255],
  brick: [184, 88, 40, 255],
  brickLight: [232, 136, 56, 255],
  brickDark: [88, 40, 24, 255],
  steel: [176, 184, 184, 255],
  steelLight: [236, 238, 236, 255],
  steelDark: [72, 80, 88, 255],
  grass: [48, 128, 64, 245],
  grassLight: [120, 184, 72, 245],
  grassDark: [24, 72, 40, 245],
  water: [24, 72, 160, 255],
  waterDark: [8, 32, 88, 255],
  waterLight: [112, 184, 248, 255],
  ice: [184, 224, 232, 255],
  iceLine: [80, 152, 200, 255],
  base: [236, 238, 236, 255],
  baseCore: [248, 216, 72, 255],
  red: [216, 40, 0, 255],
  orange: [248, 144, 32, 255],
  yellow: [248, 216, 72, 255],
  magenta: [216, 80, 184, 255],
  cyan: [112, 184, 248, 255],
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

const TANK_PROFILES = {
  player: {
    body: COLOR.player,
    dark: COLOR.playerDark,
    track: COLOR.darkGray,
    light: COLOR.white,
    bodyW: 12,
    bodyH: 16,
    trackW: 5,
    trackH: 23,
    turret: 8,
    barrelW: 4,
    barrelL: 12,
    plate: "single",
  },
  player2: {
    body: COLOR.player,
    dark: COLOR.playerDark,
    track: COLOR.darkGray,
    light: COLOR.white,
    bodyW: 13,
    bodyH: 17,
    trackW: 5,
    trackH: 24,
    turret: 9,
    barrelW: 4,
    barrelL: 14,
    plate: "stripe",
  },
  player3: {
    body: COLOR.player,
    dark: COLOR.playerDark,
    track: COLOR.darkGray,
    light: COLOR.white,
    bodyW: 14,
    bodyH: 18,
    trackW: 6,
    trackH: 24,
    turret: 10,
    barrelW: 5,
    barrelL: 14,
    plate: "cannon",
  },
  player4: {
    body: COLOR.yellow,
    dark: COLOR.playerDark,
    track: COLOR.darkGray,
    light: COLOR.steelLight,
    bodyW: 16,
    bodyH: 18,
    trackW: 6,
    trackH: 25,
    turret: 10,
    barrelW: 5,
    barrelL: 16,
    plate: "armor",
  },
  normal: {
    body: COLOR.normal,
    dark: COLOR.normalDark,
    track: COLOR.darkGray,
    light: COLOR.white,
    bodyW: 12,
    bodyH: 15,
    trackW: 5,
    trackH: 22,
    turret: 8,
    barrelW: 3,
    barrelL: 10,
    plate: "single",
  },
  fast: {
    body: COLOR.fast,
    dark: COLOR.fastDark,
    track: COLOR.darkGray,
    light: COLOR.white,
    bodyW: 9,
    bodyH: 18,
    trackW: 4,
    trackH: 25,
    turret: 6,
    barrelW: 3,
    barrelL: 12,
    plate: "stripe",
  },
  power: {
    body: COLOR.power,
    dark: COLOR.powerDark,
    track: COLOR.darkGray,
    light: COLOR.yellow,
    bodyW: 14,
    bodyH: 16,
    trackW: 5,
    trackH: 23,
    turret: 10,
    barrelW: 5,
    barrelL: 14,
    plate: "cannon",
  },
  armor: {
    body: COLOR.armor,
    dark: COLOR.armorDark,
    track: COLOR.darkGray,
    light: COLOR.steelLight,
    bodyW: 16,
    bodyH: 18,
    trackW: 6,
    trackH: 24,
    turret: 10,
    barrelW: 4,
    barrelL: 10,
    plate: "armor",
  },
  life: {
    body: COLOR.white,
    dark: COLOR.steelDark,
    track: COLOR.darkGray,
    light: COLOR.player,
    bodyW: 12,
    bodyH: 15,
    trackW: 5,
    trackH: 22,
    turret: 8,
    barrelW: 3,
    barrelL: 10,
    plate: "single",
  },
};

function drawTank(canvas, index, direction, profile) {
  const { x, y } = frameOrigin(index, 4);
  drawTankAt(canvas, x, y, direction, profile);
}

function drawTankAt(canvas, x, y, direction, profile) {
  if (direction === "up" || direction === "down") {
    drawTankVertical(canvas, x, y, direction, profile);
    return;
  }

  drawTankHorizontal(canvas, x, y, direction, profile);
}

function drawTankVertical(canvas, x, y, direction, profile) {
  const leftTrack = 4;
  const rightTrack = 28 - profile.trackW;
  const trackY = Math.round(16 - profile.trackH / 2);
  const bodyX = Math.round(16 - profile.bodyW / 2);
  const bodyY = Math.round(16 - profile.bodyH / 2) + 2;
  const turret = Math.round(16 - profile.turret / 2);
  const barrelX = Math.round(16 - profile.barrelW / 2);
  const barrelY = direction === "up" ? 2 : 30 - profile.barrelL;

  rect(canvas, x + leftTrack - 1, y + trackY - 1, profile.trackW + 2, profile.trackH + 2, COLOR.black);
  rect(canvas, x + rightTrack - 1, y + trackY - 1, profile.trackW + 2, profile.trackH + 2, COLOR.black);
  rect(canvas, x + leftTrack, y + trackY, profile.trackW, profile.trackH, profile.track);
  rect(canvas, x + rightTrack, y + trackY, profile.trackW, profile.trackH, profile.track);

  for (let yy = trackY + 2; yy < trackY + profile.trackH - 2; yy += 5) {
    rect(canvas, x + leftTrack + 1, y + yy, profile.trackW - 2, 2, profile.light);
    rect(canvas, x + rightTrack + 1, y + yy, profile.trackW - 2, 2, profile.light);
  }

  rect(canvas, x + bodyX - 1, y + bodyY - 1, profile.bodyW + 2, profile.bodyH + 2, COLOR.black);
  rect(canvas, x + bodyX, y + bodyY, profile.bodyW, profile.bodyH, profile.body);
  rect(canvas, x + turret - 1, y + turret + 1, profile.turret + 2, profile.turret + 2, COLOR.black);
  rect(canvas, x + turret, y + turret + 2, profile.turret, profile.turret, profile.dark);
  rect(canvas, x + barrelX - 1, y + barrelY - 1, profile.barrelW + 2, profile.barrelL + 2, COLOR.black);
  rect(canvas, x + barrelX, y + barrelY, profile.barrelW, profile.barrelL, profile.body);

  drawTankPlate(canvas, x, y, profile);
}

function drawTankHorizontal(canvas, x, y, direction, profile) {
  const topTrack = 4;
  const bottomTrack = 28 - profile.trackW;
  const trackX = Math.round(16 - profile.trackH / 2);
  const bodyX = Math.round(16 - profile.bodyH / 2) - 2;
  const bodyY = Math.round(16 - profile.bodyW / 2);
  const turret = Math.round(16 - profile.turret / 2);
  const barrelX = direction === "left" ? 2 : 30 - profile.barrelL;
  const barrelY = Math.round(16 - profile.barrelW / 2);

  rect(canvas, x + trackX - 1, y + topTrack - 1, profile.trackH + 2, profile.trackW + 2, COLOR.black);
  rect(canvas, x + trackX - 1, y + bottomTrack - 1, profile.trackH + 2, profile.trackW + 2, COLOR.black);
  rect(canvas, x + trackX, y + topTrack, profile.trackH, profile.trackW, profile.track);
  rect(canvas, x + trackX, y + bottomTrack, profile.trackH, profile.trackW, profile.track);

  for (let xx = trackX + 2; xx < trackX + profile.trackH - 2; xx += 5) {
    rect(canvas, x + xx, y + topTrack + 1, 2, profile.trackW - 2, profile.light);
    rect(canvas, x + xx, y + bottomTrack + 1, 2, profile.trackW - 2, profile.light);
  }

  rect(canvas, x + bodyX - 1, y + bodyY - 1, profile.bodyH + 2, profile.bodyW + 2, COLOR.black);
  rect(canvas, x + bodyX, y + bodyY, profile.bodyH, profile.bodyW, profile.body);
  rect(canvas, x + turret - 1, y + turret - 1, profile.turret + 2, profile.turret + 2, COLOR.black);
  rect(canvas, x + turret, y + turret, profile.turret, profile.turret, profile.dark);
  rect(canvas, x + barrelX - 1, y + barrelY - 1, profile.barrelL + 2, profile.barrelW + 2, COLOR.black);
  rect(canvas, x + barrelX, y + barrelY, profile.barrelL, profile.barrelW, profile.body);

  drawTankPlate(canvas, x, y, profile);
}

function drawTankPlate(canvas, x, y, profile) {
  if (profile.plate === "stripe") {
    rect(canvas, x + 14, y + 9, 4, 14, profile.light);
    return;
  }

  if (profile.plate === "cannon") {
    rect(canvas, x + 12, y + 12, 8, 8, profile.light);
    rect(canvas, x + 14, y + 14, 4, 4, profile.dark);
    return;
  }

  if (profile.plate === "armor") {
    rect(canvas, x + 10, y + 9, 12, 3, profile.light);
    rect(canvas, x + 10, y + 15, 12, 3, profile.light);
    rect(canvas, x + 10, y + 21, 12, 3, profile.light);
    return;
  }

  rect(canvas, x + 14, y + 14, 4, 4, profile.light);
}

function makeTanks() {
  const canvas = createCanvas(128, 256);
  const rows = [
    TANK_PROFILES.player,
    TANK_PROFILES.player2,
    TANK_PROFILES.player3,
    TANK_PROFILES.player4,
    TANK_PROFILES.normal,
    TANK_PROFILES.fast,
    TANK_PROFILES.power,
    TANK_PROFILES.armor,
  ];
  const directions = ["up", "right", "down", "left"];

  rows.forEach((profile, row) => {
    directions.forEach((direction, col) => drawTank(canvas, row * 4 + col, direction, profile));
  });

  return canvas;
}

function makeTerrain() {
  const canvas = createCanvas(256, 32);

  const brickX = 32;
  for (let quadrantY = 0; quadrantY < 2; quadrantY += 1) {
    for (let quadrantX = 0; quadrantX < 2; quadrantX += 1) {
      const ox = brickX + quadrantX * 16;
      const oy = quadrantY * 16;
      rect(canvas, ox + 1, oy + 1, 14, 14, COLOR.brickDark);
      rect(canvas, ox + 2, oy + 2, 6, 5, COLOR.brickLight);
      rect(canvas, ox + 9, oy + 2, 5, 5, COLOR.brick);
      rect(canvas, ox + 2, oy + 8, 12, 5, COLOR.brick);
      rect(canvas, ox + 7, oy + 8, 1, 5, COLOR.brickDark);
    }
  }

  const steelX = 64;
  for (let quadrantY = 0; quadrantY < 2; quadrantY += 1) {
    for (let quadrantX = 0; quadrantX < 2; quadrantX += 1) {
      const ox = steelX + quadrantX * 16;
      const oy = quadrantY * 16;
      rect(canvas, ox + 1, oy + 1, 14, 14, COLOR.steelDark);
      rect(canvas, ox + 3, oy + 3, 10, 10, COLOR.steel);
      rect(canvas, ox + 4, oy + 4, 3, 3, COLOR.steelLight);
      rect(canvas, ox + 10, oy + 10, 2, 2, COLOR.darkGray);
    }
  }

  const grassX = 96;
  for (let i = 0; i < 18; i += 1) {
    const bladeX = grassX + 2 + (i * 7) % 28;
    const bladeY = 2 + (i * 5) % 26;
    rect(canvas, bladeX, bladeY, 4, 12, i % 3 === 0 ? COLOR.grassLight : COLOR.grass);
    rect(canvas, bladeX + 2, bladeY + 4, 4, 10, COLOR.grassDark);
  }

  const waterX = 128;
  rect(canvas, waterX, 0, 32, 32, COLOR.waterDark);
  rect(canvas, waterX + 2, 2, 28, 28, COLOR.water);
  for (let y = 8; y <= 24; y += 8) {
    line(canvas, waterX + 4, y, waterX + 10, y - 3, COLOR.waterLight);
    line(canvas, waterX + 10, y - 3, waterX + 16, y, COLOR.waterLight);
    line(canvas, waterX + 18, y + 1, waterX + 25, y - 2, COLOR.cyan);
  }

  const iceX = 160;
  rect(canvas, iceX, 0, 32, 32, COLOR.ice);
  line(canvas, iceX + 3, 25, iceX + 25, 3, COLOR.iceLine);
  line(canvas, iceX + 9, 28, iceX + 28, 9, COLOR.white);
  line(canvas, iceX + 5, 8, iceX + 15, 2, COLOR.white);
  line(canvas, iceX + 17, 29, iceX + 29, 17, COLOR.iceLine);

  const baseX = 192;
  rect(canvas, baseX + 8, 18, 16, 9, COLOR.base);
  rect(canvas, baseX + 11, 12, 10, 8, COLOR.baseCore);
  rect(canvas, baseX + 15, 7, 3, 7, COLOR.base);
  rect(canvas, baseX + 7, 14, 6, 5, COLOR.base);
  rect(canvas, baseX + 19, 14, 6, 5, COLOR.base);
  rect(canvas, baseX + 10, 21, 12, 3, COLOR.steelDark);
  rect(canvas, baseX + 14, 15, 4, 3, COLOR.black);

  const brokenX = 224;
  rect(canvas, brokenX + 6, 18, 20, 8, COLOR.brickDark);
  rect(canvas, brokenX + 9, 10, 6, 8, COLOR.base);
  rect(canvas, brokenX + 17, 12, 6, 7, COLOR.baseCore);
  rect(canvas, brokenX + 7, 25, 5, 3, COLOR.brickLight);
  rect(canvas, brokenX + 21, 23, 6, 4, COLOR.brick);
  line(canvas, brokenX + 5, 7, brokenX + 26, 28, COLOR.black);
  line(canvas, brokenX + 6, 27, brokenX + 27, 8, COLOR.black);

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
  drawTankAt(canvas, 160, 0, "up", TANK_PROFILES.life);
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
