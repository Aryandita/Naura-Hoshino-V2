"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const incidentService = require("./incidentService");

test("IncidentService - Global Maintenance Toggle", async () => {
  assert.equal(incidentService.isGlobalMaintenanceActive(), false);

  await incidentService.setGlobalMaintenance(true, "Patch Darurat Database v2.3.1", "DevOwner");
  assert.equal(incidentService.isGlobalMaintenanceActive(), true);

  const status = await incidentService.getGlobalMaintenance();
  assert.equal(status.active, true);
  assert.equal(status.reason, "Patch Darurat Database v2.3.1");
  assert.equal(status.toggledBy, "DevOwner");

  // Matikan maintenance
  await incidentService.setGlobalMaintenance(false, "Selesai", "DevOwner");
  assert.equal(incidentService.isGlobalMaintenanceActive(), false);
});

test("IncidentService - Module Kill-Switch", async () => {
  assert.equal(incidentService.isModuleKilled("music"), false);

  await incidentService.setModuleKillSwitch("music", true, "DevOwner");
  assert.equal(incidentService.isModuleKilled("music"), true);
  assert.equal(incidentService.isModuleKilled("MUSIC"), true, "Pemeriksaan harus case-insensitive");

  const killedList = incidentService.listKilledModules();
  assert.ok(killedList.some((m) => m.module === "music"));

  // Pulihkan modul
  await incidentService.setModuleKillSwitch("music", false, "DevOwner");
  assert.equal(incidentService.isModuleKilled("music"), false);
});

test("IncidentService - Doctor Diagnostic Execution", async () => {
  const mockClient = {
    ws: { ping: 45 },
    guilds: { cache: { size: 10 } },
  };

  const report = await incidentService.runDoctorDiagnostic(mockClient);
  assert.ok(report, "Laporan diagnostik harus terbentuk");
  assert.ok(report.pillars.relationalDb, "Harus menguji Relational DB");
  assert.ok(report.pillars.mongoDb, "Harus menguji MongoDB");
  assert.ok(report.pillars.redis, "Harus menguji Redis");
  assert.ok(report.pillars.gateway, "Harus menguji Discord Gateway");
  assert.equal(report.pillars.gateway.pingMs, 45);
});

test("IncidentService - Player Stuck-State Repair", async () => {
  const res = await incidentService.repairPlayerState("user_stuck_999", "AdminJoko");
  assert.ok(res.success);
  assert.equal(res.userId, "user_stuck_999");
  assert.equal(res.repairedBy, "AdminJoko");
});

test("IncidentService - Server Panic Lockdown & Restore", async () => {
  let slowmodeApplied = 0;
  let overwritesEdited = 0;

  const mockChannel = {
    id: "chan_text_1",
    name: "lounge-umum",
    isTextBased: () => true,
    isThread: () => false,
    rateLimitPerUser: 0,
    permissionOverwrites: {
      cache: new Map(),
      edit: async () => {
        overwritesEdited++;
      },
    },
    setRateLimitPerUser: async (sec) => {
      slowmodeApplied = sec;
    },
  };

  const mockGuild = {
    id: "guild_raid_test_101",
    name: "Komunitas Gaming",
    roles: { everyone: { id: "role_everyone_101" } },
    channels: {
      cache: new Map([["chan_text_1", mockChannel]]),
    },
  };

  // Aktifkan Panic Lockdown
  const lockRes = await incidentService.activatePanicLockdown(mockGuild, "AdminAgus");
  assert.ok(lockRes.success);
  assert.equal(lockRes.affectedChannels, 1);
  assert.equal(slowmodeApplied, 15, "Slowmode 15 detik harus dipasang");
  assert.ok(overwritesEdited > 0, "Permission harus diubah");

  // Pulihkan Server
  const restoreRes = await incidentService.restorePanicLockdown(mockGuild, "AdminAgus");
  assert.ok(restoreRes.success);
  assert.equal(restoreRes.restoredChannels, 1);
  assert.equal(slowmodeApplied, 0, "Slowmode harus dinormalkan kembali ke 0");
});
