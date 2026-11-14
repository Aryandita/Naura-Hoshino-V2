"use strict";

const env = require("./env");
const { validatePostgresUrl } = require("./postgresTls");

const PRODUCTION_SUPABASE_PROJECT_ID = "ceqkjzvrxyifxzgxtkig";
const DEFAULT_STAGING_SUPABASE_PROJECT_ID = "pzwuextkmfqphxzckvfz";

const STAGING_REQUIRED_TABLES = Object.freeze([
  "cache_write_journal",
  "business_operations",
  "economy_transfer_taxes",
  "economy_event_outbox",
  "slice_of_life_progress_v1",
]);

const STAGING_MIGRATION_IDS = Object.freeze([
  "v51_create_cache_write_journal",
  "v52_create_business_operations",
  "v53_create_economy_transfer_taxes",
  "v54_create_economy_event_outbox",
  "v55_create_slice_of_life_progress_v1",
]);

const ALLOWED_STORY_COMPONENT_PREFIXES = Object.freeze([
  "sol_",
  "vn_choice_",
  "survival_story_",
]);

const SUPABASE_POOLER_USER_REGEX = /\bpostgres\.([a-z0-9]{15,30})\b/gi;
const SUPABASE_ANY_USER_REF_REGEX = /\b[a-z0-9_]+\.([a-z0-9]{15,30})\b/i;
const SUPABASE_URL_HOST_REGEX = /\b(?:db\.)?([a-z0-9]{15,30})\.supabase\.co\b/gi;
const SUPABASE_POOLER_HOST_REGEX = /^[a-z0-9-]+\.pooler\.supabase\.com$/i;
const PROJECT_REF_ONLY_REGEX = /^[a-z0-9]{15,30}$/i;

function toBoolean(value) {
  return value === true || String(value || "").trim().toLowerCase() === "true";
}

function isExplicitFalse(value) {
  if (value === false) return true;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "false" || normalized === "0";
}

function cleanConfigString(val) {
  if (val === undefined || val === null) return "";
  const cleaned = String(val).replace(/^["']|["']$/g, "").trim();
  if (
    cleaned.startsWith("YOUR_") ||
    cleaned.endsWith("_HERE") ||
    cleaned === "YOUR_DISCORD_BOT_TOKEN_HERE" ||
    cleaned === "YOUR_CLIENT_ID_HERE"
  ) {
    return "";
  }
  return cleaned;
}

function normalizeHost(hostname) {
  return String(hostname || "")
    .trim()
    .replace(/^\[|\]$/g, "")
    .toLowerCase();
}

function isPrologueStagingMode(runtimeEnv = env) {
  if (!runtimeEnv || typeof runtimeEnv !== "object") return false;
  return (
    toBoolean(runtimeEnv.PROLOGUE_STAGING_MODE) ||
    toBoolean(runtimeEnv.STORY_STAGING_MODE)
  );
}

function isLoopbackHost(hostname) {
  const normalized = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  return (
    normalized === "127.0.0.1" ||
    normalized === "localhost" ||
    normalized === "::1"
  );
}

function collectRegexMatches(value, regex, targetSet) {
  if (!value) return;
  const text = String(value);
  regex.lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      targetSet.add(match[1].toLowerCase());
    }
  }
}

function decodeJwtProjectRef(token) {
  const raw = String(token || "").trim();
  const parts = raw.split(".");
  if (parts.length !== 3 || !parts[0].startsWith("eyJ")) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const parsed = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    const ref = parsed?.ref ? String(parsed.ref).trim().toLowerCase() : "";
    return PROJECT_REF_ONLY_REGEX.test(ref) ? ref : null;
  } catch {
    return null;
  }
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
}

