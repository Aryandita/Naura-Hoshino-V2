"use strict";

const arcadeContract = require("../../domain/contracts/arcadeContract");
const { logger } = require("../../managers/logger");

const GAME_CONFIG = {
  tictactoe: { fee: 5, win: 25, draw: 5, loss: 0 },
  rps: { fee: 5, win: 25, draw: 5, loss: 0 },
  blackjack: { fee: 5, win: 25, draw: 5, loss: 0 },
  typerace: { fee: 5, win: 25, draw: 5, loss: 0 },
  trivia: { fee: 5, win: 25, draw: 5, loss: 0 },
  guess: { fee: 5, win: 25, draw: 5, loss: 0 },
  higherlower: { fee: 5, win: 25, draw: 5, loss: 0 },
  coinflip: { fee: 5, win: 25, draw: 5, loss: 0 },
  dice: { fee: 5, win: 25, draw: 5, loss: 0 },
};

class ArcadeEngine {
  /**
   * Validasi dan potong biaya bermain (5 MP)
   * @param {string} userId
   * @param {string} gameType
   * @returns {Promise<{ ok: boolean, balance: number, reason?: string }>}
   */
  static async preGame(userId, gameType) {
    const config = GAME_CONFIG[gameType] || GAME_CONFIG.tictactoe;

    // Cek saldo dulu
    const balance = await arcadeContract.getBalance(userId);
    if (balance < config.fee) {
      return { ok: false, balance, reason: "INSUFFICIENT_MP", need: config.fee };
    }

    // Potong fee
    const result = await arcadeContract.chargeGameFee(userId);
    if (!result.ok) {
      return { ok: false, balance: result.balance, reason: result.reason };
    }

    return { ok: true, balance: result.balance, fee: config.fee };
  }

  /**
   * Proses hasil game dan berikan reward
   * @param {string} userId
   * @param {string} gameType
   * @param {"win"|"draw"|"loss"} result
   * @returns {Promise<{ ok: boolean, balance: number, reward: number, result: string }>}
   */
  static async postGame(userId, gameType, result) {
    const config = GAME_CONFIG[gameType] || GAME_CONFIG.tictactoe;
    let reward = 0;

    switch (result) {
      case "win":
        reward = config.win;
        await arcadeContract.rewardWin(userId);
        break;
      case "draw":
        reward = config.draw;
        await arcadeContract.rewardDraw(userId);
        break;
      case "loss":
        reward = config.loss;
        await arcadeContract.rewardLoss(userId);
        break;
      default:
        return { ok: false, balance: 0, reward: 0, reason: "INVALID_RESULT" };
    }

    const balance = await arcadeContract.getBalance(userId);
    logger.info(`[ArcadeEngine] User ${userId} ${result} di ${gameType}: fee ${config.fee}, reward ${reward}, balance ${balance}`);

    return { ok: true, balance, reward, result };
  }

  /**
   * Mendapatkan konfigurasi game
   * @param {string} gameType
   * @returns {object}
   */
  static getConfig(gameType) {
    return GAME_CONFIG[gameType] || GAME_CONFIG.tictactoe;
  }

  /**
   * Mendapatkan daftar game yang tersedia
   * @returns {string[]}
   */
  static getAvailableGames() {
    return Object.keys(GAME_CONFIG);
  }
}

module.exports = ArcadeEngine;