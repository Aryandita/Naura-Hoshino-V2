"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  fetchSkinTextureWithFallback,
  getDefaultAvatarBuffer,
  getDefaultBodyBuffer,
  renderMinecraftPlayer,
  renderMinecraftStats,
} = require("../src/canvas/minecraftCanvas");

describe("Minecraft Skin Canvas Multi-Provider Cascade & Fallback", () => {
  const sampleUuid = "069a79f444e94726a5befca90e38aaf5"; // Notch UUID

  it("should generate a valid default Steve avatar buffer with PNG header", () => {
    const avatarBuf = getDefaultAvatarBuffer();
    assert(Buffer.isBuffer(avatarBuf), "Avatar buffer must be a Buffer");
    assert(avatarBuf.length > 100, "Avatar buffer must be non-empty");
    assert.strictEqual(avatarBuf[0], 0x89, "Byte 0 must be 0x89 (PNG header)");
    assert.strictEqual(avatarBuf[1], 0x50, "Byte 1 must be 0x50 (P)");
    assert.strictEqual(avatarBuf[2], 0x4e, "Byte 2 must be 0x4E (N)");
    assert.strictEqual(avatarBuf[3], 0x47, "Byte 3 must be 0x47 (G)");
  });

  it("should generate a valid default Steve body silhouette buffer with PNG header", () => {
    const bodyBuf = getDefaultBodyBuffer();
    assert(Buffer.isBuffer(bodyBuf), "Body buffer must be a Buffer");
    assert(bodyBuf.length > 500, "Body buffer must be non-empty");
    assert.strictEqual(bodyBuf[0], 0x89, "Byte 0 must be 0x89 (PNG header)");
    assert.strictEqual(bodyBuf[1], 0x50, "Byte 1 must be 0x50 (P)");
    assert.strictEqual(bodyBuf[2], 0x4e, "Byte 2 must be 0x4E (N)");
    assert.strictEqual(bodyBuf[3], 0x47, "Byte 3 must be 0x47 (G)");
  });

  it("should safely return default avatar buffer when UUID is null or empty", async () => {
    const resultNull = await fetchSkinTextureWithFallback(null, "avatar");
    assert(Buffer.isBuffer(resultNull), "Must return Buffer");
    assert.strictEqual(resultNull[0], 0x89, "Must be valid PNG");

    const resultEmpty = await fetchSkinTextureWithFallback("", "avatar");
    assert(Buffer.isBuffer(resultEmpty), "Must return Buffer");
    assert.strictEqual(resultEmpty[0], 0x89, "Must be valid PNG");
  });

  it("should safely return default body buffer when UUID is null or empty", async () => {
    const resultNull = await fetchSkinTextureWithFallback(null, "body");
    assert(Buffer.isBuffer(resultNull), "Must return Buffer");
    assert.strictEqual(resultNull[0], 0x89, "Must be valid PNG");

    const resultEmpty = await fetchSkinTextureWithFallback("", "body");
    assert(Buffer.isBuffer(resultEmpty), "Must return Buffer");
    assert.strictEqual(resultEmpty[0], 0x89, "Must be valid PNG");
  });

  it("should cascade to primary provider (mc-heads) when available", async () => {
    const mockImageBuf = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64, 0xaa),
    ]);

    const fakeAxios = {
      async get(url) {
        if (url.includes("mc-heads.net")) {
          return { data: mockImageBuf, status: 200 };
        }
        throw new Error("Unexpected provider called");
      },
    };

    const res = await fetchSkinTextureWithFallback(sampleUuid, "avatar", {
      axiosInstance: fakeAxios,
      timeout: 1000,
    });

    assert(Buffer.isBuffer(res), "Must return buffer");
    assert.deepStrictEqual(res, mockImageBuf, "Must return mc-heads buffer");
  });

  it("should cascade from mc-heads to minotar when mc-heads fails", async () => {
    const minotarImageBuf = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64, 0xbb),
    ]);

    const calls = [];
    const fakeAxios = {
      async get(url) {
        calls.push(url);
        if (url.includes("mc-heads.net")) {
          throw new Error("mc-heads connection timeout");
        }
        if (url.includes("minotar.net")) {
          return { data: minotarImageBuf, status: 200 };
        }
        throw new Error("Should have stopped at minotar");
      },
    };

    const res = await fetchSkinTextureWithFallback(sampleUuid, "avatar", {
      axiosInstance: fakeAxios,
      timeout: 1000,
    });

    assert(Buffer.isBuffer(res), "Must return buffer");
    assert.deepStrictEqual(res, minotarImageBuf, "Must return minotar buffer");
    assert(
      calls.some((u) => u.includes("mc-heads.net")),
      "Must have tried mc-heads",
    );
    assert(
      calls.some((u) => u.includes("minotar.net")),
      "Must have tried minotar",
    );
  });

  it("should cascade to crafatar when mc-heads and minotar both fail", async () => {
    const crafatarImageBuf = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64, 0xcc),
    ]);

    const calls = [];
    const fakeAxios = {
      async get(url) {
        calls.push(url);
        if (url.includes("mc-heads.net")) {
          throw new Error("mc-heads 503 Service Unavailable");
        }
        if (url.includes("minotar.net")) {
          throw new Error("minotar 504 Gateway Timeout");
        }
        if (url.includes("crafatar.com")) {
          return { data: crafatarImageBuf, status: 200 };
        }
        throw new Error("Unknown provider");
      },
    };

    const res = await fetchSkinTextureWithFallback(sampleUuid, "avatar", {
      axiosInstance: fakeAxios,
      timeout: 1000,
    });

    assert(Buffer.isBuffer(res), "Must return buffer");
    assert.deepStrictEqual(
      res,
      crafatarImageBuf,
      "Must return crafatar buffer",
    );
    assert.strictEqual(
      calls.length,
      3,
      "Must have called 3 providers in sequence",
    );
  });

  it("should gracefully fall back to local Steve default buffer when ALL providers fail", async () => {
    const calls = [];
    const fakeAxios = {
      async get(url) {
        calls.push(url);
        throw new Error("ENOTFOUND network failure");
      },
    };

    const avatarRes = await fetchSkinTextureWithFallback(sampleUuid, "avatar", {
      axiosInstance: fakeAxios,
      timeout: 500,
    });

    assert(Buffer.isBuffer(avatarRes), "Must return buffer");
    assert.strictEqual(avatarRes[0], 0x89, "Must return valid PNG");
    assert.strictEqual(
      calls.length,
      3,
      "Must attempt all 3 providers before fallback",
    );

    calls.length = 0;
    const bodyRes = await fetchSkinTextureWithFallback(sampleUuid, "body", {
      axiosInstance: fakeAxios,
      timeout: 500,
    });

    assert(Buffer.isBuffer(bodyRes), "Must return buffer");
    assert.strictEqual(bodyRes[0], 0x89, "Must return valid PNG");
    assert.strictEqual(
      calls.length,
      3,
      "Must attempt all 3 providers before fallback",
    );
  });

  it("should render complete player card without black/empty boxes under total network failure", async () => {
    // Calling renderMinecraftPlayer with a non-existent UUID or offline UUID
    // Must gracefully fall back and return a valid PNG buffer
    const cardBuffer = await renderMinecraftPlayer({
      uuid: "offline-mock-player-uuid-123456",
      realName: "TestPlayer",
    });

    assert(
      Buffer.isBuffer(cardBuffer),
      "Canvas render result must be a Buffer",
    );
    assert(
      cardBuffer.length > 5000,
      "Rendered card must be substantial PNG data",
    );
    assert.strictEqual(
      cardBuffer[0],
      0x89,
      "Must start with PNG signature byte 0x89",
    );
    assert.strictEqual(cardBuffer[1], 0x50, "Must be valid PNG (P)");
    assert.strictEqual(cardBuffer[2], 0x4e, "Must be valid PNG (N)");
    assert.strictEqual(cardBuffer[3], 0x47, "Must be valid PNG (G)");
  });

  it("should render complete player stats card with 3D body without throwing", async () => {
    const statsBuffer = await renderMinecraftStats({
      username: "TestPlayer",
      playDays: 2,
      playHours: 15,
      playMinutes: 45,
      uuid: "offline-mock-player-uuid-123456",
    });

    assert(Buffer.isBuffer(statsBuffer), "Stats card must be a Buffer");
    assert(statsBuffer.length > 5000, "Stats card must be non-empty");
    assert.strictEqual(statsBuffer[0], 0x89, "Must be valid PNG");
  });
});