function extractSupabaseProjectHints(runtimeEnv = env) {
  const databaseRefs = new Set();
  const supabaseRefs = new Set();
  const allStrings = [];
  const usingGlobalEnv = runtimeEnv === env;

  const urlCandidates = [
    runtimeEnv.DATABASE_URL,
    runtimeEnv.SUPABASE_DATABASE_URL,
    runtimeEnv.SUPABASE_DB_URL,
    ...(usingGlobalEnv
      ? [
          process.env.DATABASE_URL,
          process.env.SUPABASE_DATABASE_URL,
          process.env.SUPABASE_DB_URL,
        ]
      : []),
  ];

  for (const rawUrl of urlCandidates) {
    const dbUrlRaw = cleanConfigString(rawUrl);
    if (!dbUrlRaw) continue;
    allStrings.push(dbUrlRaw);
    try {
      const parsed = new URL(dbUrlRaw);
      const user = safeDecodeURIComponent(parsed.username);
      const host = normalizeHost(parsed.hostname);
      collectRegexMatches(user, SUPABASE_POOLER_USER_REGEX, databaseRefs);
      const anyUserRef = SUPABASE_ANY_USER_REF_REGEX.exec(user);
      if (anyUserRef && anyUserRef[1]) {
        databaseRefs.add(anyUserRef[1].toLowerCase());
      }
      collectRegexMatches(host, SUPABASE_URL_HOST_REGEX, databaseRefs);
    } catch {
      collectRegexMatches(dbUrlRaw, SUPABASE_POOLER_USER_REGEX, databaseRefs);
      collectRegexMatches(dbUrlRaw, SUPABASE_URL_HOST_REGEX, databaseRefs);
    }
  }

  const userCandidates = usingGlobalEnv
    ? [
        process.env.DB_USER,
        process.env.SUPABASE_DB_USER,
        process.env.MYSQL_USER,
      ]
    : [
        runtimeEnv.DB_USER,
        runtimeEnv.SUPABASE_DB_USER,
        runtimeEnv.MYSQL_USER,
      ];
  for (const rawUser of userCandidates) {
    const dbUser = cleanConfigString(rawUser);
    if (!dbUser) continue;
    allStrings.push(dbUser);
    collectRegexMatches(dbUser, SUPABASE_POOLER_USER_REGEX, databaseRefs);
    const anyUserRef = SUPABASE_ANY_USER_REF_REGEX.exec(dbUser);
    if (anyUserRef && anyUserRef[1]) {
      databaseRefs.add(anyUserRef[1].toLowerCase());
    }
  }

  const hostCandidates = usingGlobalEnv
    ? [
        process.env.DB_HOST,
        process.env.SUPABASE_DB_HOST,
        process.env.MYSQL_HOST,
      ]
    : [
        runtimeEnv.DB_HOST,
        runtimeEnv.SUPABASE_DB_HOST,
        runtimeEnv.MYSQL_HOST,
      ];
  for (const rawHost of hostCandidates) {
    const dbHost = cleanConfigString(rawHost);
    if (!dbHost) continue;
    allStrings.push(dbHost);
    collectRegexMatches(dbHost, SUPABASE_URL_HOST_REGEX, databaseRefs);
  }

  const supabaseUrl = cleanConfigString(runtimeEnv.SUPABASE_URL);
  if (supabaseUrl) {
    allStrings.push(supabaseUrl);
    collectRegexMatches(supabaseUrl, SUPABASE_URL_HOST_REGEX, supabaseRefs);
  }

  const supabaseProjectId = cleanConfigString(runtimeEnv.SUPABASE_PROJECT_ID);
  if (supabaseProjectId) {
    allStrings.push(supabaseProjectId);
    if (PROJECT_REF_ONLY_REGEX.test(supabaseProjectId)) {
      supabaseRefs.add(supabaseProjectId.toLowerCase());
    }
  }

  const jwtRef = decodeJwtProjectRef(runtimeEnv.SUPABASE_KEY);
  if (jwtRef) {
    supabaseRefs.add(jwtRef);
  }

  const mentionsProduction =
    allStrings.some((item) =>
      item.toLowerCase().includes(PRODUCTION_SUPABASE_PROJECT_ID),
    ) ||
    databaseRefs.has(PRODUCTION_SUPABASE_PROJECT_ID) ||
    supabaseRefs.has(PRODUCTION_SUPABASE_PROJECT_ID);

  return {
    databaseRefs: Array.from(databaseRefs),
    supabaseRefs: Array.from(supabaseRefs),
    mentionsProduction,
  };
}

function collectDistinctNormalized(values, normalizer) {
  const seen = new Set();
  for (const raw of values) {
    const cleaned = cleanConfigString(raw);
    if (!cleaned) continue;
    seen.add(normalizer ? normalizer(cleaned) : cleaned);
  }
  return Array.from(seen);
}

