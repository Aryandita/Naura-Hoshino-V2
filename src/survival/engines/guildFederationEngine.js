"use strict";

/**
 * guildFederationEngine.js - Mesin Aliansi Antar-Server & Global Hall of Fame.
 *
 * Mengelola:
 *   1. Pembentukan Federasi Aliansi Klan Lintas-Server.
 *   2. Global Hall of Fame (Peringkat Prestise & Kemenangan Aliansi).
 *   3. World-Scale Alliance Raid Boss (Serangan Kolektif Lintas-Guild).
 *   4. Distribusi Hadiah Atomik ke Brankas Kas Klan Anggota.
 */

const redisManager = require("../../managers/redisManager");
const GuildClan = require("../../models/GuildClan");
const { logger } = require("../../managers/logger");

const FEDERATION_PREFIX = "federation:";
const FEDERATION_LIST_KEY = "federations:all";
const ALLIANCE_BOSS_BASE_HP = 50000;

// Penyimpanan in-memory sebagai fallback resilien saat Redis tidak tersedia
const memoryFederations = new Map();
const memoryAllianceBoss = {
  name: "Celestial Chrono-Wyrm",
  hp: ALLIANCE_BOSS_BASE_HP,
  maxHp: ALLIANCE_BOSS_BASE_HP,
  phase: 1,
  contributors: {},
};

const ANCIENT_RELIC_TOWERS = [
  {
    id: "chrono_siphon",
    name: "Chrono Siphon Tower ⏳",
    zone: "Sector Alpha Orbit",
    defenseHp: 12000,
    maxHp: 12000,
    controllerFedId: "fed_celestial",
    controllerFedTag: "DOM",
    buff: "xp_boost_25",
    buffDescription: "+25% XP Boost aliansi",
  },
  {
    id: "nebula_bastion",
    name: "Nebula Bastion Tower 🛡️",
    zone: "Starlight Outpost Edge",
    defenseHp: 18000,
    maxHp: 18000,
    controllerFedId: "fed_astral",
    controllerFedTag: "ASTRA",
    buff: "vault_dividend_30",
    buffDescription: "+30% Dividen Brankas Kas Klan mingguan",
  },
  {
    id: "void_citadel",
    name: "Void Citadel Tower 🌌",
    zone: "Galactic Core Ridge",
    defenseHp: 25000,
    maxHp: 25000,
    controllerFedId: null,
    controllerFedTag: "UNCLAIMED",
    buff: "drop_rate_20",
    buffDescription: "+20% Drop Rate Relik Kosmik",
  },
];

const memoryRelicTowers = new Map(
  ANCIENT_RELIC_TOWERS.map((t) => [t.id, { ...t }]),
);

class GuildFederationEngine {
  /**
   * Mengambil data federasi berdasarkan ID.
   * @param {string} federationId
   * @returns {Promise<object|null>}
   */
  async getFederation(federationId) {
    if (!federationId) return null;
    try {
      if (redisManager.isReady) {
        const raw = await redisManager.getCache(
          `${FEDERATION_PREFIX}${federationId}`,
        );
        if (raw) return typeof raw === "string" ? JSON.parse(raw) : raw;
      }
    } catch (err) {
      logger.warn(`[GuildFederationEngine] Redis get error: ${err.message}`);
    }
    return memoryFederations.get(federationId) || null;
  }

  /**
   * Menyimpan data federasi secara atomik ke Redis dan memory fallback.
   * @param {object} fed
   */
  async saveFederation(fed) {
    if (!fed || !fed.id) return;
    memoryFederations.set(fed.id, fed);
    try {
      if (redisManager.isReady) {
        await redisManager.setCache(
          `${FEDERATION_PREFIX}${fed.id}`,
          JSON.stringify(fed),
          86400 * 30, // 30 hari
        );
        // Tambahkan ID ke set federasi aktif
        await redisManager.redis
          .sadd(FEDERATION_LIST_KEY, fed.id)
          .catch(() => {});
      }
    } catch (err) {
      logger.warn(`[GuildFederationEngine] Redis save error: ${err.message}`);
    }
  }

