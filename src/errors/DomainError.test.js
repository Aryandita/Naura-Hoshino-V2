// Lokasi: src/errors/DomainError.test.js
// Unit test untuk DomainError dan DomainStates (Law 4 & Law 6)

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  DomainError,
  InsufficientFundsError,
  RateLimitError,
  PermissionDeniedError,
  StateTransitionError,
  EntityNotFoundError,
  ValidationError,
  isDomainError,
} = require("./DomainError");

const {
  TicketStatus,
  ALLOWED_TICKET_TRANSITIONS,
  TradeStatus,
  ALLOWED_TRADE_TRANSITIONS,
  canTransitionState,
  assertValidStateTransition,
} = require("../domain/DomainStates");

describe("Law 6: DomainError Structure and Behavior", () => {
  it("harus membuat base DomainError dengan kode, userMessage, dan konteks", () => {
    const error = new DomainError("SAMPLE_CODE", "Pesan sampel", {
      detail: 123,
    });
    assert.strictEqual(error.code, "SAMPLE_CODE");
    assert.strictEqual(error.userMessage, "Pesan sampel");
    assert.strictEqual(error.context.detail, 123);
    assert.strictEqual(error.isOperational, true);
    assert.strictEqual(isDomainError(error), true);

    const json = error.toJSON();
    assert.strictEqual(json.code, "SAMPLE_CODE");
    assert.strictEqual(json.userMessage, "Pesan sampel");
  });

  it("InsufficientFundsError harus memiliki kode INSUFFICIENT_FUNDS", () => {
    const error = new InsufficientFundsError("Saldo kurang!", {
      balance: 50,
      required: 100,
    });
    assert.strictEqual(error.code, "INSUFFICIENT_FUNDS");
    assert.strictEqual(error.userMessage, "Saldo kurang!");
    assert.strictEqual(error.context.balance, 50);
    assert.strictEqual(error.context.required, 100);
    assert.strictEqual(isDomainError(error), true);
  });

  it("RateLimitError harus memiliki kode RATE_LIMITED", () => {
    const error = new RateLimitError("Tunggu sebentar.", { retryAfter: 3000 });
    assert.strictEqual(error.code, "RATE_LIMITED");
    assert.strictEqual(error.context.retryAfter, 3000);
    assert.strictEqual(isDomainError(error), true);
  });

  it("PermissionDeniedError harus memiliki kode PERMISSION_DENIED", () => {
    const error = new PermissionDeniedError();
    assert.strictEqual(error.code, "PERMISSION_DENIED");
    assert.strictEqual(isDomainError(error), true);
  });

  it("EntityNotFoundError dan ValidationError harus memiliki kode yang sesuai", () => {
    const notFound = new EntityNotFoundError("User tidak ada.");
    const validation = new ValidationError("Input invalid.");
    assert.strictEqual(notFound.code, "ENTITY_NOT_FOUND");
    assert.strictEqual(validation.code, "VALIDATION_ERROR");
  });

  it("isDomainError mengembalikan false untuk error biasa", () => {
    const standardError = new Error("Generic error");
    assert.strictEqual(isDomainError(standardError), false);
    assert.strictEqual(isDomainError(null), false);
    assert.strictEqual(isDomainError("str"), false);
  });
});

describe("Law 4: DomainStates and State Machine Validation", () => {
  it("TicketStatus harus bersifat beku (immutable)", () => {
    assert.strictEqual(TicketStatus.OPEN, "OPEN");
    assert.throws(() => {
      TicketStatus.NEW_STATUS = "NEW";
    });
  });

  it("canTransitionState memvalidasi transisi tiket dengan benar", () => {
    // OPEN -> CLAIMED sah
    assert.strictEqual(
      canTransitionState(
        ALLOWED_TICKET_TRANSITIONS,
        TicketStatus.OPEN,
        TicketStatus.CLAIMED,
      ),
      true,
    );
    // OPEN -> CLOSED sah
    assert.strictEqual(
      canTransitionState(
        ALLOWED_TICKET_TRANSITIONS,
        TicketStatus.OPEN,
        TicketStatus.CLOSED,
      ),
      true,
    );
    // CLOSED -> CLAIMED ilegal (sudah tutup)
    assert.strictEqual(
      canTransitionState(
        ALLOWED_TICKET_TRANSITIONS,
        TicketStatus.CLOSED,
        TicketStatus.CLAIMED,
      ),
      false,
    );
    // Status sama sah (no-op)
    assert.strictEqual(
      canTransitionState(
        ALLOWED_TICKET_TRANSITIONS,
        TicketStatus.OPEN,
        TicketStatus.OPEN,
      ),
      true,
    );
  });

  it("assertValidStateTransition melempar StateTransitionError saat transisi ilegal", () => {
    assert.doesNotThrow(() => {
      assertValidStateTransition(
        ALLOWED_TRADE_TRANSITIONS,
        TradeStatus.PENDING,
        TradeStatus.ACCEPTED,
      );
    });

    assert.throws(
      () => {
        assertValidStateTransition(
          ALLOWED_TRADE_TRANSITIONS,
          TradeStatus.COMPLETED,
          TradeStatus.PENDING,
          { tradeId: "TR-123" },
        );
      },
      (err) => {
        return (
          err instanceof StateTransitionError &&
          err.code === "INVALID_STATE_TRANSITION" &&
          err.context.tradeId === "TR-123"
        );
      },
    );
  });
});
