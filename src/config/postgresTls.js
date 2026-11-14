"use strict";

const fs = require("node:fs");
const path = require("node:path");

const FORBIDDEN_PG_OVERRIDE_PARAMS = new Set([
  "host",
  "hostaddr",
  "port",
  "user",
  "password",
  "passfile",
  "database",
  "dbname",
  "db",
  "service",
  "options",
]);

const INSECURE_PGSSLMODES = new Set(["disable", "allow", "prefer", "no-verify"]);

function isSupabasePostgresHost(target) {
  if (!target || typeof target !== "string") return false;
  const trimmed = target.trim();
  if (!trimmed) return false;

  let hostname = "";
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)) {
    try {
      hostname = new URL(trimmed).hostname.toLowerCase();
    } catch {
      return false;
    }
  } else {
    hostname = trimmed.split("/")[0].split(":")[0].toLowerCase();
  }

  if (!hostname) return false;
  return (
    hostname === "supabase.co" ||
    hostname.endsWith(".supabase.co") ||
    hostname === "supabase.com" ||
    hostname.endsWith(".supabase.com")
  );
}

// URL TLS and connection target parameters override Sequelize dialectOptions in pg-connection-string.
function validatePostgresUrl(connectionString, dialect = "postgres") {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("Invalid PostgreSQL connection URL");
  }
  const actualDialect = url.protocol.replace(/:$/, "").toLowerCase();
  const normalizedDialect =
    actualDialect === "postgresql" ? "postgres" : actualDialect;
  if (normalizedDialect !== dialect) {
    throw new Error("Database URL protocol does not match DB_DIALECT");
  }
  if (normalizedDialect !== "postgres") {
    return {
      hostname: url.hostname || "",
      port: url.port ? Number(url.port) : null,
    };
  }
  if (!url.hostname || !url.hostname.trim()) {
    throw new Error("PostgreSQL connection URL must include a hostname");
  }
  for (const key of url.searchParams.keys()) {
    const normalized = key.toLowerCase();
    if (normalized.startsWith("ssl") || normalized === "uselibpqcompat") {
      throw new Error(
        "PostgreSQL URL must not contain SSL parameters; use DB_SSL and DB_SSL_CA_PATH instead",
      );
    }
    if (FORBIDDEN_PG_OVERRIDE_PARAMS.has(normalized)) {
      throw new Error(
        "PostgreSQL URL must not override connection target or credentials via query parameters",
      );
    }
  }
  return {
    hostname: url.hostname,
    port: url.port ? Number(url.port) : 5432,
  };
}

function postgresSslOptions(enabled, caPath, runtimeEnv = process.env) {
  const trimmedCaPath = typeof caPath === "string" ? caPath.trim() : "";

  // Explicit false avoids inheriting PGSSLMODE for deliberately local plaintext.
  if (!enabled) {
    if (trimmedCaPath) {
      throw new Error("DB_SSL_CA_PATH cannot be set when DB_SSL is disabled");
    }
    return false;
  }

  if (
    runtimeEnv &&
    String(runtimeEnv.NODE_TLS_REJECT_UNAUTHORIZED || "").trim() === "0"
  ) {
    throw new Error(
      "NODE_TLS_REJECT_UNAUTHORIZED=0 is forbidden when PostgreSQL TLS is enabled",
    );
  }

  const pgSslMode =
    runtimeEnv && typeof runtimeEnv.PGSSLMODE === "string"
      ? runtimeEnv.PGSSLMODE.trim().toLowerCase()
      : "";
  if (pgSslMode && INSECURE_PGSSLMODES.has(pgSslMode)) {
    throw new Error(
      "Insecure PGSSLMODE environment setting is forbidden when PostgreSQL TLS is enabled",
    );
  }

  const ssl = { require: true, rejectUnauthorized: true };
  if (trimmedCaPath) {
    const resolvedCaPath = path.resolve(trimmedCaPath);
    try {
      ssl.ca = fs.readFileSync(resolvedCaPath, "utf8");
    } catch {
      throw new Error(
        "Cannot read PostgreSQL CA file configured by DB_SSL_CA_PATH",
      );
    }
    if (!ssl.ca.trim()) throw new Error("PostgreSQL CA file is empty");
    if (
      !ssl.ca.includes("-----BEGIN CERTIFICATE-----") ||
      !ssl.ca.includes("-----END CERTIFICATE-----")
    ) {
      throw new Error("DB_SSL_CA_PATH must contain a valid PEM certificate");
    }
  }
  return ssl;
}

module.exports = {
  validatePostgresUrl,
  postgresSslOptions,
  isSupabasePostgresHost,
};
