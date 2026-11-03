// ISO/IEC 18004 QR Code Matrix Generator (Byte Mode, Error Correction Level L, Versions 1-6)

const VERSION_SPECS = [
  null,
  { size: 21, totalCodewords: 26, ecCodewords: 7, align: [] },
  { size: 25, totalCodewords: 44, ecCodewords: 10, align: [6, 18] },
  { size: 29, totalCodewords: 70, ecCodewords: 15, align: [6, 22] },
  { size: 33, totalCodewords: 100, ecCodewords: 20, align: [6, 26] },
  { size: 37, totalCodewords: 134, ecCodewords: 26, align: [6, 30] },
  { size: 41, totalCodewords: 172, ecCodewords: 18, blocks: 2, align: [6, 34] }
];

// Format info bits for EC Level L (01) and Mask 0 (000) -> 0x77c4 (with BCH and XOR mask 0x5412)
const FORMAT_BITS_L_MASK0 = 0x77c4;

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function getGeneratorPoly(degree) {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function computeReedSolomon(dataBytes, ecLen) {
  const gen = getGeneratorPoly(ecLen);
  const msg = new Uint8Array(dataBytes.length + ecLen);
  msg.set(dataBytes, 0);

  for (let i = 0; i < dataBytes.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return msg.slice(dataBytes.length);
}

function selectVersion(byteLen) {
  for (let v = 1; v <= 6; v++) {
    const spec = VERSION_SPECS[v];
    const blocks = spec.blocks || 1;
    const dataCapacity = spec.totalCodewords - spec.ecCodewords * blocks;
    // Byte mode header: 4 bits mode + 8 bits length = 12 bits (1.5 bytes -> max capacity - 2)
    if (byteLen + 2 <= dataCapacity) return v;
  }
  return 6;
}

function encodeDataCodewords(utf8Bytes, version) {
  const spec = VERSION_SPECS[version];
  const blocks = spec.blocks || 1;
  const totalDataBytes = spec.totalCodewords - spec.ecCodewords * blocks;

  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  // Mode indicator: Byte mode (0100)
  pushBits(0b0100, 4);
  // Character count indicator (8 bits for versions 1-9)
  pushBits(utf8Bytes.length, 8);
  // Payload bytes
  for (const b of utf8Bytes) {
    pushBits(b, 8);
  }
  // Terminator (up to 4 zero bits)
  const maxBits = totalDataBytes * 8;
  for (let i = 0; i < 4 && bits.length < maxBits; i++) {
    bits.push(0);
  }
  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const dataBytes = new Uint8Array(totalDataBytes);
  const bitByteLen = bits.length / 8;
  for (let i = 0; i < bitByteLen; i++) {
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      byteVal = (byteVal << 1) | bits[i * 8 + b];
    }
    dataBytes[i] = byteVal;
  }

  const padBytes = [0xec, 0x11];
  for (let i = bitByteLen; i < totalDataBytes; i++) {
    dataBytes[i] = padBytes[(i - bitByteLen) % 2];
  }

  if (blocks === 1) {
    const ec = computeReedSolomon(dataBytes, spec.ecCodewords);
    const full = new Uint8Array(spec.totalCodewords);
    full.set(dataBytes, 0);
    full.set(ec, dataBytes.length);
    return full;
  }

  // Interleave 2 equal blocks for Version 6
  const blockDataLen = totalDataBytes / 2;
  const b1 = dataBytes.slice(0, blockDataLen);
  const b2 = dataBytes.slice(blockDataLen);
  const ec1 = computeReedSolomon(b1, spec.ecCodewords);
  const ec2 = computeReedSolomon(b2, spec.ecCodewords);

  const full = new Uint8Array(spec.totalCodewords);
  let idx = 0;
  for (let i = 0; i < blockDataLen; i++) {
    full[idx++] = b1[i];
    full[idx++] = b2[i];
  }
  for (let i = 0; i < spec.ecCodewords; i++) {
    full[idx++] = ec1[i];
    full[idx++] = ec2[i];
  }
  return full;
}

export function generateQrMatrix(text) {
  const encoder = new TextEncoder();
  const rawBytes = encoder.encode(text || '');
  const version = selectVersion(rawBytes.length);
  const spec = VERSION_SPECS[version];
  const size = spec.size;
  const maxPayload = spec.totalCodewords - spec.ecCodewords * (spec.blocks || 1) - 2;
  const utf8Bytes = rawBytes.length > maxPayload ? rawBytes.slice(0, maxPayload) : rawBytes;

  const matrix = Array.from({ length: size }, () => new Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  const setModule = (r, c, isDark) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = Boolean(isDark);
      reserved[r][c] = true;
    }
  };

  // Finder patterns + separators
  const placeFinder = (row, col) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setModule(row + r, col + c, inOuter && (onBorder || inInner));
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Alignment patterns
  const alignCoords = spec.align;
  for (const r of alignCoords) {
    for (const c of alignCoords) {
      if (reserved[r][c]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isDark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setModule(r + dr, c + dc, isDark);
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) setModule(6, i, i % 2 === 0);
    if (!reserved[i][6]) setModule(i, 6, i % 2 === 0);
  }

  // Dark module and format area reservation
  setModule(size - 8, 8, true);
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) reserved[8][i] = true;
    if (!reserved[i][8]) reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    if (!reserved[8][size - 1 - i]) reserved[8][size - 1 - i] = true;
    if (!reserved[size - 1 - i][8]) reserved[size - 1 - i][8] = true;
  }

  // Place data and EC codewords in upward/downward 2-column zig-zag
  const codewords = encodeDataCodewords(utf8Bytes, version);
  let bitIdx = 0;
  const totalBits = codewords.length * 8;

  let upward = true;
  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5; // Skip vertical timing column
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (let dc = 0; dc < 2; dc++) {
        const c = rightCol - dc;
        if (!reserved[r][c]) {
          let bit = false;
          if (bitIdx < totalBits) {
            const byteVal = codewords[bitIdx >> 3];
            bit = ((byteVal >> (7 - (bitIdx & 7))) & 1) === 1;
            bitIdx++;
          }
          // Apply Mask 0: (r + c) % 2 === 0
          if ((r + c) % 2 === 0) bit = !bit;
          matrix[r][c] = bit;
        }
      }
    }
    upward = !upward;
  }

  // Write Format Information bits (EC Level L, Mask 0)
  for (let i = 0; i < 15; i++) {
    const bit = ((FORMAT_BITS_L_MASK0 >> i) & 1) === 1;
    // Around top-left finder
    if (i < 6) matrix[i][8] = bit;
    else if (i < 8) matrix[i + 1][8] = bit;
    else matrix[8][14 - i] = bit;

    // Split across bottom-left and top-right
    if (i < 8) matrix[8][size - 1 - i] = bit;
    else matrix[size - 15 + i][8] = bit;
  }

  return matrix;
}
