"use strict";

const ServerTreasury = require("../../models/ServerTreasury");
const UserSurvival = require("../../models/UserSurvival");
const ClanTerritory = require("../../models/ClanTerritory");
const cacheManager = require("../../managers/cacheManager");
const { logger } = require("../../managers/logger");

const TICKET_COST_DIVISOR = 250; // 1 Tiket tiap 250 NSF yang dibayarkan
const NOVICE_MAX_LEVEL = 10;
const NOVICE_AID_AMOUNT = 250;

class RecyclingPoolEngine {
  /**
   * Ambil atau inisialisasi singleton data ServerTreasury
   * @returns {Promise<ServerTreasury>}
   */
  static async getTreasury() {
    let treasury = await ServerTreasury.findOne({ where: { id: 1 } });
    if (!treasury) {
      treasury = await ServerTreasury.create({
        id: 1,
        lotteryJackpot: 0,
        noviceAidPool: 0,
        wanderingMerchantPool: 0,
      });
    }
    return treasury;
  }

  /**
   * Mengalokasikan dana penarikan (sinks) ke 4 saluran daur ulang secara atomik
   * 40% Infrastruktur, 25% Undian Astral, 20% Subsidi Pemula, 15% Pedagang Keliling
   * @param {number} amount - Total nominal NSF yang ditarik
   * @returns {Promise<object>}
   */
  static async allocateSinkFunds(amount) {
    const total = Math.max(0, Math.floor(Number(amount) || 0));
    if (total === 0) return { ok: true, allocated: 0 };

    const infrastructure = Math.floor(total * 0.4);
    const lottery = Math.floor(total * 0.25);
    const noviceAid = Math.floor(total * 0.2);
    const wanderingMerchant = total - (infrastructure + lottery + noviceAid); // 15% + sisa pembulatan

    try {
      const treasury = await this.getTreasury();
      treasury.lotteryJackpot = Number(treasury.lotteryJackpot || 0) + lottery;
      treasury.noviceAidPool = Number(treasury.noviceAidPool || 0) + noviceAid;
      treasury.wanderingMerchantPool =
        Number(treasury.wanderingMerchantPool || 0) + wanderingMerchant;
      await treasury.save({
        fields: [
          "lotteryJackpot",
          "noviceAidPool",
          "wanderingMerchantPool",
          "updatedAt",
        ],
      });

      // Distribusikan poin infrastruktur ke sektor wilayah teritorial
      const territories = await ClanTerritory.findAll();
      if (territories.length > 0) {
        const perTerritory = Math.max(
          1,
          Math.floor(infrastructure / territories.length),
        );
        for (const territory of territories) {
          territory.infrastructurePoints =
            Number(territory.infrastructurePoints || 0) + perTerritory;
          await territory.save({ fields: ["infrastructurePoints"] });
        }
      }

      logger.info(
        `[RecyclingPool] Alokasi ${total} NSF: Infra +${infrastructure}, Undian +${lottery}, Subsidi +${noviceAid}, Pedagang +${wanderingMerchant}`,
      );

      return {
        ok: true,
        allocated: total,
        infrastructure,
        lottery,
        noviceAid,
        wanderingMerchant,
      };
    } catch (err) {
      logger.error(`[RecyclingPool] Gagal mengalokasikan sink funds: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }

  /**
   * Memberikan tiket undian astral ke pemain berdasarkan nominal biaya/pajak yang dibayarkan
   * @param {string} userId
   * @param {number} amountSpent
   * @returns {Promise<number>} Jumlah tiket tambahan yang didapat
   */
  static async awardLotteryTickets(userId, amountSpent) {
    if (!userId || amountSpent < TICKET_COST_DIVISOR) return 0;
    const tickets = Math.floor(amountSpent / TICKET_COST_DIVISOR);
    if (tickets <= 0) return 0;

    try {
      const survival = await UserSurvival.findOne({ where: { userId } });
      if (survival) {
        survival.lotteryTickets = Number(survival.lotteryTickets || 0) + tickets;
        await survival.save({ fields: ["lotteryTickets"] });
        return tickets;
      }
    } catch (err) {
      logger.error(`[RecyclingPool] Gagal menambah tiket undian: ${err.message}`);
    }
    return 0;
  }

  /**
   * Mengklaim subsidi perbekalan harian petualang pemula (Level 1 s.d. 10)
   * @param {string} userId
   * @returns {Promise<object>}
   */
  static async claimNoviceAid(userId) {
    if (!userId) return { ok: false, reason: "INVALID_USER" };

    const survival = await UserSurvival.findOne({ where: { userId } });
    if (!survival) return { ok: false, reason: "NOT_FOUND" };

    const level = Number(survival.survival_level || 1);
    if (level > NOVICE_MAX_LEVEL) {
      return { ok: false, reason: "LEVEL_EXCEEDED", currentLevel: level, maxLevel: NOVICE_MAX_LEVEL };
    }

    const now = new Date();
    if (survival.lastNoviceAidClaimAt) {
      const last = new Date(survival.lastNoviceAidClaimAt);
      const isSameDay =
        last.getUTCFullYear() === now.getUTCFullYear() &&
        last.getUTCMonth() === now.getUTCMonth() &&
        last.getUTCDate() === now.getUTCDate();
      if (isSameDay) {
        return { ok: false, reason: "ALREADY_CLAIMED" };
      }
    }

    const treasury = await this.getTreasury();
    let grantAmount = NOVICE_AID_AMOUNT;
    if (Number(treasury.noviceAidPool) >= grantAmount) {
      treasury.noviceAidPool = Number(treasury.noviceAidPool) - grantAmount;
      await treasury.save({ fields: ["noviceAidPool", "updatedAt"] });
    } else {
      grantAmount = Math.max(100, Number(treasury.noviceAidPool || 0));
      treasury.noviceAidPool = 0;
      await treasury.save({ fields: ["noviceAidPool", "updatedAt"] });
    }

    await cacheManager.incrementUserSurvival(userId, { starFragments: grantAmount });
    survival.lastNoviceAidClaimAt = now;
    await survival.save({ fields: ["lastNoviceAidClaimAt"] });

    logger.info(`[RecyclingPool] Pemain ${userId} mengklaim subsidi pemula sebesar ${grantAmount} NSF`);

    return {
      ok: true,
      amount: grantAmount,
      nextLevelTarget: NOVICE_MAX_LEVEL + 1,
    };
  }

  /**
   * Menjalankan undian mingguan Astral Lottery secara acak
   * @returns {Promise<object>}
   */
  static async runWeeklyLottery() {
    try {
      const treasury = await this.getTreasury();
      const currentJackpot = Number(treasury.lotteryJackpot || 0);

      // Cari seluruh pemegang tiket aktif
      const participants = await UserSurvival.findAll({
        where: {
          lotteryTickets: { [require("sequelize").Op.gt]: 0 },
        },
      });

      if (participants.length === 0 || currentJackpot <= 0) {
        logger.info("[RecyclingPool] Tidak ada peserta undian atau jackpot kosong minggu ini.");
        return { ok: false, reason: "NO_PARTICIPANTS_OR_EMPTY_JACKPOT" };
      }

      // Bangun tiket pool
      const rafflePool = [];
      for (const p of participants) {
        const count = Math.min(100, Number(p.lotteryTickets || 1));
        for (let i = 0; i < count; i++) {
          rafflePool.push(p.userId);
        }
      }

      // Kocok undian
      const winnerIndex = Math.floor(Math.random() * rafflePool.length);
      const winnerUserId = rafflePool[winnerIndex];

      const prizeAmount = Math.floor(currentJackpot * 0.8); // 80% jackpot untuk pemenang, 20% sisa jadi bibit jackpot berikutnya
      await cacheManager.incrementUserSurvival(winnerUserId, { starFragments: prizeAmount });

      treasury.lotteryJackpot = currentJackpot - prizeAmount;
      treasury.lastLotteryDrawAt = new Date();
      await treasury.save({ fields: ["lotteryJackpot", "lastLotteryDrawAt", "updatedAt"] });

      const winnerParticipant = participants.find((p) => p.userId === winnerUserId);
      const ticketsHeld = winnerParticipant ? Number(winnerParticipant.lotteryTickets || 1) : 1;

      // Catat ke ledger riwayat pemenang (Migration v42)
      try {
        const LotteryWinner = require("../../models/LotteryWinner");
        await LotteryWinner.create({
          winnerUserId,
          prizeAmount,
          ticketsHeld,
          drawnAt: treasury.lastLotteryDrawAt,
        });
      } catch (logErr) {
        logger.warn(`[RecyclingPool] Gagal mencatat LotteryWinner: ${logErr.message}`);
      }

      // Reset seluruh tiket undian partisipan dan bersihkan cache
      for (const p of participants) {
        p.lotteryTickets = 0;
        await p.save({ fields: ["lotteryTickets"] });
        await cacheManager.del(`user_survival:${p.userId}`);
      }

      logger.info(
        `[RecyclingPool] Pemenang Astral Lottery minggu ini: ${winnerUserId} memenangkan ${prizeAmount} NSF!`,
      );

      return {
        ok: true,
        winnerUserId,
        prizeAmount,
        totalParticipants: participants.length,
        totalTickets: rafflePool.length,
      };
    } catch (err) {
      logger.error(`[RecyclingPool] Gagal mengeksekusi Astral Lottery: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }

  /**
   * Ringkasan telemetri kas treasury daur ulang
   * @returns {Promise<object>}
   */
  static async getOverview() {
    const treasury = await this.getTreasury();
    const activeTickets = await UserSurvival.sum("lotteryTickets") || 0;

    return {
      lotteryJackpot: Number(treasury.lotteryJackpot || 0),
      noviceAidPool: Number(treasury.noviceAidPool || 0),
      wanderingMerchantPool: Number(treasury.wanderingMerchantPool || 0),
      activeTickets: Number(activeTickets),
      lastLotteryDrawAt: treasury.lastLotteryDrawAt,
    };
  }
}

module.exports = RecyclingPoolEngine;
