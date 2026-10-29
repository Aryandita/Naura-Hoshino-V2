"use strict";

const crypto = require("node:crypto");

/**
 * Canonical 90 Custom Emojis definition grouped by category.
 * Sourced authoritatively from docs/NAURA_EMOJI_DESIGN_SYSTEM.md and ORIGINAL_REQUEST.md.
 */
const EMOJI_CATEGORIES = {
  status: {
    id: "status",
    name: "Status & Reactions",
    count: 20,
    emojis: [
      "naura_happy",
      "naura_sad",
      "naura_angry",
      "naura_surprised",
      "naura_love",
      "naura_thinking",
      "naura_wink",
      "naura_cry",
      "naura_laugh",
      "naura_shy",
      "naura_excited",
      "naura_sleepy",
      "naura_confused",
      "naura_proud",
      "naura_scared",
      "naura_determined",
      "naura_relaxed",
      "naura_embarrassed",
      "naura_curious",
      "naura_celebrate",
    ],
  },
  action: {
    id: "action",
    name: "Actions & Commands",
    count: 15,
    emojis: [
      "naura_play",
      "naura_pause",
      "naura_skip",
      "naura_stop",
      "naura_volume_up",
      "naura_volume_down",
      "naura_queue",
      "naura_shuffle",
      "naura_repeat",
      "naura_lyrics",
      "naura_radio",
      "naura_mic",
      "naura_headphones",
      "naura_equalizer",
      "naura_disc",
    ],
  },
  rpg: {
    id: "rpg",
    name: "RPG & Survival",
    count: 20,
    emojis: [
      "naura_sword",
      "naura_shield",
      "naura_potion_hp",
      "naura_potion_mp",
      "naura_coin_sc",
      "naura_coin_pd",
      "naura_gem_vb",
      "naura_diamond_ba",
      "naura_heart_full",
      "naura_heart_half",
      "naura_energy",
      "naura_food",
      "naura_water",
      "naura_fire",
      "naura_tree",
      "naura_pickaxe",
      "naura_backpack",
      "naura_map",
      "naura_treasure",
      "naura_level_up",
    ],
  },
  system: {
    id: "system",
    name: "System & UI",
    count: 15,
    emojis: [
      "naura_settings",
      "naura_info",
      "naura_warning",
      "naura_error",
      "naura_success",
      "naura_loading",
      "naura_lock",
      "naura_unlock",
      "naura_search",
      "naura_menu",
      "naura_close",
      "naura_back",
      "naura_next",
      "naura_refresh",
      "naura_notification",
    ],
  },
  social: {
    id: "social",
    name: "Social & Community",
    count: 10,
    emojis: [
      "naura_handshake",
      "naura_gift",
      "naura_trophy",
      "naura_star",
      "naura_crown",
      "naura_medal",
      "naura_thumbs_up",
      "naura_clap",
      "naura_wave_hello",
      "naura_vip_badge",
    ],
  },
  special: {
    id: "special",
    name: "Special Naura Signatures",
    count: 10,
    emojis: [
      "naura_smile",
      "naura_wave",
      "naura_sparkle",
      "naura_magic_cast",
      "naura_heart_hands",
      "naura_peace_sign",
      "naura_finger_heart",
      "naura_salute",
      "naura_hug",
      "naura_kiss",
    ],
  },
};

/**
 * Flat list of all 90 canonical emoji names.
 */
const ALL_90_EMOJIS = Object.values(EMOJI_CATEGORIES).flatMap((cat) => cat.emojis);

/**
 * Map from emoji name to its category id.
 */
const EMOJI_TO_CATEGORY_MAP = {};
for (const [catId, catObj] of Object.entries(EMOJI_CATEGORIES)) {
  for (const emoji of catObj.emojis) {
    EMOJI_TO_CATEGORY_MAP[emoji] = catId;
  }
}

/**
 * Brand color tokens from docs/NAURA_EMOJI_DESIGN_SYSTEM.md §3.1 and §3.2.
 */
