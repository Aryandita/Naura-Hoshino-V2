const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');
const env = require('../config/env');

const BACKUP_DIR = path.join(__dirname, '../../backups');

async function cleanOldBackups() {
    try {
        if (!fs.existsSync(BACKUP_DIR)) return;
        const files = fs.readdirSync(BACKUP_DIR);
        const now = Date.now();
        const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

        files.forEach(file => {
            const filePath = path.join(BACKUP_DIR, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtime.getTime() > MAX_AGE) {
                fs.unlinkSync(filePath);
                logger.info(`[BACKUP] Deleted old backup: ${file}`);
            }
        });
    } catch (err) {
        logger.error('[BACKUP] Failed to clean old backups', err);
    }
}

async function runBackup() {
    try {
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }

        const dateStr = new Date().toISOString().split('T')[0];
        const hasMySQLConfig = env.DB_NAME && env.DB_USER && env.DB_HOST;

        if (hasMySQLConfig) {
            // MySQL Backup (Pure JS implementation, avoiding mysqldump command line dependency)
            const backupFile = path.join(BACKUP_DIR, `mysql_backup_${dateStr}.sql`);
            try {
                const { sequelize } = require('./dbManager');
                const tablesResult = await sequelize.query('SHOW TABLES', { type: sequelize.QueryTypes.SELECT });
                
                let sqlContent = `-- Naura Hoshino MySQL Backup\n-- Date: ${new Date().toISOString()}\n\n`;
                sqlContent += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;
                
                for (const row of tablesResult) {
                    const tableName = Object.values(row)[0];
                    
                    // 1. Get CREATE TABLE structure
                    const [createResult] = await sequelize.query(`SHOW CREATE TABLE \`${tableName}\``, { type: sequelize.QueryTypes.SELECT });
                    const createStatement = createResult['Create Table'];
                    sqlContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
                    sqlContent += `${createStatement};\n\n`;
                    
                    // 2. Get data rows
                    const rows = await sequelize.query(`SELECT * FROM \`${tableName}\``, { type: sequelize.QueryTypes.SELECT });
                    if (rows.length > 0) {
                        sqlContent += `INSERT INTO \`${tableName}\` VALUES\n`;
                        const valueStrings = [];
                        for (const dataRow of rows) {
                            const values = Object.values(dataRow).map(val => {
                                if (val === null) return 'NULL';
                                if (typeof val === 'object') {
                                    if (val instanceof Date) {
                                        return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
                                    }
                                    return `'${JSON.stringify(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
                                }
                                if (typeof val === 'string') {
                                    return `'${val.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
                                }
                                if (typeof val === 'boolean') {
                                    return val ? '1' : '0';
                                }
                                return val;
                            });
                            valueStrings.push(`(${values.join(', ')})`);
                        }
                        sqlContent += valueStrings.join(',\n') + ';\n\n';
                    }
                }
                
                sqlContent += `SET FOREIGN_KEY_CHECKS = 1;\n`;
                
                fs.writeFileSync(backupFile, sqlContent);
                logger.success(`[BACKUP] MySQL Database successfully backed up to ${backupFile} (Pure JS Mode)`);
            } catch (err) {
                logger.error(`[BACKUP] MySQL Backup Failed (Pure JS Mode):`, err.message);
            }
        } else {
            // SQLite Backup
            const sqliteSource = path.join(__dirname, '../../naura_fallback.sqlite');
            const backupFile = path.join(BACKUP_DIR, `sqlite_backup_${dateStr}.sqlite`);
            
            if (fs.existsSync(sqliteSource)) {
                fs.copyFileSync(sqliteSource, backupFile);
                logger.success(`[BACKUP] SQLite Database successfully backed up to ${backupFile}`);
            } else {
                logger.warn(`[BACKUP] SQLite database file not found at ${sqliteSource}`);
            }
        }

        await cleanOldBackups();
    } catch (error) {
        logger.error('[BACKUP] Backup process encountered an error', error);
    }
}

module.exports = { runBackup, cleanOldBackups };