function resolveEffectivePostgresTarget(runtimeEnv = env) {
  if (!runtimeEnv || typeof runtimeEnv !== "object") {
    throw new Error(
      "PROLOGUE_STAGING_MODE membutuhkan konfigurasi runtime yang valid.",
    );
  }

  if (toBoolean(runtimeEnv.USE_SQLITE)) {
    throw new Error(
      "PROLOGUE_STAGING_MODE menolak USE_SQLITE=true; wajib menggunakan PostgreSQL staging.",
    );
  }
  if (toBoolean(runtimeEnv.USE_MYSQL)) {
    throw new Error(
      "PROLOGUE_STAGING_MODE menolak USE_MYSQL=true; wajib menggunakan PostgreSQL staging.",
    );
  }

  const usingGlobalEnv = runtimeEnv === env;

  const urlValues = usingGlobalEnv
    ? collectDistinctNormalized([
        process.env.DATABASE_URL,
        process.env.SUPABASE_DATABASE_URL,
        process.env.SUPABASE_DB_URL,
        runtimeEnv.DATABASE_URL,
      ])
    : collectDistinctNormalized([
        runtimeEnv.DATABASE_URL,
        runtimeEnv.SUPABASE_DATABASE_URL,
        runtimeEnv.SUPABASE_DB_URL,
      ]);

  if (urlValues.length > 1) {
    throw new Error(
      "[MIXED_TARGET_REJECTED] PROLOGUE_STAGING_MODE menolak nilai URL database yang saling bertentangan antara DATABASE_URL, SUPABASE_DATABASE_URL, dan SUPABASE_DB_URL.",
    );
  }

  const explicitHosts = usingGlobalEnv
    ? collectDistinctNormalized(
        [
          process.env.DB_HOST,
          process.env.SUPABASE_DB_HOST,
          process.env.MYSQL_HOST,
        ],
        normalizeHost,
      )
    : collectDistinctNormalized(
        [
          runtimeEnv.DB_HOST,
          runtimeEnv.SUPABASE_DB_HOST,
          runtimeEnv.MYSQL_HOST,
        ],
        normalizeHost,
      );

  if (explicitHosts.length > 1) {
    throw new Error(
      `[MIXED_TARGET_REJECTED] PROLOGUE_STAGING_MODE menolak konfigurasi host diskret yang saling bertentangan: ${explicitHosts.join(", ")}.`,
    );
  }

  const explicitUsers = usingGlobalEnv
    ? collectDistinctNormalized([
        process.env.DB_USER,
        process.env.SUPABASE_DB_USER,
        process.env.MYSQL_USER,
      ])
    : collectDistinctNormalized([
        runtimeEnv.DB_USER,
        runtimeEnv.SUPABASE_DB_USER,
        runtimeEnv.MYSQL_USER,
      ]);

  if (explicitUsers.length > 1) {
    throw new Error(
      "[MIXED_TARGET_REJECTED] PROLOGUE_STAGING_MODE menolak konfigurasi user diskret yang saling bertentangan (DB_USER / SUPABASE_DB_USER / MYSQL_USER).",
    );
  }

  const dialectRaw = cleanConfigString(runtimeEnv.DB_DIALECT || "postgres").toLowerCase();
  if (dialectRaw !== "postgres" && dialectRaw !== "postgresql") {
    throw new Error(
      `PROLOGUE_STAGING_MODE menolak DB_DIALECT='${dialectRaw}'. Wajib PostgreSQL.`,
    );
  }

  const dbUrlRaw = urlValues[0] || "";
  if (dbUrlRaw) {
    try {
      validatePostgresUrl(dbUrlRaw, "postgres");
    } catch (err) {
      throw new Error(
        `PROLOGUE_STAGING_MODE menolak URL database: ${err.message}`,
      );
    }

    const parsed = new URL(dbUrlRaw);
    const effectiveHost = normalizeHost(parsed.hostname);
    const effectiveUser = safeDecodeURIComponent(parsed.username).trim();
    const effectivePort = parsed.port ? Number(parsed.port) : 5432;
    const effectiveDbName = safeDecodeURIComponent(
      String(parsed.pathname || "").replace(/^\/+/, ""),
    ).trim();

    if (!effectiveHost) {
      throw new Error(
        "PROLOGUE_STAGING_MODE mewajibkan hostname PostgreSQL yang eksplisit pada DATABASE_URL.",
      );
    }
    if (!effectiveUser) {
      throw new Error(
        "[MIXED_TARGET_REJECTED] PROLOGUE_STAGING_MODE mewajibkan username PostgreSQL eksplisit pada DATABASE_URL.",
      );
    }
    if (!effectiveDbName) {
      throw new Error(
        "PROLOGUE_STAGING_MODE mewajibkan nama database eksplisit pada DATABASE_URL.",
      );
    }

    if (explicitHosts.length === 1 && explicitHosts[0] !== effectiveHost) {
      throw new Error(
        `[MIXED_TARGET_REJECTED] Konfigurasi campuran ditolak: DATABASE_URL menunjuk host '${effectiveHost}', sedangkan DB_HOST menunjuk '${explicitHosts[0]}'.`,
      );
    }

    if (explicitUsers.length === 1 && explicitUsers[0] !== effectiveUser) {
      throw new Error(
        `[MIXED_TARGET_REJECTED] Konfigurasi campuran ditolak: DATABASE_URL memakai user '${effectiveUser}', sedangkan DB_USER menunjuk '${explicitUsers[0]}'.`,
      );
    }

    return {
      mode: "url",
      dialect: "postgres",
      host: effectiveHost,
      port: Number.isFinite(effectivePort) && effectivePort > 0 ? effectivePort : 5432,
      user: effectiveUser,
      database: effectiveDbName,
      explicitDiscreteHost: explicitHosts[0] || "",
      explicitDiscreteUser: explicitUsers[0] || "",
    };
  }

  const discreteHost = explicitHosts[0] || "";
  if (!discreteHost || discreteHost === "sqlite" || discreteHost.startsWith("/")) {
    throw new Error(
      "PROLOGUE_STAGING_MODE wajib terhubung ke PostgreSQL staging (DB_HOST valid) dan menolak fallback SQLite.",
    );
  }

  const discreteUser = explicitUsers[0] || "";
  if (!discreteUser) {
    throw new Error(
      "PROLOGUE_STAGING_MODE mewajibkan DB_USER yang eksplisit untuk koneksi diskret PostgreSQL.",
    );
  }

  const rawDbName = usingGlobalEnv
    ? cleanConfigString(
        process.env.DB_NAME ||
          process.env.SUPABASE_DB_NAME ||
          process.env.MYSQL_DATABASE ||
          runtimeEnv.DB_NAME,
      )
    : cleanConfigString(
        runtimeEnv.DB_NAME ||
          runtimeEnv.SUPABASE_DB_NAME ||
          runtimeEnv.MYSQL_DATABASE,
      );
  if (!rawDbName) {
    throw new Error(
      "PROLOGUE_STAGING_MODE mewajibkan DB_NAME yang eksplisit untuk koneksi diskret PostgreSQL.",
    );
  }

  const rawPort = usingGlobalEnv
    ? process.env.DB_PORT ||
      process.env.SUPABASE_DB_PORT ||
      process.env.MYSQL_PORT ||
      runtimeEnv.DB_PORT
    : runtimeEnv.DB_PORT ||
      runtimeEnv.SUPABASE_DB_PORT ||
      runtimeEnv.MYSQL_PORT;
  const discretePort = Number.parseInt(String(rawPort || "5432"), 10);

  return {
    mode: "discrete",
    dialect: "postgres",
    host: discreteHost,
    port: Number.isFinite(discretePort) && discretePort > 0 ? discretePort : 5432,
    user: discreteUser,
    database: rawDbName,
    explicitDiscreteHost: discreteHost,
    explicitDiscreteUser: discreteUser,
  };
}