const BRAND_TOKENS = {
  primary: {
    nauraPink: "#FFB6C1",
    cyberCyan: "#00FFFF",
    dreamPurple: "#C084FC",
    natureGreen: "#22C55E",
  },
  secondary: {
    softRose: "#FFC0CB",
    deepMagenta: "#FF69B4",
    skyBlue: "#87CEEB",
    warmAmber: "#FFD700",
    alertRed: "#FF6B6B",
    neutralGray: "#9CA3AF",
  },
  metallicGold: {
    highlight: "#FFF7CC",
    base: "#FFD700",
    shadow: "#B8860B",
    emboss: "#8B6914",
  },
  glassDark: {
    base: "#060810",
    shadow: "#1F2937",
    pedestal: "#4B5563",
    slate: "#374151",
  },
  forbidden: [
    "#FF00FF", // Raw harsh neon fuchsia
    "#00FF00", // Raw harsh neon lime
  ],
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Fast pure Node.js binary parser for PNG headers.
 * Extracts signature, dimensions (IHDR), bit depth, color type, and alpha channel status.
 *
 * @param {Buffer} buffer
 * @returns {object|null}
 */
function parsePngHeader(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 29) {
    return null;
  }

  const isPng = buffer.subarray(0, 8).equals(PNG_SIGNATURE);
  if (!isPng) return null;

  // IHDR chunk length is at bytes 8-11, type "IHDR" at bytes 12-15
  const ihdrType = buffer.subarray(12, 16).toString("ascii");
  if (ihdrType !== "IHDR") return null;

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);
  const compressionMethod = buffer.readUInt8(26);
  const filterMethod = buffer.readUInt8(27);
  const interlaceMethod = buffer.readUInt8(28);

  // Check for alpha channel:
  // Color type 6 = Truecolor with alpha (RGBA)
  // Color type 4 = Greyscale with alpha (GA)
  // Color type 2 or 3 may have a tRNS chunk
  let hasAlpha = colorType === 6 || colorType === 4;

  if (!hasAlpha) {
    // Scan for tRNS chunk in subsequent chunks
    let offset = 33; // past IHDR (8 sig + 4 len + 4 type + 13 data + 4 crc)
    while (offset + 8 <= buffer.length) {
      const chunkLen = buffer.readUInt32BE(offset);
      const chunkType = buffer.subarray(offset + 4, offset + 8).toString("ascii");
      if (chunkType === "tRNS") {
        hasAlpha = true;
        break;
      }
      if (chunkType === "IEND") break;
      offset += 12 + chunkLen;
    }
  }

  return {
    isPng: true,
    width,
    height,
    bitDepth,
    colorType,
    compressionMethod,
    filterMethod,
    interlaceMethod,
    hasAlpha,
  };
}

/**
 * Fast pure Node.js binary parser for GIF89a / GIF87a files.
 * Extracts Logical Screen Descriptor, frame delays, Netscape infinite loop extension,
 * and Graphic Control Extension transparency.
 *
 * @param {Buffer} buffer
 * @returns {object|null}
 */
