"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const accessKeyService = require("./accessKeyService");

test("AccessKeyService - Lifecycle & Consumption", async () => {
  const created = await accessKeyService.createKey({
    createdBy: "DevOwner",
    maxUses: 2,
    durationHours: 24,
  });

  assert.ok(created.keyString.startsWith("NAURA-DEV-"), "Format kunci harus NAURA-DEV-");
  assert.equal(created.maxUses, 2);
  assert.equal(created.usedCount, 0);

  // Validasi awal
  const v1 = await accessKeyService.validateKey(created.keyString);
  assert.ok(v1.valid);
  assert.equal(v1.remainingUses, 2);

  // Konsumsi pertama
  await accessKeyService.consumeKey(created.keyString);
  const v2 = await accessKeyService.validateKey(created.keyString);
  assert.ok(v2.valid);
  assert.equal(v2.remainingUses, 1);

  // Konsumsi kedua (terakhir)
  await accessKeyService.consumeKey(created.keyString);
  const v3 = await accessKeyService.validateKey(created.keyString);
  assert.equal(v3.valid, false, "Kunci harus habis setelah 2 kali pemakaian");
  assert.match(v3.reason, /Kuota pemakaian/, "Harus memuat alasan kuota habis");
});

test("AccessKeyService - User Lock & Revocation", async () => {
  const created = await accessKeyService.createKey({
    createdBy: "DevOwner",
    assignedToUserId: "user_authorized_1",
    maxUses: 5,
  });

  // User lain mencoba menggunakan
  const vOther = await accessKeyService.validateKey(created.keyString, "user_unauthorized_2");
  assert.equal(vOther.valid, false);
  assert.match(vOther.reason, /terdaftar khusus untuk pengguna lain/);

  // User yang sah menggunakan
  const vOwner = await accessKeyService.validateKey(created.keyString, "user_authorized_1");
  assert.ok(vOwner.valid);

  // Cabut kunci
  await accessKeyService.revokeKey(created.keyString);
  const vRevoked = await accessKeyService.validateKey(created.keyString, "user_authorized_1");
  assert.equal(vRevoked.valid, false);
  assert.match(vRevoked.reason, /telah dicabut atau dinonaktifkan/);
});

test("AccessKeyService - Expiration Check", async () => {
  const expiredKey = await accessKeyService.createKey({
    createdBy: "DevOwner",
    durationHours: -1, // Sudah kedaluwarsa 1 jam lalu
  });

  const vExp = await accessKeyService.validateKey(expiredKey.keyString);
  assert.equal(vExp.valid, false);
  assert.match(vExp.reason, /telah kedaluwarsa/);
});