function resolvePostgresConnectionHost(runtimeEnv = env) {
  return resolveEffectivePostgresTarget(runtimeEnv).host;
}

function assertPrologueStagingSafety(runtimeEnv = env, options = {}) {
  const { requireGuildId = true } = options || {};
  if (!isPrologueStagingMode(runtimeEnv)) {
    return { staging: false };
  }

  const expectedProjectId = cleanConfigString(
    runtimeEnv.STORY_STAGING_PROJECT_ID || DEFAULT_STAGING_SUPABASE_PROJECT_ID,
  ).toLowerCase();

  if (!PROJECT_REF_ONLY_REGEX.test(expectedProjectId)) {
    throw new Error(
      "STORY_STAGING_PROJECT_ID tidak valid untuk mode staging prolog.",
    );
  }

  if (expectedProjectId === PRODUCTION_SUPABASE_PROJECT_ID) {
    throw new Error(
      `PROLOGUE_STAGING_MODE menolak STORY_STAGING_PROJECT_ID yang menunjuk proyek produksi (${PRODUCTION_SUPABASE_PROJECT_ID}).`,
    );
  }

  const hints = extractSupabaseProjectHints(runtimeEnv);
  if (hints.mentionsProduction) {
    throw new Error(
      `PROLOGUE_STAGING_MODE diblokir: konfigurasi merujuk proyek produksi Supabase (${PRODUCTION_SUPABASE_PROJECT_ID}).`,
    );
  }

  if (hints.databaseRefs.some((ref) => ref !== expectedProjectId)) {
    throw new Error(
      `[MIXED_TARGET_REJECTED] PROLOGUE_STAGING_MODE menolak referensi database di luar proyek staging (${expectedProjectId}). Ditemukan: ${hints.databaseRefs.join(", ")}`,
    );
  }

  if (hints.supabaseRefs.some((ref) => ref !== expectedProjectId)) {
    throw new Error(
      `[MIXED_TARGET_REJECTED] PROLOGUE_STAGING_MODE menolak konfigurasi Supabase di luar proyek staging (${expectedProjectId}). Ditemukan: ${hints.supabaseRefs.join(", ")}`,
    );
  }

  const target = resolveEffectivePostgresTarget(runtimeEnv);
  const loopback = isLoopbackHost(target.host);

  if (loopback) {
    if (!toBoolean(runtimeEnv.ALLOW_LOCAL_PROLOGUE_STAGING)) {
      throw new Error(
        "PROLOGUE_STAGING_MODE menolak PostgreSQL lokal kecuali ALLOW_LOCAL_PROLOGUE_STAGING=true diset secara eksplisit.",
      );
    }
    if (
      SUPABASE_ANY_USER_REF_REGEX.test(target.user) ||
      hints.databaseRefs.length > 0
    ) {
      throw new Error(
        "[MIXED_TARGET_REJECTED] PROLOGUE_STAGING_MODE menolak pencampuran host loopback lokal dengan kredensial/referensi Supabase remote.",
      );
    }
  } else {
    if (isExplicitFalse(runtimeEnv.DB_SSL)) {
      throw new Error(
        "PROLOGUE_STAGING_MODE mewajibkan PostgreSQL TLS aktif (DB_SSL=false ditolak).",
      );
    }

    const directStagingHosts = new Set([
      `db.${expectedProjectId}.supabase.co`,
      `${expectedProjectId}.supabase.co`,
    ]);
    const isDirectStagingHost = directStagingHosts.has(target.host);
    const isPoolerHost = SUPABASE_POOLER_HOST_REGEX.test(target.host);

    if (isDirectStagingHost) {
      const userLower = target.user.toLowerCase();
      const validDirectUser = target.user.includes(".")
        ? userLower.endsWith(`.${expectedProjectId}`)
        : target.user === "postgres";
      if (!validDirectUser) {
        throw new Error(
          `[MIXED_TARGET_REJECTED] PROLOGUE_STAGING_MODE menolak kredensial user '${target.user}' untuk host Supabase staging '${target.host}'.`,
        );
      }
    } else if (isPoolerHost) {
      const poolerMatch = /^([a-z0-9_]+)\.([a-z0-9]{15,30})$/i.exec(
        target.user,
      );
      if (!poolerMatch || poolerMatch[2].toLowerCase() !== expectedProjectId) {
        throw new Error(
          `[MIXED_TARGET_REJECTED] PROLOGUE_STAGING_MODE mewajibkan user pooler dengan project ref '${expectedProjectId}' pada host '${target.host}', bukan '${target.user}'.`,
        );
      }
    } else {
      throw new Error(
        `[MIXED_TARGET_REJECTED] PROLOGUE_STAGING_MODE menolak host target '${target.host}': bukan endpoint Supabase resmi untuk proyek staging (${expectedProjectId}).`,
      );
    }
  }

  const supabaseUrl = cleanConfigString(runtimeEnv.SUPABASE_URL);
  if (supabaseUrl) {
    let parsedSupabaseUrl;
    try {
      parsedSupabaseUrl = new URL(supabaseUrl);
    } catch {
      throw new Error(
        "[MIXED_TARGET_REJECTED] SUPABASE_URL pada mode staging tidak valid.",
      );
    }
    const sbHost = normalizeHost(parsedSupabaseUrl.hostname);
    if (sbHost !== `${expectedProjectId}.supabase.co`) {
      throw new Error(
        `[MIXED_TARGET_REJECTED] SUPABASE_URL menunjuk '${sbHost}', bukan proyek staging (${expectedProjectId}.supabase.co).`,
      );
    }
  }

  const supabaseProjectId = cleanConfigString(runtimeEnv.SUPABASE_PROJECT_ID);
  if (
    supabaseProjectId &&
    supabaseProjectId.toLowerCase() !== expectedProjectId
  ) {
    throw new Error(
      `[MIXED_TARGET_REJECTED] SUPABASE_PROJECT_ID menunjuk '${supabaseProjectId}', bukan proyek staging (${expectedProjectId}).`,
    );
  }

  const supabaseKey = cleanConfigString(runtimeEnv.SUPABASE_KEY);
  if (supabaseKey && supabaseKey.startsWith("eyJ")) {
    const jwtRef = decodeJwtProjectRef(supabaseKey);
    if (jwtRef !== expectedProjectId) {
      throw new Error(
        `[MIXED_TARGET_REJECTED] SUPABASE_KEY (JWT ref=${jwtRef || "unknown"}) tidak cocok dengan proyek staging (${expectedProjectId}).`,
      );
    }
  }

  const guildId = cleanConfigString(runtimeEnv.GUILD_ID);
  if (requireGuildId && !/^\d{17,20}$/.test(guildId)) {
    throw new Error(
      "PROLOGUE_STAGING_MODE mewajibkan GUILD_ID Discord valid (17-20 digit) agar deploy command terbatas pada guild staging.",
    );
  }

  return {
    staging: true,
    projectId: expectedProjectId,
    guildId: /^\d{17,20}$/.test(guildId) ? guildId : null,
    loopback,
    pgHost: target.host,
    pgPort: target.port,
    pgUser: target.user,
    pgDatabase: target.database,
    connectionMode: target.mode,
  };
}

