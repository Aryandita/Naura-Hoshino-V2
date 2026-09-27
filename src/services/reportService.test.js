"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const reportService = require("./reportService");
const env = require("../config/env");

test("ReportService - Attachment Caching", () => {
  const userId = "user_test_attachment_123";
  const dummyAttachment = {
    url: "https://cdn.discordapp.com/attachments/123/screenshot.png",
    name: "screenshot.png",
    contentType: "image/png",
  };

  reportService.saveTempAttachment(userId, dummyAttachment);
  const retrieved = reportService.getTempAttachment(userId);

  assert.ok(retrieved, "Lampiran berhasil disimpan dan diambil");
  assert.equal(retrieved.url, dummyAttachment.url);
  assert.equal(retrieved.name, "screenshot.png");

  // Pengambilan kedua harus null karena sudah dikonsumsi
  const secondFetch = reportService.getTempAttachment(userId);
  assert.equal(secondFetch, null, "Lampiran harus dihapus setelah sekali diambil");
});

test("ReportService - Validation & Report Creation", async () => {
  await assert.rejects(
    async () => {
      await reportService.createReport({ userId: "", title: "", description: "" });
    },
    /Parameter laporan tidak lengkap/,
    "Harus menolak jika parameter wajib kosong",
  );

  const mockClient = {
    users: {
      fetch: async (id) => ({
        id,
        send: async (payload) => {
          assert.ok(payload.embeds || payload.components, "Payload harus valid");
          return { id: "msg_dummy_123" };
        },
      }),
    },
  };

  // Simulasikan 1 owner ID di env
  const originalOwners = env.OWNER_IDS;
  env.OWNER_IDS = ["owner_dummy_999"];

  try {
    const res = await reportService.createReport({
      userId: "user_pelapor_1",
      userName: "Budi Petualang",
      guildId: "guild_test_101",
      guildName: "Server Nusantara",
      title: "Menu lelang macet saat malam hari",
      description: "Ketika tombol refresh ditekan, muncul pesan galat 404.",
      attachmentUrl: "https://cdn.discordapp.com/attachments/123/lelang_bug.png",
      client: mockClient,
    });

    assert.ok(res.success, "Pembuatan laporan harus sukses");
    assert.ok(res.reportId.startsWith("REP-"), "Format ID harus berawalan REP-");
    assert.equal(res.deliveredCount, 1, "Harus terkirim ke 1 owner");
    assert.equal(res.data.status, "PENDING", "Status awal harus PENDING");

    // Verifikasi pembacaan via getReport
    const fetched = await reportService.getReport(res.reportId);
    assert.ok(fetched, "Laporan harus dapat dibaca kembali");
    assert.equal(fetched.title, "Menu lelang macet saat malam hari");
  } finally {
    env.OWNER_IDS = originalOwners;
  }
});

test("ReportService - Multi-Owner Fallback on DM Error", async () => {
  const originalOwners = env.OWNER_IDS;
  env.OWNER_IDS = ["owner_closed_dm", "owner_active_dm"];

  const mockClient = {
    users: {
      fetch: async (id) => {
        if (id === "owner_closed_dm") {
          return {
            id,
            send: async () => {
              const err = new Error("Cannot send messages to this user");
              err.code = 50007;
              throw err;
            },
          };
        }
        return {
          id,
          send: async () => ({ id: "msg_success" }),
        };
      },
    },
  };

  try {
    const res = await reportService.createReport({
      userId: "user_pelapor_2",
      userName: "Siti",
      title: "Bug memancing di danau",
      description: "Ikan tidak muncul saat strike.",
      client: mockClient,
    });

    assert.ok(res.success);
    assert.equal(res.deliveredCount, 1, "Harus tetap terkirim ke owner kedua meski owner pertama gagal");
  } finally {
    env.OWNER_IDS = originalOwners;
  }
});

test("ReportService - Reply and Resolve Workflow", async () => {
  let dmReceivedByUser = false;

  const mockClient = {
    users: {
      fetch: async (id) => {
        if (id === "user_reporter_3") {
          return {
            id,
            send: async (payload) => {
              dmReceivedByUser = true;
              assert.ok(payload, "Pesan balasan harus terkirim");
              return { id: "dm_to_user_ok" };
            },
          };
        }
        return null;
      },
    },
  };

  const created = await reportService.createReport({
    userId: "user_reporter_3",
    userName: "Andi",
    title: "Tombol profile tidak muncul",
    description: "Layar blank putih setelah mengetik /profile",
  });

  // Balas laporan
  const replyRes = await reportService.replyToReport(
    created.reportId,
    "Halo Andi, perbaikan sudah kami rilis pada patch terbaru. Coba lagi ya!",
    "DevNaura",
    mockClient,
  );

  assert.ok(replyRes.success);
  assert.ok(replyRes.deliveredToUser, "Pesan balasan harus sampai ke DM pengguna");
  assert.ok(dmReceivedByUser, "DM harus diterima oleh pengguna");
  assert.equal(replyRes.report.status, "INVESTIGATING", "Status harus beralih ke INVESTIGATING");
  assert.equal(replyRes.report.ownerReply, "Halo Andi, perbaikan sudah kami rilis pada patch terbaru. Coba lagi ya!");

  // Selesaikan laporan
  const resolved = await reportService.resolveReport(created.reportId, "DevNaura");
  assert.equal(resolved.status, "RESOLVED", "Status harus RESOLVED");
  assert.ok(resolved.resolvedAt, "Timestamp resolvedAt harus terisi");
});