function parseGifHeader(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 13) {
    return null;
  }

  const sig = buffer.subarray(0, 6).toString("ascii");
  if (sig !== "GIF87a" && sig !== "GIF89a") {
    return null;
  }

  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  const packedFields = buffer.readUInt8(10);
  const hasGlobalColorTable = (packedFields & 0x80) !== 0;

  let offset = 13;
  if (hasGlobalColorTable) {
    const gctSize = 3 * (1 << ((packedFields & 0x07) + 1));
    offset += gctSize;
  }

  let frameCount = 0;
  const delays = [];
  let isLooping = false;
  let loopCount = null;
  let hasTransparency = false;
  const frameBlocks = [];

  while (offset < buffer.length) {
    const introducer = buffer[offset];
    if (introducer === 0x3b) {
      // Trailer byte - end of GIF
      break;
    }

    if (introducer === 0x21) {
      // Extension block
      const label = buffer[offset + 1];
      if (label === 0xf9) {
        // Graphic Control Extension
        frameCount++;
        const packed = buffer[offset + 3];
        if ((packed & 0x01) !== 0) {
          hasTransparency = true;
        }
        const delay = buffer.readUInt16LE(offset + 4); // in 1/100s
        delays.push(delay);
        offset += 8;
      } else if (label === 0xff) {
        // Application Extension
        const blockSize = buffer[offset + 2];
        if (blockSize >= 11 && offset + 3 + 11 <= buffer.length) {
          const appName = buffer.subarray(offset + 3, offset + 14).toString("ascii");
          if (appName === "NETSCAPE2.0" || appName === "ANIMEXTS1.0") {
            isLooping = true;
            const subBlockLen = buffer[offset + 14];
            if (subBlockLen === 3 && buffer[offset + 15] === 1) {
              loopCount = buffer.readUInt16LE(offset + 16);
            }
          }
        }
        offset += 2;
        while (offset < buffer.length && buffer[offset] !== 0) {
          offset += buffer[offset] + 1;
        }
        offset++;
      } else {
        // Skip general extension sub-blocks
        offset += 2;
        while (offset < buffer.length && buffer[offset] !== 0) {
          offset += buffer[offset] + 1;
        }
        offset++;
      }
    } else if (introducer === 0x2c) {
      // Image Descriptor
      const descStart = offset;
      offset += 10;
      if (offset <= buffer.length) {
        const localPacked = buffer[descStart + 9];
        if ((localPacked & 0x80) !== 0) {
          const lctSize = 3 * (1 << ((localPacked & 0x07) + 1));
          offset += lctSize;
        }
        offset++; // LZW minimum code size
        while (offset < buffer.length && buffer[offset] !== 0) {
          offset += buffer[offset] + 1;
        }
        offset++;
        frameBlocks.push(buffer.subarray(descStart, offset));
      }
    } else {
      offset++;
    }
  }

  const frameHashes = frameBlocks.map((b) => crypto.createHash("sha256").update(b).digest("hex"));
  const uniqueFrames = new Set(frameHashes).size;
  const hasAnimationEntropy = uniqueFrames > 1;

  const avgDelay = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;
  // delay is in hundredths of a second (cs). 8 cs = 80 ms => 12.5 fps
  const fps = avgDelay > 0 ? 100 / avgDelay : 0;

  return {
    sig,
    width,
    height,
    frameCount,
    delays,
    avgDelay,
    fps,
    isLooping,
    loopCount,
    hasTransparency,
    uniqueFrames,
    hasAnimationEntropy,
  };
}

/**
 * Validates brand color tokens and absence of forbidden neon colors in SVG text.
 *
 * @param {string} svgContent
 * @returns {{ valid: boolean, primaryFound: string[], forbiddenFound: string[], errors: string[] }}
 */
function validateSvgColorTokens(svgContent) {
  const errors = [];
  const primaryFound = [];
  const forbiddenFound = [];

  const lowerSvg = svgContent.toLowerCase();

  // Check forbidden colors
  for (const forbidden of BRAND_TOKENS.forbidden) {
    if (lowerSvg.includes(forbidden.toLowerCase())) {
      forbiddenFound.push(forbidden);
      errors.push(`Forbidden color detected: ${forbidden}`);
    }
  }

  // Check primary colors used
  for (const [tokenName, hex] of Object.entries(BRAND_TOKENS.primary)) {
    if (lowerSvg.includes(hex.toLowerCase())) {
      primaryFound.push(tokenName);
    }
  }

  // Check viewBox validity
  const viewBoxMatch = svgContent.match(/viewBox=["']([^"']+)["']/i);
  if (!viewBoxMatch) {
    errors.push("Missing viewBox in SVG");
  } else {
    const coords = viewBoxMatch[1].trim().split(/\s+/).map(Number);
    if (coords.length === 4 && (coords[2] <= 0 || coords[3] <= 0)) {
      errors.push(`Invalid viewBox dimensions: ${viewBoxMatch[1]}`);
    }
  }

  return {
    valid: errors.length === 0,
    primaryFound,
    forbiddenFound,
    errors,
  };
}