async function verifyPrologueStagingDatabase(
  sequelize,
  runtimeEnv = env,
  options = {},
) {
  const safety = assertPrologueStagingSafety(runtimeEnv, options);
  if (!sequelize || !sequelize.options) {
    throw new Error(
      "verifyPrologueStagingDatabase membutuhkan instance Sequelize yang valid.",
    );
  }
  if (sequelize.options.dialect !== "postgres") {
    throw new Error(
      `PROLOGUE_STAGING_MODE mewajibkan dialek PostgreSQL, bukan '${sequelize.options.dialect}'.`,
    );
  }

  if (sequelize.config && typeof sequelize.config === "object") {
    if (sequelize.config.host) {
      const actualHost = normalizeHost(sequelize.config.host);
      if (actualHost !== safety.pgHost) {
        throw new Error(
          `[MIXED_TARGET_REJECTED] Instance Sequelize terhubung ke host '${actualHost}', berbeda dari target staging tervalidasi '${safety.pgHost}'.`,
        );
      }
    }
    if (sequelize.config.username) {
      const actualUser = safeDecodeURIComponent(sequelize.config.username).trim();
      if (actualUser !== safety.pgUser) {
        throw new Error(
          `[MIXED_TARGET_REJECTED] Instance Sequelize memakai user '${actualUser}', berbeda dari user staging tervalidasi '${safety.pgUser}'.`,
        );
      }
    }
  }

  const [rows] = await sequelize.query(
    "SELECT " +
      "to_regclass('public.cache_write_journal') AS cache_write_journal, " +
      "to_regclass('public.business_operations') AS business_operations, " +
      "to_regclass('public.economy_transfer_taxes') AS economy_transfer_taxes, " +
      "to_regclass('public.economy_event_outbox') AS economy_event_outbox, " +
      "to_regclass('public.slice_of_life_progress_v1') AS slice_of_life_progress_v1",
  );
  const row = rows?.[0] || {};
  const missingTables = STAGING_REQUIRED_TABLES.filter((table) => !row[table]);
  if (missingTables.length > 0) {
    throw new Error(
      `Skema database staging belum lengkap. Tabel tidak ditemukan: ${missingTables.join(", ")}. Jalankan npm run db:migrate terlebih dahulu.`,
    );
  }

  const {
    verifyJournalSchema,
    verifyBusinessOperationSchema,
    verifyTransferTaxSchema,
    verifyEconomyOutboxSchema,
    verifySliceOfLifeSchema,
  } = require("../managers/dbMigrator");

  await verifyJournalSchema(sequelize);
  await verifyBusinessOperationSchema(sequelize);
  await verifyTransferTaxSchema(sequelize);
  await verifyEconomyOutboxSchema(sequelize);
  await verifySliceOfLifeSchema(sequelize);

  return {
    ok: true,
    safety,
    tables: STAGING_REQUIRED_TABLES,
  };
}