  /**
   * Membuat aliansi federasi klan baru.
   * @param {object} params
   * @param {string} params.name - Nama federasi
   * @param {string} params.tag - Singkatan tag klan
   * @param {string} params.leaderClanId - ID klan pendiri
   * @param {string} params.guildId - Guild ID asal pendiri
   * @returns {Promise<{success: boolean, federation?: object, error?: string}>}
   */
  async createFederation({ name, tag, leaderClanId, guildId }) {
    if (!name || !tag || !leaderClanId) {
      return {
        success: false,
        error: "Parameter nama, tag, dan klan tidak lengkap.",
      };
    }

    const cleanTag = tag.toUpperCase().slice(0, 5);
    const fedId = `fed_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    const newFed = {
      id: fedId,
      name: name.trim(),
      tag: cleanTag,
      leaderClanId,
      leaderGuildId: guildId,
      createdAt: new Date().toISOString(),
      level: 1,
      prestige: 100,
      bossVictories: 0,
      totalVaultContribution: 0,
      memberClans: [
        {
          clanId: leaderClanId,
          guildId,
          joinedAt: new Date().toISOString(),
          prestigeContributed: 100,
        },
      ],
    };

    await this.saveFederation(newFed);
    logger.info(
      `[GuildFederationEngine] Federasi baru "${name}" [${cleanTag}] didirikan.`,
    );
    return { success: true, federation: newFed };
  }

  /**
   * Mendaftarkan klan ke dalam federasi yang sudah berdiri.
   * @param {string} federationId
   * @param {string} clanId
   * @param {string} guildId
   * @returns {Promise<{success: boolean, federation?: object, error?: string}>}
   */
  async joinFederation(federationId, clanId, guildId) {
    const fed = await this.getFederation(federationId);
    if (!fed) {
      return { success: false, error: "Federasi aliansi tidak ditemukan." };
    }

    const isMember = fed.memberClans.some((m) => m.clanId === clanId);
    if (isMember) {
      return {
        success: false,
        error: "Klan kamu sudah tergabung dalam aliansi ini.",
      };
    }

    if (fed.memberClans.length >= 10) {
      return {
        success: false,
        error: "Aliansi ini sudah mencapai batas maksimum 10 klan.",
      };
    }

    fed.memberClans.push({
      clanId,
      guildId,
      joinedAt: new Date().toISOString(),
      prestigeContributed: 50,
    });
    fed.prestige += 50;

    await this.saveFederation(fed);
    return { success: true, federation: fed };
  }

  /**
   * Mengambil papan peringkat global aliansi (Global Hall of Fame).
   * @param {number} limit
   * @returns {Promise<Array<object>>}
   */
  async getHallOfFame(limit = 10) {
    const list = [];
    try {
      if (redisManager.isReady) {
        const ids = await redisManager.redis
          .smembers(FEDERATION_LIST_KEY)
          .catch(() => []);
        for (const id of ids) {
          const fed = await this.getFederation(id);
          if (fed) list.push(fed);
        }
      }
    } catch (err) {
      logger.warn(
        `[GuildFederationEngine] Hall of fame fetch error: ${err.message}`,
      );
    }

    // Gabungkan dengan data memory
    for (const fed of memoryFederations.values()) {
      if (!list.some((f) => f.id === fed.id)) {
        list.push(fed);
      }
    }

    // Default mock data jika belum ada federasi yang terdaftar
    if (list.length === 0) {
      list.push(
        {
          id: "fed_celestial",
          name: "Celestial Dominion",
          tag: "DOM",
          level: 5,
          prestige: 1850,
          bossVictories: 14,
          memberClans: [{}, {}, {}],
        },
        {
          id: "fed_astral",
          name: "Astral Vanguard",
          tag: "ASTRA",
          level: 4,
          prestige: 1420,
          bossVictories: 9,
          memberClans: [{}, {}],
        },
      );
    }

    // Urutkan berdasarkan prestise dan kemenangan boss
    list.sort(
      (a, b) =>
        b.prestige + b.bossVictories * 50 - (a.prestige + a.bossVictories * 50),
    );
    return list.slice(0, limit);
  }

  /**
   * Mengambil status Alliance Raid Boss saat ini.
   * @returns {object}
   */
  getAllianceBoss() {
    return { ...memoryAllianceBoss };
  }

  /**
   * Menyerang Alliance Raid Boss secara kolektif bersama anggota aliansi.
   * @param {object} params
   * @param {string} params.federationId
   * @param {string} params.clanId
   * @param {string} params.userId
   * @param {number} [params.damage]
   * @param {object} [params.client]
   * @returns {Promise<object>}
   */
  async attackAllianceBoss({
    federationId,
    clanId,
    userId,
    damage = 150,
    client = null,
  }) {
    const fed = await this.getFederation(federationId);
    const boss = memoryAllianceBoss;

    const actualDamage = Math.min(boss.hp, Math.max(10, damage));
    boss.hp -= actualDamage;

    // Catat kontributor
    if (!boss.contributors[clanId]) {
      boss.contributors[clanId] = { totalDamage: 0, hits: 0 };
    }
    boss.contributors[clanId].totalDamage += actualDamage;
    boss.contributors[clanId].hits += 1;

    let isDefeated = false;
    let rewardVaultPerClan = 0;

    if (boss.hp <= 0) {
      isDefeated = true;
      boss.hp = boss.maxHp * 1.2; // Fase berikutnya
      boss.maxHp = boss.hp;
      boss.phase += 1;

      rewardVaultPerClan = 5000 * boss.phase;

      if (fed) {
        fed.bossVictories = (fed.bossVictories || 0) + 1;
        fed.prestige = (fed.prestige || 0) + 250;
        await this.saveFederation(fed);

        // Tambahkan hadiah brankas klan ke seluruh klan anggota secara atomik
        for (const member of fed.memberClans) {
          const clanRow = await GuildClan.findByPk(member.clanId).catch(
            () => null,
          );
          if (clanRow) {
            clanRow.vault = (clanRow.vault || 0) + rewardVaultPerClan;
            await clanRow.save({ fields: ["vault"] }).catch(() => {});
          }
        }

        // Siarkan intermezzo kemenangan via AI DJ Fish Audio TTS
        try {
          const fishAudioService = require("../../services/fishAudioService");
          fishAudioService
            .broadcastVictoryAnnouncement({
              client: client || null,
              federationName: fed ? fed.name : "Aliansi Petualang",
              bossName: "Celestial Chrono-Wyrm",
              phase: boss.phase - 1,
            })
            .catch(() => {});
        } catch (_) {}
      }

      // Reset kontributor untuk fase berikutnya
      boss.contributors = {};
    }

    return {
      damage: actualDamage,
      remainingHp: boss.hp,
      maxHp: boss.maxHp,
      phase: boss.phase,
      isDefeated,
      rewardVaultPerClan,
    };
  }

  /**
   * Mengambil daftar Menara Relik Kuno (Ancient Relic Towers) dan status kontrolnya
   * @returns {Array<object>}
   */
  getRelicTowers() {
    return Array.from(memoryRelicTowers.values()).map((t) => ({
      ...t,
      controlPercent: Math.round(((t.maxHp - t.defenseHp) / t.maxHp) * 100),
    }));
  }

  /**
   * Pengepungan Menara Relik Kuno oleh Aliansi Federasi
   * @param {object} params
   * @param {string} params.federationId
   * @param {string} params.clanId
   * @param {string} params.towerId
   * @param {number} [params.siegePower=250]
   * @returns {Promise<object>}
   */
  async siegeRelicTower({ federationId, clanId, towerId, siegePower = 250 }) {
    const tower = memoryRelicTowers.get(towerId);
    if (!tower) {
      return { success: false, error: "Menara Relik tidak ditemukan." };
    }

    const fed = await this.getFederation(federationId);
    if (!fed) {
      return { success: false, error: "Federasi aliansi tidak valid." };
    }

    // Jika aliansi sendiri yang sudah mengontrol
    if (tower.controllerFedId === federationId) {
      tower.defenseHp = Math.min(tower.maxHp, tower.defenseHp + siegePower);
      return {
        success: true,
        action: "REINFORCE",
        towerId,
        towerName: tower.name,
        remainingHp: tower.defenseHp,
        maxHp: tower.maxHp,
        controllerFedId: tower.controllerFedId,
      };
    }

    // Serangan pengepungan
    const damage = Math.min(tower.defenseHp, Math.max(50, siegePower));
    tower.defenseHp -= damage;

    let conquered = false;
    if (tower.defenseHp <= 0) {
      conquered = true;
      tower.controllerFedId = federationId;
      tower.controllerFedTag = fed.tag;
      tower.defenseHp = tower.maxHp;

      fed.prestige = (fed.prestige || 0) + 300;
      await this.saveFederation(fed);
      logger.info(
        `⚔️ [FederationWar] Aliansi "${fed.name}" berhasil menaklukkan ${tower.name}!`,
      );
    }

    return {
      success: true,
      action: "SIEGE",
      towerId,
      towerName: tower.name,
      damage,
      remainingHp: tower.defenseHp,
      maxHp: tower.maxHp,
      conquered,
      controllerFedId: tower.controllerFedId,
      controllerFedTag: tower.controllerFedTag,
    };
  }

  /**
   * Klaim dividen wilayah dan buff Menara Relik untuk federasi pengontrol
   * @param {object} params
   * @param {string} params.federationId
   * @param {string} params.towerId
   * @returns {Promise<object>}
   */
  async claimTowerDividends({ federationId, towerId }) {
    const tower = memoryRelicTowers.get(towerId);
    if (!tower) {
      return { success: false, error: "Menara Relik tidak ditemukan." };
    }

    if (tower.controllerFedId !== federationId) {
      return {
        success: false,
        error: "Aliansi kamu tidak menguasai Menara Relik ini.",
      };
    }

    const fed = await this.getFederation(federationId);
    if (!fed) {
      return { success: false, error: "Federasi tidak valid." };
    }

    const dividendPerClan = 3500;
    for (const member of fed.memberClans || []) {
      const clanRow = await GuildClan.findByPk(member.clanId).catch(() => null);
      if (clanRow) {
        clanRow.vault = (clanRow.vault || 0) + dividendPerClan;
        await clanRow.save({ fields: ["vault"] }).catch(() => {});
      }
    }

    return {
      success: true,
      towerName: tower.name,
      buff: tower.buff,
      buffDescription: tower.buffDescription,
      dividendPerClan,
    };
  }
}

module.exports = new GuildFederationEngine();
