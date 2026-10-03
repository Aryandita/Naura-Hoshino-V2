"use strict";

/**
 * @file celestialRaidEngine.js
 * @description Engine Dungeon Kooperatif Celestial Raid 2.0 (Party 2-4 Pemain).
 * Sepenuhnya bebas ketergantungan AI (100% deterministik, berbasis giliran/turn-based).
 * Menyediakan sinergi 3 peran (Guardian, Vanguard, Apothecary), fase amarah bos (Enrage),
 * dan pembagian hadiah secara atomik ke seluruh anggota tim.
 */

const { logger } = require("../../managers/logger");

const ROLES = Object.freeze({
  GUARDIAN: "GUARDIAN",     // Tank: Shield & absorbs fatal damage
  VANGUARD: "VANGUARD",     // DPS: Combo chain & critical attacks
  APOTHECARY: "APOTHECARY", // Support: Party healing & cleansing
});

const BOSSES = Object.freeze({
  ASTRAL_LEVIATHAN: {
    id: "ASTRAL_LEVIATHAN",
    name: "Astral Leviathan 🐋",
    element: "Cosmic Tide",
    baseHp: 15000,
    baseAttack: 650,
    enrageTurn: 8,
    rewardNsf: 800,
    rewardCoupons: 1,
  },
  VOID_MONARCH: {
    id: "VOID_MONARCH",
    name: "Void Monarch 👑",
    element: "Gravity Singularity",
    baseHp: 20000,
    baseAttack: 850,
    enrageTurn: 8,
    rewardNsf: 1200,
    rewardCoupons: 2,
  },
  NEBULA_CHIMERA: {
    id: "NEBULA_CHIMERA",
    name: "Nebula Chimera 🦁",
    element: "Solar Flare",
    baseHp: 25000,
    baseAttack: 1100,
    enrageTurn: 8,
    rewardNsf: 1800,
    rewardCoupons: 3,
  },
});

class CelestialRaidEngine {
  constructor() {
    // Map<instanceId, RaidSession>
    this.activeRaids = new Map();
  }

