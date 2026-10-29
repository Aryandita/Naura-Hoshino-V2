// Lokasi: scripts/emojis/canvasRenderer.js
// Renderer Kanvas (@napi-rs/canvas) untuk Static PNG dan Animated GIF
"use strict";

const { createCanvas, loadImage } = require("../../src/canvas/canvasRuntime");
// GifEncoder dan GifDisposal adalah utilitas native level-rendah yang belum dibungkus oleh canvasRuntime
// eslint-disable-next-line no-restricted-syntax
const { GifEncoder, GifDisposal } = require("@napi-rs/canvas");
const { getEmojiSvg } = require("./svgGenerator");

const CANVAS_WIDTH = 128;
const CANVAS_HEIGHT = 128;
const DEFAULT_FRAME_COUNT = 12;
const DEFAULT_FRAME_DELAY_MS = 80; // 80ms => 12.5 FPS

/**
 * Merender SVG menjadi PNG Buffer 128x128 dengan channel transparansi 8-bit
 * @param {string} svgContent - String XML SVG
 * @returns {Promise<Buffer>} Buffer PNG
 */
async function renderSvgToPng(svgContent) {
  const img = await loadImage(Buffer.from(svgContent));
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext("2d");

  // Pastikan kanvas transparan
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const pngBuffer = await canvas.encode("png");
  return pngBuffer;
}

/**
 * Merender emoji menjadi Animated GIF looping 12-15 FPS dengan background transparan
 * @param {string} emojiName - Nama emoji
 * @param {object} [options]
 * @param {number} [options.frameCount=12] - Jumlah frame per siklus loop
 * @param {number} [options.delay=80] - Delay antar frame dalam ms (80ms = 12.5 fps)
 * @returns {Promise<Buffer>} Buffer GIF89a
 */
async function renderEmojiToGif(emojiName, options = {}) {
  const frameCount = options.frameCount || DEFAULT_FRAME_COUNT;
  const delay = options.delay || DEFAULT_FRAME_DELAY_MS;

  const encoder = new GifEncoder(CANVAS_WIDTH, CANVAS_HEIGHT, {
    repeat: 0, // Infinite loop Netscape 2.0
    quality: 10,
  });

  for (let f = 0; f < frameCount; f++) {
    const frameSvg = getEmojiSvg(emojiName, { frame: f, totalFrames: frameCount });
    const img = await loadImage(Buffer.from(frameSvg));

    const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const frameData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const uint8 = new Uint8Array(
      frameData.data.buffer,
      frameData.data.byteOffset,
      frameData.data.byteLength
    );

    encoder.addFrame(uint8, CANVAS_WIDTH, CANVAS_HEIGHT, {
      delay,
      disposal: GifDisposal.Background,
    });
  }

  const gifBuffer = encoder.finish();
  return gifBuffer;
}

module.exports = {
  renderSvgToPng,
  renderEmojiToGif,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DEFAULT_FRAME_COUNT,
  DEFAULT_FRAME_DELAY_MS,
};
