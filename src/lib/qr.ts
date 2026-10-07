/**
 * Small QR code generator (byte mode, error correction level M, versions 1-12), so the dashboard's QR code is drawn
 * on the phone itself instead of downloaded from an outside website (one less request, works offline, and the
 * barber's link is not sent to a third party).
 */

// [error-correction codewords per block, blocks of the first size, data codewords of those, blocks of the second size, data codewords of those]
const BLOCKS_M: Record<number, [number, number, number, number, number]> = {
  1: [10, 1, 16, 0, 0], 2: [16, 1, 28, 0, 0], 3: [26, 1, 44, 0, 0], 4: [18, 2, 32, 0, 0], 5: [24, 2, 43, 0, 0], 6: [16, 4, 27, 0, 0],
  7: [18, 4, 31, 0, 0], 8: [22, 2, 38, 2, 39], 9: [22, 3, 36, 2, 37], 10: [26, 4, 43, 1, 44], 11: [30, 1, 50, 4, 51], 12: [22, 6, 36, 2, 37],
};
const ALIGN: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50], 11: [6, 30, 54], 12: [6, 32, 58],
};

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rsEncode(data: number[], degree: number): number[] {
  let gen = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) { next[j] ^= gen[j]; next[j + 1] ^= mul(gen[j], EXP[i]); }
    gen = next;
  }
  const rem = new Array(degree).fill(0);
  for (const b of data) {
    const factor = b ^ rem.shift()!;
    rem.push(0);
    for (let i = 0; i < degree; i++) rem[i] ^= mul(gen[i + 1], factor);
  }
  return rem;
}

const bit = (v: number, i: number) => ((v >>> i) & 1) !== 0;

/** Returns the QR code as rows of dark (true) / light (false) squares, without the surrounding blank margin. */
export function qrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  let version = 1;
  const dataCapacity = (v: number) => { const [, n1, d1, n2, d2] = BLOCKS_M[v]; return n1 * d1 + n2 * d2; };
  const countBits = (v: number) => (v < 10 ? 8 : 16);
  while (version <= 12 && dataCapacity(version) * 8 < 4 + countBits(version) + bytes.length * 8) version++;
  if (version > 12) throw new Error("Text too long for QR code");

  // 1. Data bits
  const bits: number[] = [];
  const push = (v: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, countBits(version));
  bytes.forEach((b) => push(b, 8));
  const capBits = dataCapacity(version) * 8;
  push(0, Math.min(4, capBits - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0xec; data.length < dataCapacity(version); pad ^= 0xec ^ 0x11) data.push(pad);

  // 2. Error correction + interleave
  const [ecLen, n1, d1, n2, d2] = BLOCKS_M[version];
  const dataBlocks: number[][] = []; const ecBlocks: number[][] = [];
  let pos = 0;
  for (let b = 0; b < n1 + n2; b++) {
    const len = b < n1 ? d1 : d2;
    const block = data.slice(pos, pos + len); pos += len;
    dataBlocks.push(block); ecBlocks.push(rsEncode(block, ecLen));
  }
  const codewords: number[] = [];
  for (let i = 0; i < Math.max(d1, d2); i++) dataBlocks.forEach((b) => { if (i < b.length) codewords.push(b[i]); });
  for (let i = 0; i < ecLen; i++) ecBlocks.forEach((b) => codewords.push(b[i]));

  // 3. Fixed patterns
  const size = 17 + 4 * version;
  const mod: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const setFn = (x: number, y: number, dark: boolean) => { mod[y][x] = dark; fn[y][x] = true; };
  for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)); const x = cx + dx, y = cy + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const al = ALIGN[version];
  for (let i = 0; i < al.length; i++) for (let j = 0; j < al.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const drawFormat = (mask: number) => {
    let rem = mask; // level M = 00, so the 5 data bits are just the mask
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits15 = ((mask << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(bits15, i));
    setFn(8, 7, bit(bits15, 6)); setFn(8, 8, bit(bits15, 7)); setFn(7, 8, bit(bits15, 8));
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(bits15, i));
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(bits15, i));
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(bits15, i));
    setFn(8, size - 8, true);
  };
  drawFormat(0); // reserve the spots
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const vb = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      setFn(a, b, bit(vb, i)); setFn(b, a, bit(vb, i));
    }
  }

  // 4. Data, zig-zag from the bottom right
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j; const upward = ((right + 1) & 2) === 0; const y = upward ? size - 1 - vert : vert;
      if (!fn[y][x] && k < codewords.length * 8) { mod[y][x] = bit(codewords[k >>> 3], 7 - (k & 7)); k++; }
    }
  }

  // 5. Pick the mask that leaves the least confusing pattern
  const masks = [
    (x: number, y: number) => (x + y) % 2 === 0, (_x: number, y: number) => y % 2 === 0, (x: number) => x % 3 === 0,
    (x: number, y: number) => (x + y) % 3 === 0, (x: number, y: number) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x: number, y: number) => ((x * y) % 2) + ((x * y) % 3) === 0, (x: number, y: number) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x: number, y: number) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const applyMask = (m: number) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && masks[m](x, y)) mod[y][x] = !mod[y][x]; };
  const penalty = (): number => {
    let score = 0;
    const lines: boolean[][] = [];
    for (let i = 0; i < size; i++) { lines.push(mod[i]); lines.push(mod.map((r) => r[i])); }
    for (const line of lines) {
      let run = 1;
      for (let i = 1; i <= size; i++) {
        if (i < size && line[i] === line[i - 1]) run++;
        else { if (run >= 5) score += 3 + run - 5; run = 1; }
      }
      const s = line.map((v) => (v ? "1" : "0")).join("");
      for (const p of ["10111010000", "00001011101"]) { let from = 0; for (;;) { const f = s.indexOf(p, from); if (f < 0) break; score += 40; from = f + 1; } }
    }
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = mod[y][x]; if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) score += 3; }
    let dark = 0; for (const r of mod) for (const v of r) if (v) dark++;
    score += Math.max(0, Math.ceil(Math.abs((dark * 100) / (size * size) - 50) / 5) - 1) * 10;
    return score;
  };
  let best = 0; let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m); drawFormat(m);
    const s = penalty();
    if (s < bestScore) { bestScore = s; best = m; }
    applyMask(m); // undo
  }
  applyMask(best); drawFormat(best);
  return mod;
}

/** One SVG path for all dark squares (runs of neighbours joined), inside a viewBox of `size + 2 * margin` units. */
export function qrSvg(text: string, margin = 2): { path: string; box: number } {
  const m = qrMatrix(text);
  let path = "";
  m.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) { x++; continue; }
      let end = x; while (end < row.length && row[end]) end++;
      path += `M${x + margin} ${y + margin}h${end - x}v1h-${end - x}z`;
      x = end;
    }
  });
  return { path, box: m.length + margin * 2 };
}