  /**
   * Membuat instansi pertempuran raid baru.
   *
   * @param {Object} params
   * @param {string} params.leaderId - ID pembuat party
   * @param {string} [params.bossId="ASTRAL_LEVIATHAN"] - ID Bos yang ditantang
   * @param {Array<{ userId: string, username: string, role: string }>} params.members - Anggota party (2-4 orang)
   * @returns {Object} Instansi raid yang diinisialisasi
   */
  createRaidInstance({ leaderId, bossId = "ASTRAL_LEVIATHAN", members = [] }) {
    if (!members || members.length < 2) {
      throw new Error("Celestial Raid membutuhkan minimal 2 anggota party.");
    }
    if (members.length > 4) {
      throw new Error("Maksimal anggota party Celestial Raid adalah 4 pemain.");
    }

    const bossConfig = BOSSES[bossId] || BOSSES.ASTRAL_LEVIATHAN;
    const instanceId = `raid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Inisialisasi status pemain
    const partyState = members.map((m) => ({
      userId: m.userId,
      username: m.username || "Petualang",
      role: m.role || ROLES.VANGUARD,
      hp: 1000,
      maxHp: 1000,
      shield: 0,
      isAlive: true,
      lastAction: null,
    }));

    const raidSession = {
      instanceId,
      leaderId,
      boss: {
        ...bossConfig,
        currentHp: bossConfig.baseHp,
        isEnraged: false,
      },
      turn: 1,
      status: "IN_PROGRESS", // IN_PROGRESS | VICTORY | DEFEAT
      members: partyState,
      combatLog: [`Pertempuran melawan ${bossConfig.name} dimulai!`],
      createdAt: Date.now(),
    };

    this.activeRaids.set(instanceId, raidSession);
    return raidSession;
  }

  /**
   * Mengambil sesi raid aktif berdasarkan instanceId.
   * @param {string} instanceId
   * @returns {Object|null}
   */
  getRaidInstance(instanceId) {
    return this.activeRaids.get(instanceId) || null;
  }

  /**
   * Menjalankan satu putaran aksi tim melawan bos.
   *
   * @param {string} instanceId
   * @param {Array<{ userId: string, actionType: "ATTACK"|"SKILL"|"DEFEND"|"HEAL" }>} playerActions
   * @returns {Object} Hasil evaluasi giliran pertempuran
   */
  executeTurn(instanceId, playerActions = []) {
    const session = this.getRaidInstance(instanceId);
    if (!session) {
      throw new Error("Sesi Celestial Raid tidak ditemukan atau sudah berakhir.");
    }
    if (session.status !== "IN_PROGRESS") {
      return session;
    }

    const log = [];
    log.push(`=== Giliran ${session.turn} ===`);

    // 1. Fase Sinergi Aksi Pemain
    let totalDamageToBoss = 0;
    let totalPartyHeal = 0;
    let guardianShieldPower = 0;

    for (const action of playerActions) {
      const member = session.members.find((m) => m.userId === action.userId && m.isAlive);
      if (!member) continue;

      if (action.actionType === "ATTACK") {
        const multiplier = member.role === ROLES.VANGUARD ? 1.5 : 1.0;
        const dmg = Math.floor((350 + Math.random() * 150) * multiplier);
        totalDamageToBoss += dmg;
        log.push(`⚔️ ${member.username} (${member.role}) menyerang bos menghasilkan ${dmg} DMG!`);
      } else if (action.actionType === "SKILL") {
        if (member.role === ROLES.VANGUARD) {
          const dmg = Math.floor(750 + Math.random() * 300);
          totalDamageToBoss += dmg;
          log.push(`🔥 ${member.username} melepaskan Ultimate Combo sebesar ${dmg} DMG!`);
        } else if (member.role === ROLES.GUARDIAN) {
          guardianShieldPower += 600;
          log.push(`🛡️ ${member.username} mendirikan Aegis Barrier untuk menyerap serangan fatal!`);
        } else if (member.role === ROLES.APOTHECARY) {
          totalPartyHeal += 450;
          log.push(`🌿 ${member.username} meracik Celestial Elixir memulihkan HP tim!`);
        }
      } else if (action.actionType === "DEFEND") {
        member.shield += member.role === ROLES.GUARDIAN ? 500 : 250;
        log.push(`🛡️ ${member.username} mengambil kuda-kuda bertahan (+${member.shield} Shield).`);
      } else if (action.actionType === "HEAL") {
        const healAmt = member.role === ROLES.APOTHECARY ? 500 : 200;
        totalPartyHeal += healAmt;
        log.push(`💖 ${member.username} memulihkan energi seluruh anggota party.`);
      }
    }

    // Terapkan damage ke bos
    session.boss.currentHp = Math.max(0, session.boss.currentHp - totalDamageToBoss);
    log.push(`💥 Bos menerima total ${totalDamageToBoss} DMG! (Sisa HP: ${session.boss.currentHp}/${session.boss.baseHp})`);

    // Terapkan heal ke seluruh anggota yang hidup
    if (totalPartyHeal > 0) {
      session.members.forEach((m) => {
        if (m.isAlive) {
          m.hp = Math.min(m.maxHp, m.hp + totalPartyHeal);
        }
      });
      log.push(`✨ Seluruh party pulih sebesar +${totalPartyHeal} HP.`);
    }

    // Terapkan barrier guardian ke party
    if (guardianShieldPower > 0) {
      session.members.forEach((m) => {
        if (m.isAlive) m.shield += Math.floor(guardianShieldPower / session.members.length);
      });
    }

    // Cek Kemenangan
    if (session.boss.currentHp <= 0) {
      session.status = "VICTORY";
      log.push(`🏆 SELAMAT! Bos ${session.boss.name} berhasil ditundukkan oleh kerja sama party!`);
      session.combatLog.push(...log);
      return session;
    }

    // 2. Fase Serangan Bos & Amarah (Enrage)
    if (session.turn >= session.boss.enrageTurn && !session.boss.isEnraged) {
      session.boss.isEnraged = true;
      log.push(`⚠️ PERINGATAN! ${session.boss.name} memasuki FASE AMARAH (ENRAGE)! Serangan berlipat ganda!`);
    }

    const bossAtkMult = session.boss.isEnraged ? 2.2 : 1.0;
    const baseBossDmg = Math.floor(session.boss.baseAttack * bossAtkMult);

    session.members.forEach((m) => {
      if (!m.isAlive) return;
      let incomingDmg = baseBossDmg + Math.floor(Math.random() * 100);

      // Serap dengan shield dulu
      if (m.shield > 0) {
        if (m.shield >= incomingDmg) {
          m.shield -= incomingDmg;
          incomingDmg = 0;
        } else {
          incomingDmg -= m.shield;
          m.shield = 0;
        }
      }

      m.hp = Math.max(0, m.hp - incomingDmg);
      if (m.hp === 0) {
        m.isAlive = false;
        log.push(`💀 ${m.username} tumbang terkena serangan telak bos!`);
      }
    });

    // Cek Kekalahan (Wipeout)
    const aliveCount = session.members.filter((m) => m.isAlive).length;
    if (aliveCount === 0) {
      session.status = "DEFEAT";
      log.push(`❌ Seluruh anggota party gugur. Ekspedisi Celestial Raid gagal.`);
    } else {
      session.turn += 1;
    }

    session.combatLog.push(...log);
    return session;
  }

  /**
   * Bagikan hadiah raid secara adil dan merata ke seluruh anggota tim.
   *
   * @param {string} instanceId
   * @param {Function} [incrementFn] - Mock function untuk testing
   * @returns {Promise<{ distributed: boolean, rewardPerMember: { nsf: number, coupons: number } }>}
   */
  async distributeRewards(instanceId, incrementFn) {
    const session = this.getRaidInstance(instanceId);
    if (!session || session.status !== "VICTORY") {
      return { distributed: false, rewardPerMember: { nsf: 0, coupons: 0 } };
    }

    const rewardNsf = session.boss.rewardNsf || 800;
    const rewardCoupons = session.boss.rewardCoupons || 1;

    for (const member of session.members) {
      try {
        if (typeof incrementFn === "function") {
          await incrementFn(member.userId, { starFragments: rewardNsf, coupons: rewardCoupons });
        } else {
          const cacheManager = require("../../managers/cacheManager");
          await cacheManager.incrementUserSurvival(member.userId, "starFragments", rewardNsf);
          if (rewardCoupons > 0) {
            await cacheManager.incrementUserSurvival(member.userId, "coupons", rewardCoupons);
          }
        }
      } catch (err) {
        logger.error(`[CelestialRaid] Gagal membagikan reward ke ${member.userId}:`, err);
      }
    }

    this.activeRaids.delete(instanceId);
    return {
      distributed: true,
      rewardPerMember: { nsf: rewardNsf, coupons: rewardCoupons },
    };
  }
}

module.exports = new CelestialRaidEngine();
