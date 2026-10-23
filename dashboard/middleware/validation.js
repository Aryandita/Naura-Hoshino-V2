"use strict";

const { z } = require("zod");

const snowflakePattern = /^\d{17,20}$/;
const SnowflakeSchema = z.string().regex(snowflakePattern, "Invalid Discord ID format");

const PositiveIntSchema = z.number().int().positive();
const AmountSchema = z.number().int().min(1).max(1_000_000_000);

const DepositRequestSchema = z.object({
  amount: AmountSchema,
});

const WithdrawRequestSchema = z.object({
  amount: AmountSchema,
});

const TransferRequestSchema = z.object({
  amount: AmountSchema,
  target: z.string().min(1).max(100),
});

const MusicControlSchema = z.object({
  action: z.enum(["play", "pause", "skip", "stop", "volume", "seek"]),
  guildId: SnowflakeSchema.optional(),
  value: z.union([z.number(), z.string()]).optional(),
});

const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

const LeaderboardQuerySchema = PaginationSchema.extend({
  type: z.enum(["economy", "leveling", "survival"]).default("economy"),
});

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? req.query);
    if (!result.success) {
      return res.status(400).json({
        type: "https://api.naurahoshino.com/errors/validation",
        title: "Validation Error",
        status: 400,
        detail: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        issues: result.error.issues,
      });
    }
    req.validated = result.data;
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        type: "https://api.naurahoshino.com/errors/validation",
        title: "Validation Error",
        status: 400,
        detail: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        issues: result.error.issues,
      });
    }
    req.validatedQuery = result.data;
    next();
  };
}

class ApiError extends Error {
  constructor(status, title, detail, type) {
    super(detail);
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.type = type || `https://api.naurahoshino.com/errors/${status}`;
  }

  toJSON() {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.detail,
    };
  }
}

function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json(err.toJSON());
  }

  if (err.name === "ZodError") {
    return res.status(400).json({
      type: "https://api.naurahoshino.com/errors/validation",
      title: "Validation Error",
      status: 400,
      detail: err.issues?.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") || "Invalid input",
      issues: err.issues,
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const isDev = process.env.NODE_ENV !== "production";

  res.status(statusCode).json({
    type: `https://api.naurahoshino.com/errors/${statusCode}`,
    title: statusCode === 500 ? "Internal Server Error" : "Error",
    status: statusCode,
    detail: isDev ? err.message : "An unexpected error occurred",
    ...(isDev && { stack: err.stack }),
  });
}

module.exports = {
  schemas: {
    Snowflake: SnowflakeSchema,
    PositiveInt: PositiveIntSchema,
    Amount: AmountSchema,
    DepositRequest: DepositRequestSchema,
    WithdrawRequest: WithdrawRequestSchema,
    TransferRequest: TransferRequestSchema,
    MusicControl: MusicControlSchema,
    Pagination: PaginationSchema,
    LeaderboardQuery: LeaderboardQuerySchema,
  },
  validate,
  validateQuery,
  ApiError,
  errorHandler,
};