/**
 * Validates manifest.json or emoji_manifest.json structure and contents.
 *
 * @param {object} manifest
 * @returns {{ valid: boolean, emojiCount: number, errors: string[] }}
 */
function validateManifestStructure(manifest) {
  const errors = [];

  if (!manifest || typeof manifest !== "object") {
    return { valid: false, emojiCount: 0, errors: ["Manifest is not a valid JSON object"] };
  }

  if (!manifest.version) {
    errors.push("Manifest missing required 'version' field");
  }

  if (!manifest.generated) {
    errors.push("Manifest missing required 'generated' timestamp");
  }

  const emojis = Array.isArray(manifest.emojis) ? manifest.emojis : [];
  if (emojis.length !== 90) {
    errors.push(`Manifest contains ${emojis.length} emojis (expected exactly 90)`);
  }

  const seenNames = new Set();
  for (let i = 0; i < emojis.length; i++) {
    const item = emojis[i];
    if (!item.name) {
      errors.push(`Emoji at index ${i} is missing 'name'`);
      continue;
    }

    if (seenNames.has(item.name)) {
      errors.push(`Duplicate emoji name in manifest: ${item.name}`);
    }
    seenNames.add(item.name);

    if (!ALL_90_EMOJIS.includes(item.name)) {
      errors.push(`Unknown emoji name in manifest: ${item.name}`);
    }

    if (!item.category || !EMOJI_CATEGORIES[item.category]) {
      errors.push(`Invalid category '${item.category}' for emoji ${item.name}`);
    }

    if (!Array.isArray(item.tags) || item.tags.length === 0) {
      errors.push(`Emoji ${item.name} missing valid 'tags' array`);
    }

    if (!item.fallback || typeof item.fallback !== "string") {
      errors.push(`Emoji ${item.name} missing 'fallback' string`);
    }

    // Coordinate verification
    if (typeof item.sheetIndex === "number") {
      if (item.sheetIndex < 0 || item.sheetIndex >= 96) {
        errors.push(`Emoji ${item.name} sheetIndex out of bounds: ${item.sheetIndex}`);
      }
    }

    if (typeof item.x32 === "number" && typeof item.y32 === "number") {
      if (item.x32 < 0 || item.x32 > 512 - 32 || item.y32 < 0 || item.y32 > 192 - 32) {
        errors.push(`Emoji ${item.name} 32px coordinates out of bounds: (${item.x32}, ${item.y32})`);
      }
    }

    if (typeof item.x64 === "number" && typeof item.y64 === "number") {
      if (item.x64 < 0 || item.x64 > 512 - 64 || item.y64 < 0 || item.y64 > 768 - 64) {
        errors.push(`Emoji ${item.name} 64px coordinates out of bounds: (${item.x64}, ${item.y64})`);
      }
    }
  }

  // Spritesheets metadata check
  if (manifest.spritesheets) {
    const s32 = manifest.spritesheets["32"];
    if (s32) {
      if (s32.width !== 512 || s32.height !== 192) {
        errors.push(`Spritesheet 32 dimensions mismatch: ${s32.width}x${s32.height} (expected 512x192)`);
      }
    }
    const s64 = manifest.spritesheets["64"];
    if (s64) {
      if (s64.width !== 512 || s64.height !== 768) {
        errors.push(`Spritesheet 64 dimensions mismatch: ${s64.width}x${s64.height} (expected 512x768)`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    emojiCount: emojis.length,
    errors,
  };
}

/**
 * Creates a minimal valid synthetic PNG buffer (128x128 with RGBA alpha channel).
 * Useful for test runner self-tests and adversarial verification.
 */
function createSyntheticPngBuffer(width = 128, height = 128, colorType = 6, bitDepth = 8) {
  // Construct minimal PNG binary with IHDR and IEND chunks
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(bitDepth, 8);
  ihdrData.writeUInt8(colorType, 9);
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdrChunk = Buffer.alloc(12 + 13);
  ihdrChunk.writeUInt32BE(13, 0);
  ihdrChunk.write("IHDR", 4, "ascii");
  ihdrData.copy(ihdrChunk, 8);
  // dummy CRC (4 bytes at end)
  ihdrChunk.writeUInt32BE(0x12345678, 21);

  // IEND chunk
  const iendChunk = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);

  return Buffer.concat([signature, ihdrChunk, iendChunk]);
}

/**
 * Creates a minimal synthetic GIF buffer with Netscape loop extension and GCE transparency.
 */
function createSyntheticGifBuffer({
  width = 128,
  height = 128,
  fps = 12.5,
  looping = true,
  transparency = true,
  frameCount = 2,
  varyingFrames = true,
} = {}) {
  const delay = Math.round(100 / fps); // e.g. 8 for 12.5 fps
  const chunks = [];

  // 1. Header + Logical Screen Descriptor (13 bytes)
  const lsd = Buffer.alloc(13);
  lsd.write("GIF89a", 0, "ascii");
  lsd.writeUInt16LE(width, 6);
  lsd.writeUInt16LE(height, 8);
  lsd.writeUInt8(0x80, 10); // GCT flag, 2 colors (2^(0+1)=2)
  lsd.writeUInt8(0, 11); // BG color index
  lsd.writeUInt8(0, 12); // Pixel aspect ratio
  chunks.push(lsd);

  // 2. Global Color Table (2 colors * 3 = 6 bytes)
  chunks.push(Buffer.from([0x00, 0x00, 0x00, 0xff, 0xb6, 0xc1]));

  // 3. Netscape 2.0 Loop Extension
  if (looping) {
    const netscape = Buffer.alloc(19);
    netscape[0] = 0x21; // Extension introducer
    netscape[1] = 0xff; // Application Extension label
    netscape[2] = 11; // Block size
    netscape.write("NETSCAPE2.0", 3, "ascii");
    netscape[14] = 3; // Sub-block length
    netscape[15] = 1; // Sub-block ID
    netscape.writeUInt16LE(0, 16); // Loop count 0 = infinite
    netscape[18] = 0; // Block terminator
    chunks.push(netscape);
  }

  // 4. Frames (GCE + Image Descriptor + dummy image data)
  for (let f = 0; f < frameCount; f++) {
    // Graphic Control Extension (8 bytes)
    const gce = Buffer.alloc(8);
    gce[0] = 0x21; // Extension
    gce[1] = 0xf9; // GCE label
    gce[2] = 4; // Block size
    gce[3] = transparency ? 0x05 : 0x04; // Disposal=1 (background), transparency flag bit 0
    gce.writeUInt16LE(delay, 4); // Delay time in 1/100s
    gce[6] = 0; // Transparent color index
    gce[7] = 0; // Block terminator
    chunks.push(gce);

    // Image Descriptor (10 bytes)
    const id = Buffer.alloc(10);
    id[0] = 0x2c; // Image separator
    id.writeUInt16LE(0, 1); // Left
    id.writeUInt16LE(0, 3); // Top
    id.writeUInt16LE(width, 5); // Width
    id.writeUInt16LE(height, 7); // Height
    id[9] = 0; // No local color table
    chunks.push(id);

    // Minimal raster data (LZW min code size 2, 1 subblock of 1 byte, terminator)
    const rasterByte = varyingFrames ? (f % 256) : 0x00;
    chunks.push(Buffer.from([0x02, 0x01, rasterByte, 0x00]));
  }

  // 5. Trailer
  chunks.push(Buffer.from([0x3b]));

  return Buffer.concat(chunks);
}

module.exports = {
  EMOJI_CATEGORIES,
  ALL_90_EMOJIS,
  EMOJI_TO_CATEGORY_MAP,
  BRAND_TOKENS,
  parsePngHeader,
  parseGifHeader,
  validateSvgColorTokens,
  validateManifestStructure,
  createSyntheticPngBuffer,
  createSyntheticGifBuffer,
};