function getSyntheticUserProfile(userId) {
  const safeId = String(userId || "0");
  const starterInventory = Object.freeze([
    Object.freeze({
      id: "survival_started",
      name: "Starter Kit",
      quantity: 1,
    }),
  ]);
  const snapshot = {
    userId: safeId,
    balance: 0,
    bankBalance: 0,
    dailyStreak: 0,
    reputation: 0,
    xp: 0,
    level: 1,
    inventory: starterInventory,
    rpg_state: Object.freeze({ stagingSynthetic: true }),
    stagingSynthetic: true,
  };
  return Object.freeze({
    ...snapshot,
    toJSON() {
      return {
        ...snapshot,
        inventory: starterInventory.map((item) => ({ ...item })),
        rpg_state: { stagingSynthetic: true },
      };
    },
  });
}

function getSyntheticUserSurvival(userId) {
  const safeId = String(userId || "0");
  const snapshot = {
    userId: safeId,
    level: 1,
    xp: 0,
    hp: 100,
    maxHp: 100,
    hunger: 100,
    thirst: 100,
    sanity: 100,
    stamina: 100,
    maxStamina: 100,
    inGameHour: 8,
    day: 1,
    location: "sukamaju_staging",
    inventory: Object.freeze([]),
    statusEffects: Object.freeze([]),
    stagingSynthetic: true,
  };
  return Object.freeze({
    ...snapshot,
    toJSON() {
      return {
        ...snapshot,
        inventory: [],
        statusEffects: [],
      };
    },
  });
}

