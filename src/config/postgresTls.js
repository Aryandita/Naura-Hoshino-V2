"use strict";

const fs = require("node:fs");

// URL TLS settings override Sequelize dialectOptions in pg-connection-string.
function validatePostgresUrl(connectionString, dialect = "postgres") {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("Invalid PostgreSQL connection URL");
  }
  const actualDialect = url.protocol.replace(/:$/, "").toLowerCase();
  const normalizedDialect = actualDialect === "postgresql" ? "postgres" : actualDialect;
  if (normalizedDialect !== dialect) throw new Error("Database URL protocol does not match DB_DIALECT");
  if (normalizedDialect !== "postgres") return;
  for (const key of url.searchParams.keys()) {
    const normalized = key.toLowerCase();
    if (normalized.startsWith("ssl") || normalized === "uselibpqcompat") {
      throw new Error("PostgreSQL URL must not contain SSL parameters; use DB_SSL and DB_SSL_CA_PATH instead");
    }
  }
}

function postgresSslOptions(enabled, caPath) {
  // Explicit false avoids inheriting PGSSLMODE for deliberately local plaintext.
  if (!enabled) return false;
  const ssl = { require: true, rejectUnauthorized: true };
  if (caPath) {
    try {
      ssl.ca = fs.readFileSync(caPath, "utf8");
    } catch {
      throw new Error("Cannot read PostgreSQL CA file configured by DB_SSL_CA_PATH");
    }
    if (!ssl.ca.trim()) throw new Error("PostgreSQL CA file is empty");
  }
  return ssl;
}

module.exports = { validatePostgresUrl, postgresSslOptions };

