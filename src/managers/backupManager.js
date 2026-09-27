"use strict";

const fs = require("fs");
const path = require("path");
const { logger } = require("./logger");

const BACKUP_DIR = path.join(__dirname, "../../backups");

async function cleanOldBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 hari

    files.forEach((file) => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtime.getTime() > MAX_AGE) {
        fs.unlinkSync(filePath);
        logger.info(`[BACKUP] Menghapus cadangan lama: ${file}`);
      }
    });
  } catch (err) {
    logger.error("[BACKUP] Gagal membersihkan cadangan lama:", err);
  }
}

async function backupPostgres(sequelize, dateStr, createdFiles) {
  try {
    const backupFile = path.join(BACKUP_DIR, `postgres_backup_${dateStr}.json`);
    const tablesResult = await sequelize.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
      { type: sequelize.QueryTypes.SELECT },
    );

    const backupData = {
      timestamp: new Date().toISOString(),
      dialect: "postgres",
      tables: {},
    };

    for (const row of tablesResult) {
      const tableName = row.table_name || Object.values(row)[0];
      if (!tableName || tableName.startsWith("_")) continue;

      try {
        const rows = await sequelize.query(
          `SELECT * FROM "${tableName}" LIMIT 5000`,
          { type: sequelize.QueryTypes.SELECT },
        );
        backupData.tables[tableName] = rows;
      } catch (tableErr) {
        logger.warn(`[BACKUP] Gagal mengekspor tabel ${tableName}: ${tableErr.message}`);
      }
    }

    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    createdFiles.push(backupFile);
    logger.success(`[BACKUP] PostgreSQL / Supabase berhasil dicadangkan ke ${backupFile}`);
  } catch (err) {
    logger.error("[BACKUP] PostgreSQL Backup Gagal:", err.message);
  }
}

async function backupMySQL(sequelize, dateStr, createdFiles) {
  const backupFile = path.join(BACKUP_DIR, `mysql_backup_${dateStr}.sql`);
  try {
    const tablesResult = await sequelize.query("SHOW TABLES", {
      type: sequelize.QueryTypes.SELECT,
    });

    let sqlContent = `-- Naura Hoshino MySQL Backup\n-- Date: ${new Date().toISOString()}\n\n`;
    sqlContent += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

    for (const row of tablesResult) {
      const tableName = Object.values(row)[0];

      const [createResult] = await sequelize.query(
        `SHOW CREATE TABLE \`${tableName}\``,
        { type: sequelize.QueryTypes.SELECT },
      );
      const createStatement = createResult["Create Table"];
      sqlContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
      sqlContent += `${createStatement};\n\n`;

      const rows = await sequelize.query(`SELECT * FROM \`${tableName}\``, {
        type: sequelize.QueryTypes.SELECT,
      });
      if (rows.length > 0) {
        sqlContent += `INSERT INTO \`${tableName}\` VALUES\n`;
        const valueStrings = [];
        for (const dataRow of rows) {
          const values = Object.values(dataRow).map((val) => {
            if (val === null) return "NULL";
            if (typeof val === "object") {
              if (val instanceof Date) {
                return `'${val.toISOString().slice(0, 19).replace("T", " ")}'`;
              }
              return `'${JSON.stringify(val).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r")}'`;
            }
            if (typeof val === "string") {
              return `'${val.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r")}'`;
            }
            if (typeof val === "boolean") {
              return val ? "1" : "0";
            }
            return val;
          });
          valueStrings.push(`(${values.join(", ")})`);
        }
        sqlContent += valueStrings.join(",\n") + ";\n\n";
      }
    }

    sqlContent += `SET FOREIGN_KEY_CHECKS = 1;\n`;
    fs.writeFileSync(backupFile, sqlContent);
    createdFiles.push(backupFile);
    logger.success(`[BACKUP] MySQL Database berhasil dicadangkan ke ${backupFile}`);
  } catch (err) {
    logger.error("[BACKUP] MySQL Backup Gagal:", err.message);
  }
}

async function backupMongo(dateStr, createdFiles) {
  try {
    const mongoManager = require("./mongoManager");
    if (!mongoManager || !mongoManager.isReady) return;

    const backupFile = path.join(BACKUP_DIR, `mongo_backup_${dateStr}.json`);
    const mongoose = require("mongoose");
    const collections = await mongoose.connection.db.listCollections().toArray();
    const mongoDump = {
      timestamp: new Date().toISOString(),
      collections: {},
    };

    for (const col of collections) {
      const data = await mongoose.connection.db
        .collection(col.name)
        .find({})
        .limit(2000)
        .toArray();
      mongoDump.collections[col.name] = data;
    }

    fs.writeFileSync(backupFile, JSON.stringify(mongoDump, null, 2));
    createdFiles.push(backupFile);
    logger.success(`[BACKUP] MongoDB Atlas berhasil dicadangkan ke ${backupFile}`);
  } catch (err) {
    logger.warn(`[BACKUP] MongoDB export dilewati atau gagal: ${err.message}`);
  }
}

async function runBackup() {
  const createdFiles = [];
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const dateStr = new Date().toISOString().split("T")[0];
    const { sequelize } = require("./dbManager");
    const dialect = sequelize ? sequelize.getDialect() : "sqlite";

    if (dialect === "postgres") {
      await backupPostgres(sequelize, dateStr, createdFiles);
    } else if (dialect === "mysql") {
      await backupMySQL(sequelize, dateStr, createdFiles);
    } else {
      // SQLite Backup
      const sqliteSource = path.join(__dirname, "../../naura_fallback.sqlite");
      const backupFile = path.join(
        BACKUP_DIR,
        `sqlite_backup_${dateStr}.sqlite`,
      );

      if (fs.existsSync(sqliteSource)) {
        fs.copyFileSync(sqliteSource, backupFile);
        createdFiles.push(backupFile);
        logger.success(
          `[BACKUP] SQLite Database berhasil dicadangkan ke ${backupFile}`,
        );
      }
    }

    // MongoDB backup jika terkoneksi
    await backupMongo(dateStr, createdFiles);

    await cleanOldBackups();
    return { success: true, files: createdFiles };
  } catch (error) {
    logger.error("[BACKUP] Proses pencadangan mengalami kendala:", error);
    return { success: false, error: error.message };
  }
}

module.exports = { runBackup, cleanOldBackups };