function isAllowedPrologueStagingInteraction(interaction) {
  if (!interaction) return false;

  const isSlash =
    typeof interaction.isChatInputCommand === "function"
      ? interaction.isChatInputCommand()
      : Boolean(interaction.commandName && !interaction.customId);
  const isAutocomplete =
    typeof interaction.isAutocomplete === "function"
      ? interaction.isAutocomplete()
      : false;

  if (isSlash || isAutocomplete) {
    if (interaction.commandName !== "survival") return false;
    const group =
      typeof interaction.options?.getSubcommandGroup === "function"
        ? interaction.options.getSubcommandGroup(false)
        : null;
    const sub =
      typeof interaction.options?.getSubcommand === "function"
        ? interaction.options.getSubcommand(false)
        : null;
    if (sub !== "story") return false;
    return !group || group === "profile";
  }

  const isComponent =
    typeof interaction.isMessageComponent === "function"
      ? interaction.isMessageComponent()
      : Boolean(interaction.customId);

  if (isComponent && typeof interaction.customId === "string") {
    return ALLOWED_STORY_COMPONENT_PREFIXES.some((prefix) =>
      interaction.customId.startsWith(prefix),
    );
  }

  return false;
}

module.exports = {
  PRODUCTION_SUPABASE_PROJECT_ID,
  DEFAULT_STAGING_SUPABASE_PROJECT_ID,
  STAGING_REQUIRED_TABLES,
  STAGING_MIGRATION_IDS,
  ALLOWED_STORY_COMPONENT_PREFIXES,
  isPrologueStagingMode,
  isLoopbackHost,
  extractSupabaseProjectHints,
  resolveEffectivePostgresTarget,
  resolvePostgresConnectionHost,
  assertPrologueStagingSafety,
  verifyPrologueStagingDatabase,
  getSyntheticUserProfile,
  getSyntheticUserSurvival,
  isAllowedPrologueStagingInteraction,
};
