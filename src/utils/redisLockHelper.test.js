"use strict";

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert");
const {
    acquireLock,
    releaseLock,
    withDistributedLock,
    inMemoryLocks,
} = require("./redisLockHelper");

describe("redisLockHelper (Distributed & In-Memory Locks)", () => {
    beforeEach(() => {
        inMemoryLocks.clear();
    });

    it("dapat memperoleh lock dan melepasnya dengan token yang benar", async () => {
        const lockKey = "lock:test:user:1";
        const token = await acquireLock(lockKey, 2000);
        assert.ok(token, "Token lock harus berhasil dibuat");

        // Percobaan acquire kedua langsung harus gagal karena masih terkunci
        const secondToken = await acquireLock(lockKey, 2000, 1, 10);
        assert.strictEqual(secondToken, null, "Lock kedua harus ditolak saat lock pertama aktif");

        // Release lock
        const released = await releaseLock(lockKey, token);
        assert.strictEqual(released, true, "Release lock harus berhasil");

        // Sekarang acquire berikutnya harus sukses
        const thirdToken = await acquireLock(lockKey, 2000, 1, 10);
        assert.ok(thirdToken, "Lock harus bisa diperoleh kembali setelah dilepas");
        await releaseLock(lockKey, thirdToken);
    });

    it("menolak release jika token salah", async () => {
        const lockKey = "lock:test:user:2";
        const token = await acquireLock(lockKey, 2000);
        assert.ok(token);

        const invalidRelease = await releaseLock(lockKey, "wrong-token-123");
        assert.strictEqual(invalidRelease, false, "Release dengan token salah harus gagal");

        // Lock asli masih aktif
        const checkToken = await acquireLock(lockKey, 2000, 1, 10);
        assert.strictEqual(checkToken, null);

        await releaseLock(lockKey, token);
    });

    it("withDistributedLock mengeksekusi callback dan melepas lock di akhir", async () => {
        const lockKey = "lock:test:action:1";
        let executed = false;

        const result = await withDistributedLock(lockKey, 2000, async () => {
            executed = true;
            return 42;
        });

        assert.strictEqual(executed, true);
        assert.strictEqual(result, 42);

        // Pastikan lock sudah dilepas setelah fungsi selesai
        const nextToken = await acquireLock(lockKey, 2000, 1, 10);
        assert.ok(nextToken, "Lock harus otomatis dilepas di block finally");
        await releaseLock(lockKey, nextToken);
    });

    it("withDistributedLock tetap melepas lock jika callback melempar error", async () => {
        const lockKey = "lock:test:error:1";

        await assert.rejects(async () => {
            await withDistributedLock(lockKey, 2000, async () => {
                throw new Error("Gagal di tengah proses!");
            });
        }, /Gagal di tengah proses!/);

        // Pastikan lock tetap dilepas meski terjadi exception
        const nextToken = await acquireLock(lockKey, 2000, 1, 10);
        assert.ok(nextToken, "Lock harus tetap dilepas meski error terjadi");
        await releaseLock(lockKey, nextToken);
    });
});
