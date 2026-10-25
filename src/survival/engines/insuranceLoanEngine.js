"use strict";

const { logger } = require("../../managers/logger");
const redisManager = require("../../managers/redisManager");

const MAX_LOAN_AMOUNT = 50000;
const INTEREST_RATE = 0.05;
const LOAN_DURATION_MS = 604800000;

class InsuranceAndLoanEngine {
  static async purchaseInsurance(userId, itemId, premium) {
    try {
      const policyId = `ins_${Date.now()}_${Math.random().toString(36).substring(2, 4)}`;
      const policy = {
        id: policyId,
        userId,
        itemId,
        premium,
        purchasedAt: Date.now(),
        expiresAt: Date.now() + 2592000000,
        status: "active",
      };

      const key = `insurance:${userId}`;
      await redisManager.lpush(key, JSON.stringify(policy));
      logger.info(`[Insurance] ${userId} insured item ${itemId}`);
      return { ok: true, policyId };
    } catch (error) {
      logger.error(`[Insurance] Purchase error:`, error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async claimInsurance(userId, policyId) {
    try {
      const key = `insurance:${userId}`;
      const rawList = await redisManager.lrange(key, 0, -1);
      let found = null;

      for (const raw of rawList) {
        const policy = JSON.parse(raw);
        if (policy.id === policyId && policy.status === "active") {
          found = policy;
          break;
        }
      }

      if (!found) return { ok: false, reason: "POLICY_NOT_FOUND" };
      if (found.expiresAt < Date.now()) return { ok: false, reason: "POLICY_EXPIRED" };

      return { ok: true, itemId: found.itemId, refundAmount: Math.floor(found.premium * 2) };
    } catch (error) {
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async requestLoan(borrowerId, lenderId, amount, collateral) {
    try {
      if (amount > MAX_LOAN_AMOUNT) return { ok: false, reason: "AMOUNT_EXCEEDS_LIMIT" };
      if (borrowerId === lenderId) return { ok: false, reason: "SELF_LOAN" };

      const loanId = `loan_${Date.now()}`;
      const interest = Math.floor(amount * INTEREST_RATE);
      const totalRepayment = amount + interest;

      const loan = {
        id: loanId,
        borrowerId,
        lenderId,
        amount,
        interest,
        totalRepayment,
        collateral,
        createdAt: Date.now(),
        dueAt: Date.now() + LOAN_DURATION_MS,
        status: "pending",
      };

      await redisManager.set(`loan:${loanId}`, JSON.stringify(loan), "EX", Math.ceil(LOAN_DURATION_MS / 1000));
      logger.info(`[Loan] ${borrowerId} requested ${amount} from ${lenderId}`);
      return { ok: true, loanId, totalRepayment };
    } catch (error) {
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async repayLoan(loanId, payerId) {
    try {
      const raw = await redisManager.get(`loan:${loanId}`);
      if (!raw) return { ok: false, reason: "LOAN_NOT_FOUND" };

      const loan = JSON.parse(raw);
      if (loan.borrowerId !== payerId) return { ok: false, reason: "NOT_BORROWER" };
      if (loan.status !== "active") return { ok: false, reason: "LOAN_NOT_ACTIVE" };

      loan.status = "repaid";
      await redisManager.set(`loan:${loanId}`, JSON.stringify(loan), "EX", 86400);

      logger.info(`[Loan] ${payerId} repaid loan ${loanId}`);
      return { ok: true, amount: loan.totalRepayment };
    } catch (error) {
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }
}

module.exports = { InsuranceAndLoanEngine, MAX_LOAN_AMOUNT, INTEREST_RATE };
